import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './prompt'
import type { AnalysisResult, CVScores, Rating } from './types'
import { randomUUID } from 'crypto'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MAX_CONTENT_CHARS = 8000

const RATING_THRESHOLDS: [number, Rating][] = [
  [20,  'needs_work'],
  [40,  'below_average'],
  [60,  'average'],
  [75,  'good'],
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
    first_impression:  Math.max(0, Math.min(10, Math.round(s.first_impression  ?? 0))),
    positioning:       Math.max(0, Math.min(10, Math.round(s.positioning       ?? 0))),
    experience_proof:  Math.max(0, Math.min(20, Math.round(s.experience_proof  ?? 0))),
    skills_relevance:  Math.max(0, Math.min(10, Math.round(s.skills_relevance  ?? 0))),
    credibility:       Math.max(0, Math.min(15, Math.round(s.credibility       ?? 0))),
    structure:         Math.max(0, Math.min(15, Math.round(s.structure         ?? 0))),
    language:          Math.max(0, Math.min(10, Math.round(s.language          ?? 0))),
    contact_cta:       Math.max(0, Math.min(10, Math.round(s.contact_cta       ?? 0))),
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

export async function getRoast(content: string): Promise<AnalysisResult> {
  const prepared = prepareContent(content)

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
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

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

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
    !Array.isArray(parsed.observations) ||
    !Array.isArray(parsed.improvements) ||
    !parsed.top_priority
  ) {
    throw new Error('AI response missing required fields')
  }

  parsed.scores = clampScores(parsed.scores)
  const s = parsed.scores
  parsed.total_score =
    s.first_impression + s.positioning + s.experience_proof +
    s.skills_relevance + s.credibility + s.structure +
    s.language + s.contact_cta

  parsed.rating = toRating(parsed.total_score)
  parsed.analysis_id = randomUUID()

  return parsed
}
