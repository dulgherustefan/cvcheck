import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { buildJobAlertEmail } from '../route'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min — processes multiple users

const resend    = new Resend(process.env.RESEND_API_KEY!)
const anthropic = new Anthropic()
const FROM_EMAIL = process.env.RESEND_FROM ?? 'CVCheck <alerts@cvcheck.app>'

// ── Auth: only Vercel Cron or internal secret can call this ──────────────────
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${cronSecret}`
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

  const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID!
  const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY!

  try {
    const [adzunaRes, remotiveRes] = await Promise.allSettled([
      fetch(`https://api.adzuna.com/v1/api/jobs/gb/search/1?${new URLSearchParams({ app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY, results_per_page: '4', what: query, sort_by: 'relevance', what_and: 'remote' })}`, { headers: { Accept: 'application/json' } }),
      fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=4`, { headers: { Accept: 'application/json' } }),
    ])

    const jobs: typeof [] = []

    if (adzunaRes.status === 'fulfilled' && adzunaRes.value.ok) {
      const data = await adzunaRes.value.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (data?.results ?? []).slice(0, 4) as any[]) {
        jobs.push({ title: r.title, company: r.company?.display_name ?? '', location: r.location?.display_name ?? 'Remote', redirect_url: r.redirect_url, description: (r.description ?? '').slice(0, 400), salary_min: r.salary_min, salary_max: r.salary_max })
      }
    }

    if (remotiveRes.status === 'fulfilled' && remotiveRes.value.ok) {
      const data = await remotiveRes.value.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const j of (data?.jobs ?? []).slice(0, 4) as any[]) {
        jobs.push({ title: j.title, company: j.company_name ?? '', location: j.candidate_required_location || 'Worldwide', redirect_url: j.url, description: (j.description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 400) })
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all subscribed users
  const { data: alerts, error } = await supabaseAdmin
    .from('job_alerts')
    .select('*')
    .eq('subscribed', true)
    .order('last_sent_at', { ascending: true, nullsFirst: true })
    .limit(50) // process 50 per cron run to stay within limits

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!alerts?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  const errors: string[] = []

  for (const alert of alerts) {
    try {
      const rawJobs = await fetchJobsForAlert(alert.detected_domain, alert.detected_level)
      if (!rawJobs.length) continue

      // Get fit scores from Claude
      const fitPrompt = `You are a recruiter. Given a candidate profile and ${rawJobs.length} job listings, return ONLY a JSON array — no explanation, no markdown.

Candidate:
- Domain: ${alert.detected_domain}
- Level: ${alert.detected_level}
- Keywords: ${(alert.keywords ?? []).join(', ')}

Jobs:
${rawJobs.map((j, i) => `${i + 1}. ${j.title} at ${j.company} — ${j.description.slice(0, 200)}`).join('\n')}

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

      const fits = JSON.parse(text) as Array<{ fit_score: number; fit_label: string; strengths: string[] }>

      const jobs = rawJobs
        .map((j, i) => ({ ...j, ...fits[i] }))
        .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0))
        .filter(j => j.fit_score >= 40) // only good+ matches in email
        .slice(0, 5)

      if (!jobs.length) continue

      const html = buildJobAlertEmail({
        email:            alert.email,
        domain:           alert.detected_domain,
        level:            alert.detected_level,
        jobs,
        unsubscribeToken: alert.unsubscribe_token,
      })

      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      alert.email,
        subject: `${jobs.length} ${alert.detected_domain} jobs matched your profile this week`,
        html,
      })

      // Update last_sent_at
      await supabaseAdmin
        .from('job_alerts')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', alert.id)

      sent++
    } catch (err) {
      errors.push(`${alert.email}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  console.log(`[job-alerts] Sent: ${sent}, Errors: ${errors.length}`)
  return NextResponse.json({ ok: true, sent, errors })
}
