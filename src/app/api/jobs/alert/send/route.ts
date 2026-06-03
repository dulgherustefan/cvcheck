import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { buildJobAlertEmail } from '@/lib/email-templates'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min — processes multiple users

const resend    = new Resend(process.env.RESEND_API_KEY!)
const anthropic = new Anthropic()
const FROM_EMAIL = process.env.RESEND_FROM ?? 'CVCheck <alerts@cvcheck.app>'

// ── Auth: only Vercel Cron or internal secret can call this ──────────────────
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  // Refuse if secret is missing or too short (less than 32 chars)
  if (!cronSecret || cronSecret.length < 32) {
    console.error('[cron-auth] CRON_SECRET is missing or too short — refusing request')
    return false
  }
  const auth = req.headers.get('authorization')
  if (!auth) return false

  // Constant-time comparison to prevent timing attacks
  const expected = `Bearer ${cronSecret}`
  if (auth.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= auth.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

// ── Adzuna + Remotive fetch (simplified, same logic as /api/jobs) ─────────────
async function fetchJobsForAlert(domain: string, level: string): Promise<Array<{
  title: string; company: string; location: string; redirect_url: string
  description: string; salary_min?: number; salary_max?: number
}>> {
  const levelMap: Record<string, string> = {
    'student/junior': 'junior', 'senior': 'senior', 'executive': 'director',
  }
  const levelTerm = levelMap[level] ?? ''
  const d = domain.toLowerCase()
  let role = d
  if (d.includes('software') || d.includes('engineer') || d.includes('developer')) role = 'software engineer'
  else if (d.includes('frontend') || d.includes('react')) role = 'frontend developer'
  else if (d.includes('backend')) role = 'backend developer'
  else if (d.includes('data science') || d.includes('machine learning')) role = 'data scientist'
  else if (d.includes('devops')) role = 'devops engineer'
  else if (d.includes('product manager')) role = 'product manager'
  else if (d.includes('design') || d.includes('ux')) role = 'ux designer'
  const query = [levelTerm, role].filter(Boolean).join(' ')

  const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID
  const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY

  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.error('[fetchJobsForAlert] Missing Adzuna credentials')
    return []
  }

  try {
    const [adzunaRes, remotiveRes] = await Promise.allSettled([
      fetch(`https://api.adzuna.com/v1/api/jobs/gb/search/1?${new URLSearchParams({ app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY, results_per_page: '4', what: query, sort_by: 'relevance', what_and: 'remote' })}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000), // 8s timeout per fetch
      }),
      fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=4`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      }),
    ])

    const jobs: Array<{ title: string; company: string; location: string; redirect_url: string; description: string; salary_min?: number; salary_max?: number }> = []

    if (adzunaRes.status === 'fulfilled' && adzunaRes.value.ok) {
      const data = await adzunaRes.value.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (data?.results ?? []).slice(0, 4) as any[]) {
        jobs.push({
          title:       String(r.title ?? '').slice(0, 200),
          company:     String(r.company?.display_name ?? '').slice(0, 200),
          location:    String(r.location?.display_name ?? 'Remote').slice(0, 200),
          redirect_url: String(r.redirect_url ?? ''),
          description: String(r.description ?? '').slice(0, 400),
          salary_min:  typeof r.salary_min === 'number' ? r.salary_min : undefined,
          salary_max:  typeof r.salary_max === 'number' ? r.salary_max : undefined,
        })
      }
    }

    if (remotiveRes.status === 'fulfilled' && remotiveRes.value.ok) {
      const data = await remotiveRes.value.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const j of (data?.jobs ?? []).slice(0, 4) as any[]) {
        jobs.push({
          title:       String(j.title ?? '').slice(0, 200),
          company:     String(j.company_name ?? '').slice(0, 200),
          location:    String(j.candidate_required_location || 'Worldwide').slice(0, 200),
          redirect_url: String(j.url ?? ''),
          description: String(j.description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 400),
        })
      }
    }

    return jobs
  } catch {
    return []
  }
}

