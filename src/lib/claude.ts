import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT_FREE, SYSTEM_PROMPT_PRO } from './prompt'
import type { AnalysisResult, CVScores, Rating, Tier } from './types'
import { randomUUID } from 'crypto'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MAX_CONTENT_CHARS = 6000

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

export async function getRoast(content: string, tier: Tier): Promise<AnalysisResult> {
  const prepared = prepareContent(content)
  const isPro = tier === 'pro' || tier === 'premium'
  const systemPrompt = isPro ? SYSTEM_PROMPT_PRO : SYSTEM_PROMPT_FREE

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: isPro ? 6000 : 3000,
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

  // Extract JSON robustly — find first { and last }
  const cleaned = (() => {
    let s = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const start = s.indexOf('{')
    const end   = s.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1)
    return s
  })()

  let parsed: AnalysisResult
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Failed to parse AI response: ${cleaned.slice(0, 200)}`)
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

  parsed.rating = toRating(parsed.total_score)
  parsed.analysis_id = randomUUID()

  // Defensive fallbacks — AI occasionally omits arrays
  parsed.red_flags                     = Array.isArray(parsed.red_flags)                          ? parsed.red_flags                     : []
  parsed.top_3_actions                 = Array.isArray(parsed.top_3_actions)                      ? parsed.top_3_actions                 : []
  parsed.impact                        = parsed.impact                                             ?? {}
  parsed.impact.rewrites               = Array.isArray(parsed.impact?.rewrites)                   ? parsed.impact.rewrites               : []
  parsed.ats                           = parsed.ats                                                ?? {}
  parsed.ats.formatting_issues         = Array.isArray(parsed.ats?.formatting_issues)             ? parsed.ats.formatting_issues         : []
  parsed.ats.missing_keywords          = Array.isArray(parsed.ats?.missing_keywords)              ? parsed.ats.missing_keywords          : []
  parsed.format                        = parsed.format                                             ?? {}
  parsed.format.issues                 = Array.isArray(parsed.format?.issues)                     ? parsed.format.issues                 : []
  parsed.credibility                   = parsed.credibility                                        ?? {}
  parsed.credibility.signals_present   = Array.isArray(parsed.credibility?.signals_present)       ? parsed.credibility.signals_present   : []
  parsed.credibility.signals_missing   = Array.isArray(parsed.credibility?.signals_missing)       ? parsed.credibility.signals_missing   : []
  parsed.career_story                  = parsed.career_story                                       ?? {}
  parsed.career_story.gaps_or_transitions = parsed.career_story?.gaps_or_transitions              ?? ''

  return parsed
}
