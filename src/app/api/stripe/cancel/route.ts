import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    if (token.length < 20 || token.length > 2048) return null
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate the caller. The subscription to cancel is derived from the
    // authenticated user's own record — a client-supplied subscription_id is
    // never trusted, otherwise anyone who learned a `sub_...` id could cancel
    // another user's subscription (IDOR / broken access control).
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: credit, error } = await supabaseAdmin
      .from('credits')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .single()

    if (error || !credit?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    // Cancel at period end — user keeps Premium until the billing period ends
    await stripe.subscriptions.update(credit.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    return NextResponse.json({ cancelled: true })
  } catch (err) {
    console.error('[cancel] Error:', err)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
