import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { subscription_id } = await req.json()

    if (!subscription_id) {
      return NextResponse.json({ error: 'Missing subscription_id' }, { status: 400 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    // Cancel at period end — user keeps Premium until billing period ends
    await stripe.subscriptions.update(subscription_id, {
      cancel_at_period_end: true,
    })

    return NextResponse.json({ cancelled: true })
  } catch (err) {
    console.error('[cancel] Error:', err)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
