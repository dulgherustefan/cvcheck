import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { plan, roast_id, user_id } = await req.json()

    if (!plan || !['pro', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
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

    // Derive origin from the request itself — never undefined
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: plan === 'pro' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?success=1&plan=${plan}`,
      cancel_url: `${origin}/?cancelled=1`,
      metadata: {
        plan,
        roast_id: roast_id ?? '',
        user_id: user_id ?? '',
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
