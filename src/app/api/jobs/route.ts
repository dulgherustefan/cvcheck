import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type {
  JobsRequest,
  JobsResponse,
  JobListing,
  JobFitAnalysis,
  JobMatch,
  Tier,
} from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Auth helpers (reuse same pattern as /api/roast) ──────────────────────────

import { supabaseAdmin } from '@/lib/supabase-admin'

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

async function getTierForUser(userId: string | null): Promise<Tier> {
  if (!userId) return 'free'
  const { data, error } = await supabaseAdmin
    .from('credits')
    .select('plan')
    .eq('user_id', userId)
    .single()
  if (error || !data) return 'free'
  if (data.plan === 'premium') return 'premium'
  if (data.plan === 'pro') return 'pro'
  return 'free'
}

// ── Adzuna helpers ────────────────────────────────────────────────────────────

const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID!
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY!

/**
 * Build a clean, focused Adzuna search query from CV metadata.
 * We keep it short (2-4 words) so results are relevant.
 */
function buildAdzunaQuery(
  domain: string,
  level: string,
  trajectory: string,
): string {
  // Map detected_level to a term Adzuna understands
  const levelMap: Record<string, string> = {
    'student/junior': 'junior',
    'mid-level':      '',         // omit — too generic, hurts results
    'senior':         'senior',
    'executive':      'head of',
    'unclear':        '',
  }
  const levelTerm = levelMap[level] ?? ''

  // Extract the core role from trajectory (e.g. "Junior Dev → Senior Dev" → "developer")
  // Fall back to domain if trajectory is vague
  const domainShort = domain
    .replace('Software Engineering', 'software engineer')
    .replace('Frontend Development', 'frontend developer')
    .replace('Backend Development', 'backend developer')
    .replace('Data Science', 'data scientist')
    .replace('Product Management', 'product manager')
    .replace('Marketing', 'marketing')
    .replace('Design', 'designer')
    .replace('DevOps', 'devops engineer')
    .replace('Finance', 'finance')
    .replace('Sales', 'sales')
    .toLowerCase()

  return [levelTerm, domainShort].filter(Boolean).join(' ').trim()
}

async function fetchAdzunaJobs(
  query: string,
  country: string = 'gb',
): Promise<JobListing[]> {
  const params = new URLSearchParams({
    app_id:          ADZUNA_APP_ID,
    app_key:         ADZUNA_APP_KEY,
    results_per_page:'8',
    what:            query,
    content_type:    'application/json',
    sort_by:         'relevance',
  })

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`
  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Adzuna API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = data?.results ?? []

  return results.map((r) => ({
    id:          r.id ?? String(Math.random()),
    title:       r.title ?? 'Untitled',
    company:     r.company?.display_name ?? 'Unknown company',
    location:    r.location?.display_name ?? '',
    description: (r.description ?? '').slice(0, 320).replace(/\s+/g, ' ').trim(),
    redirect_url: r.redirect_url ?? '',
    salary_min:  r.salary_min,
    salary_max:  r.salary_max,
    created:     r.created ?? new Date().toISOString(),
  }))
}

// ── Claude fit analysis ───────────────────────────────────────────────────────

const anthropic = new Anthropic()

async function analyzeJobFit(
  job: JobListing,
  cvMeta: JobsRequest,
): Promise<JobFitAnalysis> {
  const prompt = `You are a senior recruiter. Given a candidate profile and a job listing, return ONLY a JSON object — no explanation, no markdown fences.

Candidate:
- Domain: ${cvMeta.detected_domain}
- Level: ${cvMeta.detected_level}
- Career trajectory: ${cvMeta.trajectory}
- Skills/keywords on CV: ${cvMeta.keywords.join(', ')}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Description: ${job.description}

Return this exact JSON shape:
{
  "fit_score": <0-100 integer>,
  "fit_label": <"strong"|"good"|"partial"|"stretch">,
  "gaps": [<string>, <string>, <string>]
}

fit_label rules: 80-100=strong, 60-79=good, 40-59=partial, 0-39=stretch
gaps: exactly 3 short strings (max 10 words each) — specific skills or experience missing from the candidate's profile for THIS role. Be concrete, not generic.`

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .replace(/```json|```/g, '')
    .trim()

  const parsed = JSON.parse(text) as JobFitAnalysis
  return parsed
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as JobsRequest

    const { detected_domain, detected_level, trajectory, keywords, country } = body

    if (!detected_domain || !detected_level) {
      return NextResponse.json(
        { error: 'detected_domain and detected_level are required' },
        { status: 400 },
      )
    }

    // Auth + tier
    const userId = await getUserIdFromRequest(req)
    const tier   = await getTierForUser(userId)
    const isPro  = tier === 'pro' || tier === 'premium'
    const fitLocked = !isPro

    // Build query + fetch jobs
    const query = buildAdzunaQuery(detected_domain, detected_level, trajectory ?? '')
    const listings = await fetchAdzunaJobs(query, country ?? 'gb')

    if (listings.length === 0) {
      return NextResponse.json<JobsResponse>({
        jobs:        [],
        fit_locked:  fitLocked,
        query_used:  query,
      })
    }

    // For Pro/Premium: analyze fit for each job in parallel (capped at 6)
    const toAnalyze = listings.slice(0, 6)

    let jobs: JobMatch[]

    if (isPro) {
      const fitResults = await Promise.allSettled(
        toAnalyze.map((listing) => analyzeJobFit(listing, body)),
      )

      jobs = toAnalyze.map((listing, i) => {
        const result = fitResults[i]
        const fit: JobFitAnalysis | null =
          result.status === 'fulfilled' ? result.value : null
        return { listing, fit }
      })
    } else {
      // Free: return listings without fit analysis
      jobs = toAnalyze.map((listing) => ({ listing, fit: null }))
    }

    // Sort Pro results by fit_score descending
    if (isPro) {
      jobs.sort((a, b) => (b.fit?.fit_score ?? 0) - (a.fit?.fit_score ?? 0))
    }

    return NextResponse.json<JobsResponse>({
      jobs,
      fit_locked: fitLocked,
      query_used: query,
    })
  } catch (err) {
    console.error('[jobs] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch job matches. Please try again.' },
      { status: 500 },
    )
  }
}
