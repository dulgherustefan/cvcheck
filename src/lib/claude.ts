import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './prompt'
import type { RoastResult } from './types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function getRoast(content: string): Promise<RoastResult> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Here is the content to analyze:\n\n${content.slice(0, 14000)}`,
      },
    ],
  })

  const raw = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let parsed: RoastResult
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${cleaned.slice(0, 200)}`)
  }

  if (
    typeof parsed.total_score !== 'number' ||
    !parsed.scores ||
    !parsed.pull_quote ||
    !Array.isArray(parsed.roast_lines) ||
    !Array.isArray(parsed.tips) ||
    !parsed.one_priority ||
    !parsed.vibe_check
  ) {
    throw new Error('AI response missing required fields')
  }

  const s = parsed.scores
  s.first_impression      = Math.max(0, Math.min(10, Math.round(s.first_impression ?? 0)))
  s.positioning           = Math.max(0, Math.min(10, Math.round(s.positioning ?? 0)))
  s.experience_proof      = Math.max(0, Math.min(20, Math.round(s.experience_proof ?? 0)))
  s.skills_relevance      = Math.max(0, Math.min(10, Math.round(s.skills_relevance ?? 0)))
  s.credibility_signals   = Math.max(0, Math.min(15, Math.round(s.credibility_signals ?? 0)))
  s.structure_readability = Math.max(0, Math.min(15, Math.round(s.structure_readability ?? 0)))
  s.language_quality      = Math.max(0, Math.min(10, Math.round(s.language_quality ?? 0)))
  s.cta_clarity           = Math.max(0, Math.min(10, Math.round(s.cta_clarity ?? 0)))

  parsed.total_score =
    s.first_impression + s.positioning + s.experience_proof +
    s.skills_relevance + s.credibility_signals + s.structure_readability +
    s.language_quality + s.cta_clarity

  const t = parsed.total_score
  parsed.vibe_check =
    t <= 20 ? 'nightmare' :
    t <= 35 ? 'rough' :
    t <= 50 ? 'meh' :
    t <= 65 ? 'decent' :
    t <= 80 ? 'solid' : 'impressive'

  return parsed
}
