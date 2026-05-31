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

// ── Auth helpers ──────────────────────────────────────────────────────────────

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

// ── Country helpers ───────────────────────────────────────────────────────────

const ADZUNA_SUPPORTED = new Set([
  'gb', 'us', 'ca', 'au', 'de', 'nl', 'sg', 'at', 'be', 'br', 'in', 'nz', 'pl', 'za',
  'fr', 'it', 'es', 'ru', 'mx', 'ar',
])

// For unsupported countries, map to nearest relevant Adzuna markets
const COUNTRY_FALLBACK_MAP: Record<string, string[]> = {
  ro: ['gb', 'nl', 'de', 'pl'],
  ua: ['pl', 'de', 'gb', 'nl'],
  md: ['gb', 'de', 'nl', 'pl'],
  bg: ['gb', 'de', 'nl', 'pl'],
  rs: ['de', 'gb', 'nl', 'at'],
  hr: ['de', 'at', 'gb', 'nl'],
  sk: ['de', 'at', 'pl', 'gb'],
  cz: ['de', 'gb', 'nl', 'at'],
  hu: ['de', 'at', 'gb', 'nl'],
  se: ['gb', 'de', 'nl', 'us'],
  dk: ['gb', 'de', 'nl', 'us'],
  no: ['gb', 'de', 'nl', 'us'],
  fi: ['gb', 'de', 'nl', 'us'],
  pt: ['gb', 'es', 'de', 'nl'],
  gr: ['gb', 'de', 'nl', 'at'],
  jp: ['sg', 'au', 'gb', 'us'],
  kr: ['sg', 'au', 'gb', 'us'],
  ae: ['gb', 'sg', 'us', 'in'],
  il: ['gb', 'us', 'de', 'nl'],
  ng: ['za', 'gb', 'us', 'in'],
  ke: ['za', 'gb', 'us', 'in'],
  co: ['us', 'br', 'ar', 'mx'],
  cl: ['ar', 'br', 'us', 'mx'],
  pe: ['ar', 'br', 'us', 'mx'],
  ch: ['de', 'at', 'gb', 'nl'],
  lt: ['de', 'pl', 'gb', 'nl'],
  lv: ['de', 'pl', 'gb', 'nl'],
  ee: ['de', 'pl', 'gb', 'nl'],
}

function resolveSearchCountries(userCountry: string): { countries: string[]; isSupported: boolean } {
  const c = userCountry.toLowerCase()
  if (ADZUNA_SUPPORTED.has(c)) {
    const others = ['gb', 'us', 'nl', 'de', 'ca'].filter(x => x !== c)
    return { countries: [c, ...others], isSupported: true }
  }
  const fallback = COUNTRY_FALLBACK_MAP[c] ?? ['gb', 'nl', 'de', 'us']
  console.log(`[jobs] '${c}' not in Adzuna, fallback: ${fallback.join(', ')}`)
  return { countries: fallback, isSupported: false }
}

// ── Query builder ─────────────────────────────────────────────────────────────

function buildAdzunaQuery(domain: string, level: string, _trajectory: string): string {
  const levelMap: Record<string, string> = {
    'student/junior': 'junior',
    'mid-level':      '',
    'senior':         'senior',
    'executive':      'director',
    'unclear':        '',
  }
  const levelTerm = levelMap[level] ?? ''
  const d = domain.toLowerCase()
  let role = d

  if (d.includes('software') || d.includes('engineer') || d.includes('developer') || d.includes('full-stack') || d.includes('fullstack')) role = 'software engineer'
  else if (d.includes('frontend') || d.includes('front-end') || d.includes('react') || d.includes('vue')) role = 'frontend developer'
  else if (d.includes('backend') || d.includes('back-end')) role = 'backend developer'
  else if (d.includes('data science') || d.includes('machine learning') || d.includes('ml engineer')) role = 'data scientist'
  else if (d.includes('data analyst') || d.includes('analytics')) role = 'data analyst'
  else if (d.includes('devops') || d.includes('platform engineer') || d.includes('sre')) role = 'devops engineer'
  else if (d.includes('product manager') || d.includes('product management')) role = 'product manager'
  else if (d.includes('design') || d.includes('ux') || d.includes('ui')) role = 'ux designer'
  else if (d.includes('marketing')) role = 'marketing manager'
  else if (d.includes('sales')) role = 'sales manager'
  else if (d.includes('finance') || d.includes('accounting')) role = 'finance manager'
  else if (d.includes('hr') || d.includes('human resources') || d.includes('recruiter')) role = 'hr manager'
  else if (d.includes('project manager') || d.includes('project management')) role = 'project manager'
  else if (d.includes('cybersecurity') || d.includes('security engineer')) role = 'security engineer'
  else if (d.includes('mobile') || d.includes('ios') || d.includes('android')) role = 'mobile developer'
  else if (d.includes('content') || d.includes('copywriter')) role = 'content writer'

  return [levelTerm, role].filter(Boolean).join(' ').trim()
}

