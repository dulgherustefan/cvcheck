import type { Tier, GatedAnalysisResult, AnalysisResult } from './types'

// ── What each tier sees ───────────────────────────────────────────────────────
//
// FREE  — genuinely useful: score, first impression, impact stats, red flag
//         count+severity, career trajectory, format verdict, ATS verdict.
//         Locked: rewrites, how_to_fix, missing keywords, gaps detail,
//         missing credibility signals, top 3 actions (how+example).
//
// PRO   — everything unlocked for that one scan (€2 one-time)
//
// PREMIUM — same as Pro, unlimited scans + history for all plans

export function gateResult(result: AnalysisResult, tier: Tier): GatedAnalysisResult {
  const isPro = tier === 'pro' || tier === 'premium'

  return {
    ...result,
    tier,

    // These flags drive UI rendering — all false for pro/premium
    rewrites_locked:        !isPro,   // impact.rewrites
    how_to_fix_locked:      !isPro,   // red_flags[].how_to_fix
    keywords_locked:        !isPro,   // ats.missing_keywords + formatting_issues
    gaps_locked:            !isPro,   // career_story.gaps_or_transitions
    missing_signals_locked: !isPro,   // credibility.signals_missing
    actions_locked:         !isPro,   // top_3_actions[].how + example
  }
}

// ── Plans shown in UI ─────────────────────────────────────────────────────────
export const PLANS = {
  pro: {
    name: 'Pro Analysis',
    price: '€2',
    period: 'one-time',
    description: 'Full breakdown for this CV',
    features: [
      'Bullet rewrites — your exact text, improved',
      'How to fix every red flag',
      'Missing ATS keywords for your domain',
      'Career gaps & seniority analysis',
      'Top 3 priority actions with examples',
      'Saved to history',
    ],
    cta: 'Unlock Full Analysis — €2',
    stripePriceEnv: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  },
  premium: {
    name: 'Premium',
    price: '€7.99',
    period: 'month',
    description: 'Unlimited full analyses',
    features: [
      'Everything in Pro',
      'Unlimited analyses',
      'Full history on all scans',
      'Track CV progress over time',
    ],
    cta: 'Start Premium — €7.99/mo',
    stripePriceEnv: 'NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID',
  },
} as const

// ── History access ────────────────────────────────────────────────────────────
// History is available to ALL logged-in users regardless of tier.
// The tier column on each roast row reflects what was purchased for that scan.
export function canAccessHistory(tier: Tier | null, isLoggedIn: boolean): boolean {
  return isLoggedIn
}
