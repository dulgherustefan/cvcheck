import Anthropic from '@anthropic-ai/sdk'
import {
  SYSTEM_PROMPT_FREE, SYSTEM_PROMPT_PRO, JD_ADDENDUM_FREE, JD_ADDENDUM_PAID,
  OPTIMIZE_SYSTEM_PROMPT, OPTIMIZE_JD_ADDENDUM,
} from './prompt'
import type { AnalysisResult, CVScores, Rating, Tier } from './types'
import { randomUUID } from 'crypto'

// Lazy client — avoid constructing at module load so a missing key doesn't
// crash the build during page-data collection.
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// Content caps differ by tier to keep the free scan cheap. Paid gets 14000
// (~3500 words) so nothing on a long senior CV is truncated. Free is a teaser
// running on Haiku, so 6000 chars (~1500 words, ~2 pages) bounds input cost.
// The free report only surfaces the top-level read, not a line-by-line pass,
// so the first 2 pages carry everything it needs.
const MAX_CONTENT_CHARS_PAID = 14000
const MAX_CONTENT_CHARS_FREE = 6000

// Free tier runs on Haiku (fast, cheap — keeps the free scan sustainable).
// Paying users get Sonnet, which is materially better at nuanced scoring,
// bullet rewrites, and catching subtle credibility/ATS issues.
const MODEL_FREE = 'claude-haiku-4-5-20251001'
const MODEL_PAID = 'claude-sonnet-4-6'

const RATING_THRESHOLDS: [number, Rating][] = [
  [30,  'needs_work'],
  [50,  'below_average'],
  [65,  'average'],
  [79,  'good'],
  [90,  'strong'],
  [100, 'excellent'],
]

function toRating(score: number): Rating {
  for (const [max, label] of RATING_THRESHOLDS) {
    if (score <= max) return label
  }
  return 'excellent'
}

function clampScores(s: CVScores): CVScores {
  return {
    first_impression:    Math.max(0, Math.min(15, Math.round(s.first_impression    ?? 0))),
    impact_achievements: Math.max(0, Math.min(25, Math.round(s.impact_achievements ?? 0))),
    ats_compatibility:   Math.max(0, Math.min(20, Math.round(s.ats_compatibility   ?? 0))),
    red_flags_score:     Math.max(0, Math.min(20, Math.round(s.red_flags_score     ?? 0))),
    career_story:        Math.max(0, Math.min(10, Math.round(s.career_story        ?? 0))),
    format_scannability: Math.max(0, Math.min(5,  Math.round(s.format_scannability ?? 0))),
    credibility:         Math.max(0, Math.min(5,  Math.round(s.credibility         ?? 0))),
  }
}

function prepareContent(raw: string, maxChars: number): string {
  return raw
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .slice(0, maxChars)
}

function extractJson(raw: string): string {
  // Strip markdown fences
  let s = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  // Find outermost JSON object
  const start = s.indexOf('{')
  const end   = s.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1)
  return s
}

function sanitizeJson(s: string): string {
  return s
    .replace(/,\s*([}\]])/g, '$1')          // trailing commas
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // control chars (keep \n \t)
}

// Em/en dashes are the single most reliable "AI-written" tell. The prompt bans
// them, but the smaller free-tier model still slips occasionally, so we strip
// them deterministically from every text field before the user sees the report.
// A dash used as an aside becomes a comma, which reads naturally in every case.
function dedash<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\s*[—–]\s*/g, ', ').replace(/ ,/g, ',') as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map(dedash) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = dedash(v)
    return out as T
  }
  return value
}

// Job-description caps. The JD is opt-in (most free scans send none, so cost is
// unchanged). When present, free gets a tight cap so the extra input stays small.
const MAX_JD_CHARS_PAID = 4000
const MAX_JD_CHARS_FREE = 1200

