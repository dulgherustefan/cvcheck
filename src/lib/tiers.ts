import type { Tier, GatedAnalysisResult, AnalysisResult } from './types'

// ── What each tier sees ───────────────────────────────────────────────────────
//
// FREE  — genuinely useful: score, first impression, impact stats, red flag
//         count+severity, career trajectory, format verdict, ATS verdict.
//         Locked: rewrites, how_to_fix, missing keywords, gaps detail,
//         missing credibility signals, top 3 actions (how+example).
//
// PRO   — everything unlocked for that one scan (€1.99 one-time)
//
// PREMIUM — same as Pro, unlimited scans + history for all plans

export function gateResult(result: AnalysisResult, tier: Tier): GatedAnalysisResult {
  const isPro     = tier === 'pro' || tier === 'premium'
  const isPremium = tier === 'premium'

  return {
    ...result,
    tier,

    // These flags drive UI rendering — all false for pro/premium
    rewrites_locked:        !isPro,     // impact.rewrites
    how_to_fix_locked:      !isPro,     // red_flags[].how_to_fix
    keywords_locked:        !isPro,     // ats.missing_keywords + formatting_issues
    gaps_locked:            !isPro,     // career_story.gaps_or_transitions
    missing_signals_locked: !isPro,     // credibility.signals_missing
    actions_locked:         !isPro,     // top_3_actions[].how + example
    job_matching_locked:    !isPremium, // job matching — Premium only
    job_match_locked:       !isPro,     // job_match.missing_keywords + advice
    optimized_cv_locked:    !isPro,     // full optimized CV rewrite
    cover_letter_locked:    !isPro,     // tailored cover letter
  }
}

// ── Intro pricing ─────────────────────────────────────────────────────────────
// Regular price is €5 (Pro) / €10 (Premium). Intro price holds until PROMO_ENDS_AT,
// then checkout and every price display switch to the regular price automatically.
export const PROMO_ENDS_AT = '2026-08-04T23:59:59Z'

export function isPromoActive(): boolean {
  return Date.now() < new Date(PROMO_ENDS_AT).getTime()
}

export function promoDaysLeft(): number {
  return Math.max(0, Math.floor((new Date(PROMO_ENDS_AT).getTime() - Date.now()) / 86_400_000))
}

const REGULAR_PRICE = { pro: '€5', premium: '€10' } as const
const INTRO_PRICE    = { pro: '€1.99', premium: '€5.99' } as const

export function planPrice(plan: 'pro' | 'premium'): string {
  return isPromoActive() ? INTRO_PRICE[plan] : REGULAR_PRICE[plan]
}

// Non-null only while the intro price is active — the "was" price to show struck through.
export function planWasPrice(plan: 'pro' | 'premium'): string | null {
  return isPromoActive() ? REGULAR_PRICE[plan] : null
}

// ── Plans shown in UI ─────────────────────────────────────────────────────────
export function getPlans() {
  const proPrice = planPrice('pro')
  const premiumPrice = planPrice('premium')
  return {
    pro: {
      name: 'Pro Analysis',
      price: proPrice,
      wasPrice: planWasPrice('pro'),
      period: 'one-time',
      description: 'Full breakdown for this CV',
      features: [
        'Optimized CV, ready to download',
        'Cover letter for a job you paste',
        'Bullet rewrites on your exact text, improved',
        'How to fix every red flag',
        'Missing ATS keywords + job requirements',
        'Top 3 priority actions with examples',
        'Saved to history',
      ],
      cta: `Unlock Full Analysis · ${proPrice}`,
      stripePriceEnv: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
    },
    premium: {
      name: 'Premium',
      price: premiumPrice,
      wasPrice: planWasPrice('premium'),
      period: 'month',
      description: 'Unlimited full analyses',
      features: [
        'Everything in Pro',
        'Unlimited analyses',
        'Job matching: live listings matched to your profile',
        'Full history on all scans',
        'Track CV progress over time',
      ],
      cta: `Start Premium · ${premiumPrice}/mo`,
      stripePriceEnv: 'NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID',
    },
  } as const
}

// ── History access ────────────────────────────────────────────────────────────
// History is available to ALL logged-in users regardless of tier.
// The tier column on each roast row reflects what was purchased for that scan.
export function canAccessHistory(tier: Tier | null, isLoggedIn: boolean): boolean {
  return isLoggedIn
}