function buildFallbackQuery(domain: string): string {
  return buildAdzunaQuery(domain, 'unclear', '')
}

// ── Adzuna fetcher ────────────────────────────────────────────────────────────

const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID!
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY!

async function fetchAdzunaJobsFromCountry(
  query: string,
  country: string,
  perPage = 2,
  remoteOnly = false,
): Promise<JobListing[]> {
  const params = new URLSearchParams({
    app_id:           ADZUNA_APP_ID,
    app_key:          ADZUNA_APP_KEY,
    results_per_page: String(perPage),
    what:             query,
    sort_by:          'relevance',
  })
  if (remoteOnly) params.set('what_and', 'remote')

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.results ?? []).map((r: any) => ({
      id:           r.id ? `adzuna-${country}-${r.id}` : `adzuna-${Math.random()}`,
      title:        r.title ?? 'Untitled',
      company:      r.company?.display_name ?? 'Unknown company',
      location:     r.location?.display_name ?? country.toUpperCase(),
      description:  (r.description ?? '').slice(0, 600).replace(/\s+/g, ' ').trim(),
      redirect_url: r.redirect_url ?? '',
      salary_min:   r.salary_min,
      salary_max:   r.salary_max,
      created:      r.created ?? new Date().toISOString(),
      country_code: country,
      remote:       remoteOnly || /remote/i.test(r.title ?? '') || /remote/i.test(r.description ?? ''),
      source:       'adzuna',
    }))
  } catch {
    return []
  }
}

async function fetchAdzunaJobs(query: string, userCountry: string): Promise<JobListing[]> {
  const { countries, isSupported } = resolveSearchCountries(userCountry)
  const topCountries = countries.slice(0, 5)

  const tasks: Promise<JobListing[]>[] = [
    ...topCountries.map(c => fetchAdzunaJobsFromCountry(query, c, 2, false)),
    // Extra remote pass for unsupported countries (users in RO, etc. → remote jobs from GB)
    ...(!isSupported ? [fetchAdzunaJobsFromCountry(query, 'gb', 4, true)] : []),
  ]

  const settled = await Promise.allSettled(tasks)
  const listings: JobListing[] = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const label = i < topCountries.length ? topCountries[i] : 'gb-remote'
      console.log(`[adzuna] ${label}: ${r.value.length}`)
      listings.push(...r.value)
    }
  })
  return listings
}

// ── Remotive fetcher (free, no API key, remote-only jobs) ─────────────────────

// Maps our role strings → Remotive category slugs
const REMOTIVE_CATEGORY_MAP: Record<string, string> = {
  'software engineer':  'software-dev',
  'frontend developer': 'software-dev',
  'backend developer':  'software-dev',
  'mobile developer':   'software-dev',
  'data scientist':     'data',
  'data analyst':       'data',
  'devops engineer':    'devops-sysadmin',
  'security engineer':  'software-dev',
  'product manager':    'product',
  'ux designer':        'design',
  'marketing manager':  'marketing',
  'content writer':     'writing',
  'sales manager':      'sales',
  'finance manager':    'finance-legal',
  'hr manager':         'human-resources',
  'project manager':    'project-management',
}

