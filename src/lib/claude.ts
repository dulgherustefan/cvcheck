// src/lib/claude.ts
// Trimite conținutul paginii la Claude și parsează răspunsul JSON

import Anthropic from '@anthropic-ai/sdk'
import { RoastResult } from './types'
import { ROAST_SYSTEM_PROMPT, buildUserMessage } from './prompt'

// Clientul Anthropic se inițializează cu API key din environment
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function getRoast(url: string, scrapedContent: string): Promise<RoastResult> {
  const response = await anthropic.messages.create({
    // Haiku = rapid + ieftin (~$0.01/roast). Schimbă la claude-sonnet-4-6 pentru calitate mai mare.
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: ROAST_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserMessage(url, scrapedContent),
      },
    ],
  })

  // Extragem textul din răspuns
  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('')

  // Curățăm markdown fences dacă Claude le-a adăugat (uneori le adaugă)
  const cleaned = rawText
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  // Parsăm JSON-ul
  let result: RoastResult
  try {
    result = JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude a returnat JSON invalid: ${cleaned.substring(0, 200)}`)
  }

  // Validare de bază — asigurăm că avem câmpurile esențiale
  if (
    typeof result.total_score !== 'number' ||
    !result.pull_quote ||
    !Array.isArray(result.roast_lines) ||
    !result.vibe_check
  ) {
    throw new Error('Răspuns Claude incomplet — lipsesc câmpuri esențiale')
  }

  // Asigurăm că scorul e în range 0-100
  result.total_score = Math.max(0, Math.min(100, result.total_score))

  return result
}
