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
  _trajectory: string,
): string {
  const levelMap: Record<string, string> = {
    'student/junior': 'junior',
    'mid-level':      '',
    'senior':         'senior',
    'executive':      'director',
    'unclear':        '',
  }
  const levelTerm = levelMap[level] ?? ''

  // Normalize domain to a short searchable role — case-insensitive
  const d = domain.toLowerCase()
  let role = d  // fallback: use domain as-is

  if (d.includes('software') || d.includes('engineer') || d.includes('developer') || d.includes('full-stack') || d.includes('fullstack')) {
    role = 'software engineer'
  } else if (d.includes('frontend') || d.includes('front-end') || d.includes('react') || d.includes('vue')) {
    role = 'frontend developer'
  } else if (d.includes('backend') || d.includes('back-end')) {
    role = 'backend developer'
  } else if (d.includes('data science') || d.includes('machine learning') || d.includes('ml engineer')) {
    role = 'data scientist'
  } else if (d.includes('data analyst') || d.includes('analytics')) {
    role = 'data analyst'
  } else if (d.includes('devops') || d.includes('platform engineer') || d.includes('sre')) {
    role = 'devops engineer'
  } else if (d.includes('product manager') || d.includes('product management')) {
    role = 'product manager'
  } else if (d.includes('design') || d.includes('ux') || d.includes('ui')) {
    role = 'ux designer'
  } else if (d.includes('marketing')) {
    role = 'marketing manager'
  } else if (d.includes('sales')) {
    role = 'sales manager'
  } else if (d.includes('finance') || d.includes('accounting')) {
    role = 'finance manager'
  } else if (d.includes('hr') || d.includes('human resources') || d.includes('recruiter')) {
    role = 'hr manager'
  } else if (d.includes('project manager') || d.includes('project management')) {
    role = 'project manager'
  } else if (d.includes('cybersecurity') || d.includes('security engineer')) {
    role = 'security engineer'
  } else if (d.includes('mobile') || d.includes('ios') || d.includes('android')) {
    role = 'mobile developer'
  } else if (d.includes('content') || d.includes('copywriter')) {
    role = 'content writer'
  }

  return [levelTerm, role].filter(Boolean).join(' ').trim()
}

/** Fallback query — just the role without level prefix */
function buildFallbackQuery(domain: string): string {
  return buildAdzunaQuery(domain, 'unclear', '')
}

// Countries to search across — covers most job markets
const ADZUNA_COUNTRIES = ['gb', 'us', 'ca', 'au', 'de', 'nl', 'sg', 'at', 'be', 'br', 'in', 'nz', 'pl', 'za']

async function fetchAdzunaJobsFromCountry(
  query: string,
  country: string,
  perPage: number = 3,
): Promise<JobListing[]> {
  const params = new URLSearchParams({
    app_id:           ADZUNA_APP_ID,
    app_key:          ADZUNA_APP_KEY,
    results_per_page: String(perPage),
    what:             query,
    sort_by:          'relevance',
  })

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = data?.results ?? []
    return results.map((r) => ({
      id:           r.id ? `${country}-${r.id}` : String(Math.random()),
      title:        r.title ?? 'Untitled',
      company:      r.company?.display_name ?? 'Unknown company',
      location:     r.location?.display_name ?? country.toUpperCase(),
      description:  (r.description ?? '').slice(0, 320).replace(/\s+/g, ' ').trim(),
      redirect_url: r.redirect_url ?? '',
      salary_min:   r.salary_min,
      salary_max:   r.salary_max,
      created:      r.created ?? new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

async function fetchAdzunaJobs(
  query: string,
  preferredCountry?: string,
): Promise<JobListing[]> {
  // Build country list: preferred first, then rest
  const countries = preferredCountry && ADZUNA_COUNTRIES.includes(preferredCountry)
    ? [preferredCountry, ...ADZUNA_COUNTRIES.filter(c => c !== preferredCountry)]
    : ADZUNA_COUNTRIES

  // Fetch top 4 countries in parallel (3 results each = up to 12 total)
  const topCountries = countries.slice(0, 4)
  console.log('[jobs] Fetching from countries:', topCountries.join(', '), '| query:', query)

  const results = await Promise.allSettled(
    topCountries.map(c => fetchAdzunaJobsFromCountry(query, c, 3))
  )

  const listings: JobListing[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[jobs] ${topCountries[i]}: ${r.value.length} results`)
      listings.push(...r.value)
    }
  })

  // Deduplicate by title+company
  const seen = new Set<string>()
  return listings.filter(j => {
    const key = `${j.title.toLowerCase()}-${j.company.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Claude fit analysis ───────────────────────────────────────────────────────

const anthropic = new Anthropic()

async function analyzeJobFit(
  job: JobListing,
  cvMeta: JobsRequest,
  isPro: boolean,
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
  "strengths": [<string>, <string>],
  "gaps": [<string>, <string>, <string>]
}

fit_label rules: 80-100=strong, 60-79=good, 40-59=partial, 0-39=stretch
strengths: exactly 2 short strings (max 10 words) — what the candidate already has that matches this role.
gaps: exactly 3 short strings (max 10 words) — specific skills or experience missing. Be concrete.`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .replace(/```json|```/g, '')
    .trim()

  const parsed = JSON.parse(text) as JobFitAnalysis
  // Free users: hide gaps
  if (!isPro) parsed.gaps = []
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
    const userId    = await getUserIdFromRequest(req)
    const tier      = await getTierForUser(userId)
    const isPro     = tier === 'pro' || tier === 'premium'
    const fitLocked = !isPro  // free = gaps locked, strengths always visible

    // Detect country from IP if not provided
    const detectedCountry = country
      ?? req.headers.get('x-vercel-ip-country')?.toLowerCase()
      ?? req.headers.get('cf-ipcountry')?.toLowerCase()
      ?? 'gb'

    console.log('[jobs] Country:', detectedCountry, '(provided:', country, ')')

    // Build query + fetch jobs — with fallback to simpler query if 0 results
    const query = buildAdzunaQuery(detected_domain, detected_level, trajectory ?? '')
    let listings = await fetchAdzunaJobs(query, detectedCountry)
    let queryUsed = query

    if (listings.length === 0) {
      const fallback = buildFallbackQuery(detected_domain)
      if (fallback !== query) {
        console.log('[jobs] 0 results, trying fallback query:', fallback)
        listings = await fetchAdzunaJobs(fallback, detectedCountry)
        queryUsed = fallback
      }
    }

    if (listings.length === 0) {
      return NextResponse.json<JobsResponse>({
        jobs:             [],
        fit_locked:       fitLocked,
        query_used:       queryUsed,
        detected_country: detectedCountry,
      })
    }

    // Analyze fit for ALL tiers — free gets strengths only, pro+ gets gaps too
    const toAnalyze = listings.slice(0, 8)

    const fitResults = await Promise.allSettled(
      toAnalyze.map((listing) => analyzeJobFit(listing, body, isPro)),
    )

    let jobs: JobMatch[] = toAnalyze.map((listing, i) => {
      const result = fitResults[i]
      const fit: JobFitAnalysis | null =
        result.status === 'fulfilled' ? result.value : null
      return { listing, fit }
    })

    // Sort by fit_score descending
    jobs.sort((a, b) => (b.fit?.fit_score ?? 0) - (a.fit?.fit_score ?? 0))

    return NextResponse.json<JobsResponse>({
      jobs,
      fit_locked:       fitLocked,
      query_used:       queryUsed,
      detected_country: detectedCountry,
    })
  } catch (err) {
    console.error('[jobs] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch job matches. Please try again.' },
      { status: 500 },
    )
  }
}