async function fetchRemotiveJobs(domain: string, level: string): Promise<JobListing[]> {
  try {
    const role = buildAdzunaQuery(domain, 'unclear', '') // role without level prefix
    const category = REMOTIVE_CATEGORY_MAP[role] ?? 'software-dev'

    // Build search query: include level if relevant
    const levelMap: Record<string, string> = {
      'student/junior': 'junior',
      'senior':         'senior',
      'executive':      'head',
    }
    const levelTerm = levelMap[level] ?? ''
    const searchQuery = [levelTerm, role].filter(Boolean).join(' ')

    const url = `https://remotive.com/api/remote-jobs?category=${category}&search=${encodeURIComponent(searchQuery)}&limit=6`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.jobs ?? []).slice(0, 6).map((j: any) => ({
      id:           `remotive-${j.id}`,
      title:        j.title ?? 'Untitled',
      company:      j.company_name ?? 'Unknown company',
      location:     j.candidate_required_location || 'Worldwide (Remote)',
      description:  (j.description ?? '')
                      .replace(/<[^>]+>/g, ' ')   // strip HTML
                      .replace(/\s+/g, ' ')
                      .trim()
                      .slice(0, 600),
      redirect_url: j.url ?? '',
      salary_min:   undefined,
      salary_max:   undefined,
      created:      j.publication_date ?? new Date().toISOString(),
      country_code: 'remote',
      remote:       true,
      source:       'remotive',
    }))
  } catch (err) {
    console.error('[remotive] Error:', err)
    return []
  }
}

// ── Combine + deduplicate ─────────────────────────────────────────────────────

async function fetchAllJobs(
  query: string,
  domain: string,
  level: string,
  userCountry: string,
): Promise<JobListing[]> {
  const [adzunaListings, remotiveListings] = await Promise.allSettled([
    fetchAdzunaJobs(query, userCountry),
    fetchRemotiveJobs(domain, level),
  ])

  const all: JobListing[] = [
    ...(adzunaListings.status === 'fulfilled' ? adzunaListings.value : []),
    ...(remotiveListings.status === 'fulfilled' ? remotiveListings.value : []),
  ]

  console.log(`[jobs] Total before dedup — adzuna: ${adzunaListings.status === 'fulfilled' ? adzunaListings.value.length : 0}, remotive: ${remotiveListings.status === 'fulfilled' ? remotiveListings.value.length : 0}`)

  // Deduplicate by normalized title+company
  const seen = new Set<string>()
  return all.filter(j => {
    const key = `${j.title.toLowerCase().trim()}-${j.company.toLowerCase().trim()}`
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
- Location: ${job.location}
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
gaps: exactly 3 short strings (max 10 words) — specific skills or experience missing. Be concrete, not generic.`

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

    const userId    = await getUserIdFromRequest(req)
    const tier      = await getTierForUser(userId)
    const isPro     = tier === 'pro' || tier === 'premium'
    const fitLocked = !isPro

    const detectedCountry = (
      country
      ?? req.headers.get('x-vercel-ip-country')?.toLowerCase()
      ?? req.headers.get('cf-ipcountry')?.toLowerCase()
      ?? 'gb'
    )

    const { isSupported } = resolveSearchCountries(detectedCountry)
    console.log(`[jobs] Country: ${detectedCountry} | supported: ${isSupported}`)

    // Build query + fetch from all sources in parallel
    const query = buildAdzunaQuery(detected_domain, detected_level, trajectory ?? '')
    let listings = await fetchAllJobs(query, detected_domain, detected_level, detectedCountry)
    let queryUsed = query

    // Fallback if still 0 results
    if (listings.length === 0) {
      const fallback = buildFallbackQuery(detected_domain)
      if (fallback !== query) {
        console.log('[jobs] 0 results, trying fallback:', fallback)
        listings = await fetchAllJobs(fallback, detected_domain, detected_level, detectedCountry)
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

    // Analyze fit for up to 8 listings (best mix: prioritize remote for unsupported countries)
    let toAnalyze = listings.slice(0, 10)
    if (!isSupported) {
      // For unsupported countries, put remote jobs first
      const remote = toAnalyze.filter(j => j.remote)
      const local  = toAnalyze.filter(j => !j.remote)
      toAnalyze = [...remote, ...local].slice(0, 8)
    } else {
      toAnalyze = toAnalyze.slice(0, 8)
    }

    const fitResults = await Promise.allSettled(
      toAnalyze.map(listing => analyzeJobFit(listing, body, isPro)),
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
