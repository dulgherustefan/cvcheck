export const SCORE_DIMENSIONS = [
  { key: 'first_impression',  label: 'First Impression',  max: 10, desc: 'Headline & hook clarity' },
  { key: 'positioning',       label: 'Positioning',        max: 10, desc: 'Niche & target role clarity' },
  { key: 'experience_proof',  label: 'Experience & Proof', max: 20, desc: 'Results, impact, measurable outcomes' },
  { key: 'skills_relevance',  label: 'Skills',             max: 10, desc: 'Relevance, specificity, currency' },
  { key: 'credibility',       label: 'Credibility',        max: 15, desc: 'Portfolio, GitHub, live work' },
  { key: 'structure',         label: 'Structure',          max: 15, desc: 'Layout & 30-second scannability' },
  { key: 'language',          label: 'Language',           max: 10, desc: 'Grammar, tone, active voice' },
  { key: 'contact_cta',       label: 'Contact & CTA',      max: 10, desc: 'Can a recruiter reach you?' },
] as const
