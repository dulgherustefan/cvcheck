import type { Tier, GatedRoastResult, RoastResult } from './types'

export const TIER_LIMITS = {
  free: {
    roast_lines: 2,
    tips: 1,
    scores_visible: false,
  },
  pro: {
    roast_lines: 5,
    tips: 5,
    scores_visible: true,
  },
  premium: {
    roast_lines: 99,
    tips: 99,
    scores_visible: true,
  },
} as const

// Wraps a full result with gating metadata based on tier
export function gateResult(result: RoastResult, tier: Tier): GatedRoastResult {
  const limits = TIER_LIMITS[tier]
  return {
    ...result,
    tier,
    scores_locked: !limits.scores_visible,
    roast_lines_locked_from: limits.roast_lines,
    tips_locked_from: limits.tips,
  }
}

export const PLANS = {
  pro: {
    name: 'Pro Analysis',
    price: '€2',
    period: 'one-time',
    description: 'Full breakdown for this CV',
    features: [
      'Full score breakdown (8 dimensions)',
      '5 detailed observations',
      '5 improvement tips with rewrites',
      'Priority fix recommendation',
    ],
    cta: 'Get Pro Analysis — €2',
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
