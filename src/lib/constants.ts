import type { CVScores } from './types'

// ── Score dimensions — matches CVScores interface ─────────────────────────────
export const SCORE_DIMENSIONS: {
  key: keyof CVScores
  label: string
  max: number
  desc: string
}[] = [
  {
    key: 'first_impression',
    label: 'First Impression',
    max: 15,
    desc: 'What a recruiter understands in 7 seconds',
  },
  {
    key: 'impact_achievements',
    label: 'Impact & Achievements',
    max: 25,
    desc: 'Quantified results, strong verbs, bullet quality',
  },
  {
    key: 'ats_compatibility',
    label: 'ATS Compatibility',
    max: 20,
    desc: 'Keywords, searchable title, parser-friendly format',
  },
  {
    key: 'red_flags_score',
    label: 'Red Flags',
    max: 20,
    desc: 'Absence of dealbreakers, warnings, and polish issues',
  },
  {
    key: 'career_story',
    label: 'Career Story',
    max: 10,
    desc: 'Clear trajectory, progression, seniority match',
  },
  {
    key: 'format_scannability',
    label: 'Format',
    max: 5,
    desc: 'Length, density, section order, consistency',
  },
  {
    key: 'credibility',
    label: 'Credibility',
    max: 5,
    desc: 'Portfolio, brands, proof points, certifications',
  },
]

// ── Red flag severity labels ───────────────────────────────────────────────────
export const RED_FLAG_LABELS = {
  dealbreaker: 'Dealbreaker',
  warning: 'Warning',
  minor: 'Minor',
} as const

export const RED_FLAG_COLORS = {
  dealbreaker: '#D14343',
  warning: '#C7871B',
  minor: '#6B6459',
} as const

// ── Rating labels & colors ────────────────────────────────────────────────────
export const RATING_LABELS = {
  needs_work:    'Needs Work',
  below_average: 'Below Average',
  average:       'Average',
  good:          'Good',
  strong:        'Strong',
  excellent:     'Excellent',
} as const

// Semantic rating ramp, tuned to stay legible on the light (cream) theme
// (--score-low #D14343, --score-mid #C7871B, --score-high #1E9E5A).
export const RATING_COLORS = {
  needs_work:    '#D14343',
  below_average: '#E07B3E',
  average:       '#C7871B',
  good:          '#7A9E2E',
  strong:        '#3E9E6B',
  excellent:     '#1E9E5A',
} as const

// ── Detected level labels ─────────────────────────────────────────────────────
export const LEVEL_LABELS = {
  'student/junior': 'Junior',
  'mid-level':      'Mid-level',
  'senior':         'Senior',
  'executive':      'Executive',
  'unclear':        'Unknown level',
} as const

// ── ATS verdict labels ────────────────────────────────────────────────────────
export const ATS_VERDICT_LABELS = {
  friendly:     'ATS Friendly',
  minor_issues: 'Minor ATS Issues',
  major_issues: 'ATS Problems Detected',
} as const

export const ATS_VERDICT_COLORS = {
  friendly:     '#1E9E5A',
  minor_issues: '#C7871B',
  major_issues: '#D14343',
} as const
