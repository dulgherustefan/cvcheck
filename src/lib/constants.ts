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
  dealbreaker: '#DC2626',
  warning: '#CA8A04',
  minor: '#6B7280',
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

export const RATING_COLORS = {
  needs_work:    '#DC2626',
  below_average: '#EA580C',
  average:       '#CA8A04',
  good:          '#65A30D',
  strong:        '#16A34A',
  excellent:     '#0891B2',
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
  friendly:     '#16A34A',
  minor_issues: '#CA8A04',
  major_issues: '#DC2626',
} as const