// ── GET /api/jobs/alert/send (triggered by Vercel Cron) ──────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    // Generic response — don't hint whether secret is wrong or missing
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Idempotency guard: check if cron already ran in the last 12 hours
  // (prevents double-sends if Vercel retries)
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const { data: recentlySent } = await supabaseAdmin
    .from('job_alerts')
    .select('last_sent_at')
    .gt('last_sent_at', twelveHoursAgo)
    .limit(1)
    .single()

  if (recentlySent) {
    console.log('[job-alerts] Cron already ran recently — skipping to prevent double-send')
    return NextResponse.json({ ok: true, sent: 0, reason: 'already_ran' })
  }

  // Fetch all subscribed users
  const { data: alerts, error } = await supabaseAdmin
    .from('job_alerts')
    .select('*')
    .eq('subscribed', true)
    .order('last_sent_at', { ascending: true, nullsFirst: true })
    .limit(50)

  if (error) {
    console.error('[job-alerts] DB fetch error:', error.code)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (!alerts?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  const errors: string[] = []

  for (const alert of alerts) {
    try {
      // Validate required fields before using them
      if (!alert.detected_domain || !alert.email || !alert.unsubscribe_token) {
        errors.push(`${alert.id}: missing required fields, skipping`)
        continue
      }

      const rawJobs = await fetchJobsForAlert(alert.detected_domain, alert.detected_level)
      if (!rawJobs.length) continue

      // Build prompt with sanitized inputs (cap lengths, prevent prompt injection)
      const safeDomain   = String(alert.detected_domain).slice(0, 100)
      const safeLevel    = String(alert.detected_level ?? '').slice(0, 50)
      const safeKeywords = (alert.keywords ?? [])
        .slice(0, 20)
        .map((k: unknown) => String(k).slice(0, 50))
        .join(', ')

      const fitPrompt = `You are a recruiter. Given a candidate profile and ${rawJobs.length} job listings, return ONLY a JSON array — no explanation, no markdown.

Candidate:
- Domain: ${safeDomain}
- Level: ${safeLevel}
- Keywords: ${safeKeywords}

Jobs:
${rawJobs.map((j, i) => `${i + 1}. ${j.title.slice(0, 100)} at ${j.company.slice(0, 100)} — ${j.description.slice(0, 200)}`).join('\n')}

Return array of ${rawJobs.length} objects:
[{"fit_score": <0-100>, "fit_label": <"strong"|"good"|"partial"|"stretch">, "strengths": [<string>, <string>]}]`

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: fitPrompt }],
      })

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')
        .replace(/```json|```/g, '')
        .trim()

      let fits: Array<{ fit_score: number; fit_label: string; strengths: string[] }>
      try {
        fits = JSON.parse(text)
        if (!Array.isArray(fits)) throw new Error('Not an array')
      } catch {
        errors.push(`${alert.email}: invalid AI response format`)
        continue
      }

      const jobs = rawJobs
        .map((j, i) => ({
          ...j,
          fit_score: typeof fits[i]?.fit_score === 'number'
            ? Math.min(100, Math.max(0, fits[i].fit_score))
            : 0,
          fit_label: fits[i]?.fit_label ?? 'partial',
          strengths: Array.isArray(fits[i]?.strengths) ? fits[i].strengths : [],
        }))
        .sort((a, b) => b.fit_score - a.fit_score)
        .filter(j => j.fit_score >= 40)
        .slice(0, 5)

      if (!jobs.length) continue

      const html = buildJobAlertEmail({
        email:            alert.email,
        domain:           safeDomain,
        level:            safeLevel,
        jobs,
        unsubscribeToken: alert.unsubscribe_token,
      })

      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      alert.email,
        subject: `${jobs.length} ${safeDomain} jobs matched your profile this week`,
        html,
      })

      await supabaseAdmin
        .from('job_alerts')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', alert.id)

      sent++
    } catch (err) {
      // Log generic error — don't expose internal details
      console.error(`[job-alerts] Error for alert ${alert.id}:`, err instanceof Error ? err.message : 'unknown')
      errors.push(`${alert.id}: processing failed`)
    }
  }

  console.log(`[job-alerts] Sent: ${sent}, Errors: ${errors.length}`)
  // Return generic error count, not internal details
  return NextResponse.json({ ok: true, sent, errorCount: errors.length })
}
