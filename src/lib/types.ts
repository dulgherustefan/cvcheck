// ── Tiers ────────────────────────────────────────────────────────────────────
export type Tier = 'free' | 'pro' | 'premium'

// ── Sub-structures returned by AI ────────────────────────────────────────────

export interface FirstImpression {
  what_recruiter_sees: string        // "A mid-level frontend dev with React focus"
  current_title: string
  recommended_title: string
  summary_verdict: 'missing' | 'generic' | 'decent' | 'strong'
  tone_signal: 'passive' | 'confident' | 'mixed'
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
  metrics_ratio_verdict: 'below_bar' | 'at_bar' | 'above_bar'  // benchmarked vs seniority
  dominant_pattern: string           // "Lists responsibilities, not results"
  action_verb_quality: 'strong' | 'mixed' | 'weak'
  specificity_score: number          // 1–5
  top_weak_bullets: string[]         // verbatim bullets, preview for upsell
  rewrites: BulletRewrite[]          // 2-3 items — Pro only
}

export interface ATSAnalysis {
  verdict: 'friendly' | 'minor_issues' | 'major_issues'
  title_is_searchable: boolean
  formatting_issues: string[]        // Pro only
  missing_keywords: string[]         // Pro only
  stale_tech: string[]               // visible in free
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
  narrative_thread: 'coherent' | 'fragmented' | 'pivoting'
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
  quick_win?: string           // single highest-impact action, always visible

  scores: CVScores

  first_impression: FirstImpression
  impact: ImpactAnalysis
  ats: ATSAnalysis
  red_flags: RedFlag[]
  buzzwords_detected: { word: string; location: string }[]  // visible in free
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
  job_matching_locked: boolean   // job matching — Premium only
}

export interface AnalysisError {
  error: string
}

// ── Job Matching ──────────────────────────────────────────────────────────────

/** A single job listing returned by Adzuna */
/**
 * Whether the user could actually take this job from where they are:
 *  - in_country      → on-site role physically in the user's country
 *  - remote_eligible → remote role open to the user's country/region (or worldwide)
 *  - relocation      → on-site abroad, or remote restricted to another region
 */
export type JobAvailability = 'in_country' | 'remote_eligible' | 'relocation'

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
  remote?: boolean             // detected from description/title
  country_code?: string        // 2-letter ISO
  availability?: JobAvailability  // computed server-side vs the user's region
  region_label?: string           // short display label, e.g. "Remote" / "Relocation"
}

/** Per-job fit analysis from Claude — all tiers get basic, Pro+ gets full */
export interface JobFitAnalysis {
  fit_score: number            // 0-100
  fit_label: 'strong' | 'good' | 'partial' | 'stretch'
  gaps: string[]               // 3 specific things missing — Pro+ only
  strengths: string[]          // 2-3 things that match well — all tiers
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
  country?: string             // ISO 2-letter, detected from IP
}

/** Applied/saved job stored in localStorage */
export interface SavedJob {
  id: string
  title: string
  company: string
  url: string
  savedAt: string              // ISO date
  status: 'saved' | 'applied'
}

/** Response from /api/jobs */
export interface JobsResponse {
  jobs: JobMatch[]
  fit_locked: boolean          // true = gaps hidden (free), strengths always visible
  query_used: string           // the Adzuna search query, for transparency
  detected_country?: string    // country detected from IP
  available_count?: number     // jobs available in the user's region (in_country + remote_eligible)
}

// ── Legacy aliases ────────────────────────────────────────────────────────────
/** @deprecated use AnalysisResult */
export type RoastResult = AnalysisResult
/** @deprecated use GatedAnalysisResult */
export type GatedRoastResult = GatedAnalysisResult
