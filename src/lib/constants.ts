export const SCORE_DIMENSIONS = [
  { key: 'first_impression',      label: 'First Impression',   max: 10, desc: 'Headline & hook' },
  { key: 'positioning',           label: 'Positioning',        max: 10, desc: 'Niche & target role clarity' },
  { key: 'experience_proof',      label: 'Experience & Proof', max: 20, desc: 'Results, impact, numbers' },
  { key: 'skills_relevance',      label: 'Skills',             max: 10, desc: 'Relevance & specificity' },
  { key: 'credibility_signals',   label: 'Credibility',        max: 15, desc: 'Portfolio, GitHub, links' },
  { key: 'structure_readability', label: 'Structure',          max: 15, desc: 'Layout & scannability' },
  { key: 'language_quality',      label: 'Language',           max: 10, desc: 'Grammar, tone, active voice' },
  { key: 'cta_clarity',           label: 'Contact & CTA',      max: 10, desc: 'Can I reach you?' },
] as const