export async function getRoast(content: string, tier: Tier, jobDescription?: string): Promise<AnalysisResult> {
  const isPro = tier === 'pro' || tier === 'premium'
  const prepared = prepareContent(content, isPro ? MAX_CONTENT_CHARS_PAID : MAX_CONTENT_CHARS_FREE)

  const jd = (jobDescription ?? '').trim()
  const hasJd = jd.length >= 30   // ignore trivially short pastes
  const preparedJd = hasJd ? prepareContent(jd, isPro ? MAX_JD_CHARS_PAID : MAX_JD_CHARS_FREE) : ''

  // Only pay for the job-match instructions when a job was actually pasted.
  const systemPrompt = (isPro ? SYSTEM_PROMPT_PRO : SYSTEM_PROMPT_FREE)
    + (hasJd ? (isPro ? JD_ADDENDUM_PAID : JD_ADDENDUM_FREE) : '')

  const userMessage = hasJd
    ? `Analyze this CV/portfolio content:\n\n${prepared}\n\n─── TARGET JOB ───\n${preparedJd}`
    : `Analyze this CV/portfolio content:\n\n${prepared}`

  const message = await getClient().messages.create({
    model: isPro ? MODEL_PAID : MODEL_FREE,
    // Kept tight on purpose — this call no longer emits the optimized CV or
    // cover letter (see getOptimizedCv), which were most of the output size
    // and risked pushing analysis past the platform's request timeout.
    max_tokens: isPro ? 4000 : (hasJd ? 3000 : 2500),
    // Low temperature: scoring/JSON should be consistent run-to-run, not creative.
    temperature: 0.3,
    // Cache the (static) system prompt. On the paid Sonnet path this saves ~90%
    // on the prompt's input tokens for repeat analyses; on free Haiku the prompt
    // is below the cache minimum so this is a no-op (no write, no charge).
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  })

  const raw = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  const cleaned = extractJson(raw)

  let parsed: AnalysisResult
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    try {
      parsed = JSON.parse(sanitizeJson(cleaned))
    } catch {
      throw new Error(`Failed to parse AI response: ${cleaned.slice(0, 200)}`)
    }
  }

  if (
    typeof parsed.total_score !== 'number' ||
    !parsed.scores ||
    !parsed.summary ||
    !parsed.first_impression ||
    !Array.isArray(parsed.red_flags) ||
    !Array.isArray(parsed.top_3_actions)
  ) {
    throw new Error('AI response missing required fields')
  }

  parsed.scores = clampScores(parsed.scores)
  const s = parsed.scores
  parsed.total_score =
    s.first_impression +
    s.impact_achievements +
    s.ats_compatibility +
    s.red_flags_score +
    s.career_story +
    s.format_scannability +
    s.credibility

  parsed.rating      = toRating(parsed.total_score) // always overwrite AI rating
  parsed.analysis_id = randomUUID()

  // ── Defensive fallbacks ───────────────────────────────────────────────────
  parsed.red_flags       = Array.isArray(parsed.red_flags)       ? parsed.red_flags       : []
  parsed.top_3_actions   = Array.isArray(parsed.top_3_actions)   ? parsed.top_3_actions   : []
  parsed.buzzwords_detected = Array.isArray(parsed.buzzwords_detected) ? parsed.buzzwords_detected : []
  parsed.quick_win       = typeof parsed.quick_win === 'string'  ? parsed.quick_win       : ''

  parsed.impact                      = parsed.impact                                          ?? {}
  parsed.impact.rewrites             = Array.isArray(parsed.impact?.rewrites)                 ? parsed.impact.rewrites             : []
  parsed.impact.top_weak_bullets     = Array.isArray(parsed.impact?.top_weak_bullets)         ? parsed.impact.top_weak_bullets     : []

  parsed.ats                         = parsed.ats                                              ?? {}
  parsed.ats.formatting_issues       = Array.isArray(parsed.ats?.formatting_issues)           ? parsed.ats.formatting_issues       : []
  parsed.ats.missing_keywords        = Array.isArray(parsed.ats?.missing_keywords)            ? parsed.ats.missing_keywords        : []
  parsed.ats.stale_tech              = Array.isArray(parsed.ats?.stale_tech)                  ? parsed.ats.stale_tech              : []

  parsed.format                      = parsed.format                                           ?? {}
  parsed.format.issues               = Array.isArray(parsed.format?.issues)                   ? parsed.format.issues               : []

  parsed.credibility                 = parsed.credibility                                      ?? {}
  parsed.credibility.signals_present = Array.isArray(parsed.credibility?.signals_present)     ? parsed.credibility.signals_present : []
  parsed.credibility.signals_missing = Array.isArray(parsed.credibility?.signals_missing)     ? parsed.credibility.signals_missing : []

  parsed.career_story                       = parsed.career_story                              ?? {}
  parsed.career_story.gaps_or_transitions   = parsed.career_story?.gaps_or_transitions        ?? ''
  parsed.career_story.narrative_thread      = parsed.career_story?.narrative_thread           ?? 'fragmented'
  parsed.career_story.trajectory_detected   = parsed.career_story?.trajectory_detected        ?? ''

  parsed.first_impression                   = parsed.first_impression                         ?? {}
  parsed.first_impression.tone_signal       = parsed.first_impression?.tone_signal            ?? 'mixed'
  parsed.first_impression.recommended_title = parsed.first_impression?.recommended_title      ?? ''

  // ── Job match (only when a target job was pasted) ─────────────────────────
  if (hasJd && parsed.job_match && typeof parsed.job_match === 'object') {
    const jm = parsed.job_match
    jm.match_score = Math.max(0, Math.min(100, Math.round(Number(jm.match_score) || 0)))
    jm.verdict = ['strong_fit', 'possible_fit', 'weak_fit'].includes(jm.verdict as string)
      ? jm.verdict : (jm.match_score >= 70 ? 'strong_fit' : jm.match_score >= 45 ? 'possible_fit' : 'weak_fit')
    jm.matched_keywords = Array.isArray(jm.matched_keywords) ? jm.matched_keywords.slice(0, 6) : []
    jm.missing_keywords = Array.isArray(jm.missing_keywords) ? jm.missing_keywords.slice(0, 8) : []
    jm.missing_keywords_count = Number.isFinite(jm.missing_keywords_count)
      ? Math.max(0, Math.round(jm.missing_keywords_count))
      : jm.missing_keywords.length
    jm.advice = typeof jm.advice === 'string' ? jm.advice : ''
  } else {
    parsed.job_match = null
  }

  // Optimized CV + cover letter are generated on demand by a separate call
  // (getOptimizedCv below), not as part of this analysis — see that function's
  // comment for why. The frontend fetches them after the user asks for them.
  parsed.optimized_cv = null
  parsed.cover_letter = null

  // Final safety net: strip any em/en dashes the model slipped past the prompt rule.
  return dedash(parsed)
}

