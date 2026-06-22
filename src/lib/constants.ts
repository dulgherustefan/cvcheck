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
  dealbreaker: '#FF5F5F',
  warning: '#FFD23F',
  minor: '#9896A8',
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

// Coherent warm→mint ramp anchored on the theme's score colors
// (--score-low #FF5F5F, --score-mid #FFD23F, --score-high #3DFFA0).
export const RATING_COLORS = {
  needs_work:    '#FF5F5F',
  below_average: '#FF8F5F',
  average:       '#FFD23F',
  good:          '#B8E85F',
  strong:        '#5FE8A8',
  excellent:     '#3DFFA0',
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
  friendly:     '#3DFFA0',
  minor_issues: '#FFD23F',
  major_issues: '#FF5F5F',
} as const
