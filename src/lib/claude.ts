import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT_FREE, SYSTEM_PROMPT_PRO } from './prompt'
import type { AnalysisResult, CVScores, Rating, Tier } from './types'
import { randomUUID } from 'crypto'

// Lazy client — avoid constructing at module load so a missing key doesn't
// crash the build during page-data collection.
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// A 2-page senior CV easily exceeds 6000 chars (~1500 words); the old limit
// truncated the bottom of longer CVs so the model never scored later roles.
// 14000 chars (~3500 words) covers any realistic CV; input cost is negligible.
const MAX_CONTENT_CHARS = 14000

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

function prepareContent(raw: string): string {
  return raw
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .slice(0, MAX_CONTENT_CHARS)
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

export async function getRoast(content: string, tier: Tier): Promise<AnalysisResult> {
  const prepared = prepareContent(content)
  const isPro = tier === 'pro' || tier === 'premium'
  const systemPrompt = isPro ? SYSTEM_PROMPT_PRO : SYSTEM_PROMPT_FREE

  const message = await getClient().messages.create({
    model: isPro ? MODEL_PAID : MODEL_FREE,
    max_tokens: isPro ? 6000 : 4000,
    // Low temperature: scoring/JSON should be consistent run-to-run, not creative.
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Analyze this CV/portfolio content:\n\n${prepared}`,
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

  return parsed
}
