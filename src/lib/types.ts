// ── Tiers ────────────────────────────────────────────────────────────────────
export type Tier = 'free' | 'pro' | 'premium'

// ── Scores ───────────────────────────────────────────────────────────────────
export interface RoastScores {
  first_impression: number      // 0-10
  positioning: number           // 0-10
  experience_proof: number      // 0-20
  skills_relevance: number      // 0-10
  credibility_signals: number   // 0-15
  structure_readability: number // 0-15
  language_quality: number      // 0-10
  cta_clarity: number           // 0-10
}

export interface ImprovementTip {
  area: string
  issue: string
  fix: string
  impact: 'high' | 'medium' | 'low'
}

export type VibeCheck = 'nightmare' | 'rough' | 'meh' | 'decent' | 'solid' | 'impressive'

// ── Full result (what AI returns + what we store) ─────────────────────────────
export interface RoastResult {
  roast_id: string
  source?: string
  total_score: number
  scores: RoastScores
  pull_quote: string
  roast_lines: string[]   // AI always returns 6
  tips: ImprovementTip[]  // AI always returns 5
  one_priority: string
  vibe_check: VibeCheck
  tier: Tier              // what tier was used to generate this
}

// ── What the client actually sees (gated by tier) ────────────────────────────
export interface GatedRoastResult extends RoastResult {
  // These are always present regardless of tier:
  // total_score, vibe_check, pull_quote, source, roast_id

  // Free:   roast_lines[0..1], tips[0..0], scores locked
  // Pro:    roast_lines[0..4], tips[0..4], scores visible
  // Premium: everything
  scores_locked: boolean
  roast_lines_locked_from: number  // index where locking starts
  tips_locked_from: number         // index where locking starts
}

export interface RoastError {
  error: string
}
