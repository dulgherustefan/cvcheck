// ── Tiers ────────────────────────────────────────────────────────────────────
export type Tier = 'free' | 'pro' | 'premium'

// ── Scores ───────────────────────────────────────────────────────────────────
export interface CVScores {
  first_impression: number   // 0-10
  positioning: number        // 0-10
  experience_proof: number   // 0-20
  skills_relevance: number   // 0-10
  credibility: number        // 0-15
  structure: number          // 0-15
  language: number           // 0-10
  contact_cta: number        // 0-10
}

export interface Observation {
  type: 'strength' | 'weakness'
  title: string
  detail: string
}

export interface ImprovementTip {
  area: string
  problem: string
  fix: string
  impact: 'high' | 'medium' | 'low'
}

export type Rating = 'needs_work' | 'below_average' | 'average' | 'good' | 'strong' | 'excellent'

// ── Full result (what AI returns + what we store) ─────────────────────────────
export interface AnalysisResult {
  analysis_id: string
  source?: string
  total_score: number
  rating: Rating
  summary: string
  scores: CVScores
  observations: Observation[]  // 4-5 items
  improvements: ImprovementTip[] // 3-5 items
  top_priority: string
  tier: Tier
}

// ── What the client actually sees (gated by tier) ────────────────────────────
export interface GatedAnalysisResult extends AnalysisResult {
  scores_locked: boolean
  observations_locked_from: number
  improvements_locked_from: number
}

export interface AnalysisError {
  error: string
}

// ── Legacy aliases (for backwards compat if needed) ───────────────────────────
/** @deprecated use AnalysisResult */
export type RoastResult = AnalysisResult
/** @deprecated use GatedAnalysisResult */
export type GatedRoastResult = GatedAnalysisResult
