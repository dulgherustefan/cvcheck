// ── Tiers ────────────────────────────────────────────────────────────────────
export type Tier = 'free' | 'pro' | 'premium'

// ── Sub-structures returned by AI ────────────────────────────────────────────

export interface FirstImpression {
  what_recruiter_sees: string        // "A mid-level frontend dev with React focus"
  current_title: string
  recommended_title: string
  summary_verdict: 'missing' | 'generic' | 'decent' | 'strong'
  passes_7_second_test: boolean
}

export interface BulletRewrite {
  original: string
  rewritten: string
  why: string
}

export interface ImpactAnalysis {
  bullets_with_metrics: number
  bullets_without_metrics: number
  dominant_pattern: string           // "Lists responsibilities, not results"
  action_verb_quality: 'strong' | 'mixed' | 'weak'
  rewrites: BulletRewrite[]          // 2-3 items — Pro only
}

export interface ATSAnalysis {
  verdict: 'friendly' | 'minor_issues' | 'major_issues'
  title_is_searchable: boolean
  formatting_issues: string[]        // Pro only
  missing_keywords: string[]         // Pro only
  notes: string
}

export type RedFlagSeverity = 'dealbreaker' | 'warning' | 'minor'

export interface RedFlag {
  flag: string
  severity: RedFlagSeverity
  how_to_fix: string                 // Pro only
}

export interface CareerStory {
  trajectory_detected: string        // "Junior Dev → Senior → seeking management"
  progression_clear: boolean
  gaps_or_transitions: string        // Pro only
  seniority_match: 'matches' | 'overqualified' | 'underqualified' | 'unclear'
}

export interface FormatAnalysis {
  length_verdict: 'too_short' | 'optimal' | 'too_long'
  recommended_pages: number
  issues: string[]
  scannability: 'easy' | 'needs_work' | 'hard'
}

export interface CredibilityAnalysis {
  signals_present: string[]
  signals_missing: string[]          // Pro only
  notes: string
}

export interface PriorityAction {
  action: string
  why_it_matters: string
  how: string                        // Pro only
  example: string                    // Pro only
}

// ── Scores ───────────────────────────────────────────────────────────────────
export interface CVScores {
  first_impression: number     // 0-15
  impact_achievements: number  // 0-25
  ats_compatibility: number    // 0-20
  red_flags_score: number      // 0-20
  career_story: number         // 0-10
  format_scannability: number  // 0-5
  credibility: number          // 0-5
}

export type Rating = 'needs_work' | 'below_average' | 'average' | 'good' | 'strong' | 'excellent'

// ── Full result (what AI returns) ─────────────────────────────────────────────
export interface AnalysisResult {
  analysis_id: string
  source?: string
  total_score: number          // 0-100
  rating: Rating
  detected_domain: string      // "Software Engineering", "Marketing", etc.
  detected_level: 'student/junior' | 'mid-level' | 'senior' | 'executive' | 'unclear'
  summary: string

  scores: CVScores

  first_impression: FirstImpression
  impact: ImpactAnalysis
  ats: ATSAnalysis
  red_flags: RedFlag[]
  career_story: CareerStory
  format: FormatAnalysis
  credibility: CredibilityAnalysis
  top_3_actions: PriorityAction[]

  tier: Tier
}

// ── What the client sees (gated by tier) ─────────────────────────────────────
export interface GatedAnalysisResult extends AnalysisResult {
  // Fields that are fully locked in free
  rewrites_locked: boolean       // impact.rewrites hidden
  how_to_fix_locked: boolean     // red_flags[].how_to_fix hidden
  keywords_locked: boolean       // ats.missing_keywords + formatting_issues hidden
  gaps_locked: boolean           // career_story.gaps_or_transitions hidden
  missing_signals_locked: boolean // credibility.signals_missing hidden
  actions_locked: boolean        // top_3_actions[].how + example hidden
}

export interface AnalysisError {
  error: string
}

// ── Job Matching ──────────────────────────────────────────────────────────────

/** A single job listing returned by Adzuna */
export interface JobListing {
  id: string
  title: string
  company: string
  location: string
  description: string          // trimmed to ~300 chars for display
  redirect_url: string
  salary_min?: number
  salary_max?: number
  created: string              // ISO date
}

/** Per-job fit analysis from Claude — Pro+ only */
export interface JobFitAnalysis {
  fit_score: number            // 0-100
  fit_label: 'strong' | 'good' | 'partial' | 'stretch'
  gaps: string[]               // 3 specific things missing from CV for this role
}

/** Combined job card shown to user */
export interface JobMatch {
  listing: JobListing
  fit: JobFitAnalysis | null   // null = locked (free tier)
}

/** Request body for /api/jobs */
export interface JobsRequest {
  detected_domain: string
  detected_level: string
  trajectory: string           // career_story.trajectory_detected
  keywords: string[]           // ats keywords already present in CV (not missing ones)
  country?: string             // ISO 2-letter, default 'gb'
}

/** Response from /api/jobs */
export interface JobsResponse {
  jobs: JobMatch[]
  fit_locked: boolean          // true = free tier, fit+gaps hidden
  query_used: string           // the Adzuna search query, for transparency
}

// ── Legacy aliases ────────────────────────────────────────────────────────────
/** @deprecated use AnalysisResult */
export type RoastResult = AnalysisResult
/** @deprecated use GatedAnalysisResult */
export type GatedRoastResult = GatedAnalysisResult