// ── Optimized CV + cover letter — separate call, Pro/Premium only ────────────
// Split out from getRoast because a full CV rewrite plus a cover letter was
// the bulk of that call's output tokens, and generating all of it in one shot
// risked running past the deployment platform's request timeout, especially
// on plans with a hard duration cap the app's own maxDuration can't override.
// Kept small and focused so it reliably finishes fast on its own.
export async function getOptimizedCv(
  content: string,
  jobDescription?: string,
): Promise<{ optimized_cv: string | null; cover_letter: string | null }> {
  const prepared = prepareContent(content, MAX_CONTENT_CHARS_PAID)

  const jd = (jobDescription ?? '').trim()
  const hasJd = jd.length >= 30
  const preparedJd = hasJd ? prepareContent(jd, MAX_JD_CHARS_PAID) : ''

  const systemPrompt = OPTIMIZE_SYSTEM_PROMPT + (hasJd ? OPTIMIZE_JD_ADDENDUM : '')
  const userMessage = hasJd
    ? `Rewrite this CV/portfolio content:\n\n${prepared}\n\n─── TARGET JOB ───\n${preparedJd}`
    : `Rewrite this CV/portfolio content:\n\n${prepared}`

  const message = await getClient().messages.create({
    model: MODEL_PAID,
    max_tokens: 2500,
    temperature: 0.3,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  })

  const raw = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  const cleaned = extractJson(raw)

  let parsed: { optimized_cv?: string; cover_letter?: string }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    try {
      parsed = JSON.parse(sanitizeJson(cleaned))
    } catch {
      throw new Error(`Failed to parse AI response: ${cleaned.slice(0, 200)}`)
    }
  }

  return dedash({
    optimized_cv: typeof parsed.optimized_cv === 'string' && parsed.optimized_cv.trim() ? parsed.optimized_cv.trim() : null,
    cover_letter: hasJd && typeof parsed.cover_letter === 'string' && parsed.cover_letter.trim() ? parsed.cover_letter.trim() : null,
  })
}
