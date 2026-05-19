import type { Tier, GatedAnalysisResult, AnalysisResult } from './types'

export const TIER_LIMITS = {
  free: {
    observations: 2,
    improvements: 1,
    scores_visible: false,
  },
  pro: {
    observations: 99,
    improvements: 99,
    scores_visible: true,
  },
  premium: {
    observations: 99,
    improvements: 99,
    scores_visible: true,
  },
} as const

export function gateResult(result: AnalysisResult, tier: Tier): GatedAnalysisResult {
  const limits = TIER_LIMITS[tier]
  return {
    ...result,
    tier,
    scores_locked: !limits.scores_visible,
    observations_locked_from: limits.observations,
    improvements_locked_from: limits.improvements,
  }
}

export const PLANS = {
  pro: {
    name: 'Pro Analysis',
    price: '€2',
    period: 'one-time',
    description: 'Full breakdown for this CV',
    features: [
      'Score breakdown across 8 dimensions',
      'All observations (strengths & weaknesses)',
      'All improvement suggestions with rewrites',
      'Top priority recommendation',
    ],
    cta: 'Get Full Analysis — €2',
    stripePriceEnv: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  },
  premium: {
    name: 'Premium',
    price: '€9.99',
    period: 'month',
    description: 'Unlimited analyses',
    features: [
      'Everything in Pro',
      'Unlimited analyses',
      'Saved history',
      'Compare versions over time',
    ],
    cta: 'Start Premium — €9.99/mo',
    stripePriceEnv: 'NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID',
  },
} as const
