import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { plan, roast_id, user_id } = await req.json()

    if (!plan || !['pro', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // 🔴 Fix: user_id obligatoriu — fără cont nu putem acorda creditul după plată
    if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
      return NextResponse.json(
        { error: 'You must be signed in to purchase a plan.' },
        { status: 401 }
      )
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    const priceId =
      plan === 'pro'
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_PREMIUM_PRICE_ID

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing price ID for plan: ${plan}` },
        { status: 500 }
      )
    }

    // Never trust the client-supplied Origin header for redirect URLs — an
    // attacker could send Origin: https://evil.com and hijack the post-payment
    // redirect. Use the server-configured app URL; fall back to Origin only in dev.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const origin =
      appUrl ??
      (process.env.NODE_ENV !== 'production'
        ? (req.headers.get('origin') ?? 'http://localhost:3000')
        : 'https://cvcheck.app')

    const session = await stripe.checkout.sessions.create({
      mode: plan === 'pro' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?success=1&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelled=1`,
      metadata: {
        plan,
        roast_id: roast_id ?? '',
        user_id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[checkout] Error:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
