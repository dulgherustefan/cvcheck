import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// UUID v4 regex for validating user_id from metadata
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('stripe_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single()
  return !!data
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  await supabaseAdmin
    .from('stripe_events')
    .insert({ stripe_event_id: eventId, event_type: eventType, processed_at: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Idempotency: skip if this event was already processed ────────────────────
  // Stripe retries on non-2xx — without this, a payment could be applied twice
  try {
    const alreadyProcessed = await isEventAlreadyProcessed(event.id)
    if (alreadyProcessed) {
      console.log(`[webhook] Duplicate event ${event.id} (${event.type}) — skipping`)
      return NextResponse.json({ received: true })
    }
  } catch (err) {
    // If the stripe_events table doesn't exist yet, log and continue
    // Add migration: CREATE TABLE stripe_events (stripe_event_id TEXT PRIMARY KEY, event_type TEXT, processed_at TIMESTAMPTZ)
    console.warn('[webhook] Could not check idempotency (stripe_events table missing?):', err instanceof Error ? err.message : err)
  }

  console.log('[webhook] Event:', event.type, event.id)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        metadata?: { plan?: string; user_id?: string }
        customer?: string
        subscription?: string
      }
      const { plan, user_id } = session.metadata ?? {}

      if (!user_id || !UUID_REGEX.test(user_id)) {
        console.error('[webhook] checkout.session.completed — invalid or missing user_id in metadata')
        break
      }

      if (plan === 'pro') {
        const { error } = await supabaseAdmin
          .from('credits')
          .upsert(
            {
              user_id,
              plan: 'pro',
              stripe_customer_id: session.customer ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
        if (error) console.error('[webhook] Failed to set pro credit:', error.code)
        else console.log(`[webhook] Pro credit set for user ${user_id}`)
      }

      if (plan === 'premium') {
        const { error } = await supabaseAdmin
          .from('credits')
          .upsert(
            {
              user_id,
              plan: 'premium',
              stripe_customer_id:     session.customer ?? null,
              stripe_subscription_id: session.subscription ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
        if (error) console.error('[webhook] Failed to upsert credits (premium):', error.code)
        else console.log(`[webhook] Credits updated to premium for user ${user_id}`)
      }
      break
    }

    case 'customer.subscription.created': {
      const sub = event.data.object as { status: string; customer: string; id: string }
      if (sub.status === 'active') {
        const { error } = await supabaseAdmin
          .from('credits')
          .update({
            plan: 'premium',
            stripe_subscription_id: sub.id,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer)
        if (error) console.error('[webhook] Failed to activate premium (subscription.created):', error.code)
        else console.log(`[webhook] Premium activated for customer ${sub.customer}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as { status: string; customer: string; id: string }
      if (sub.status === 'active') {
        const { error } = await supabaseAdmin
          .from('credits')
          .update({
            plan: 'premium',
            stripe_subscription_id: sub.id,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer)
        if (error) console.error('[webhook] Failed to renew premium:', error.code)
        else console.log(`[webhook] Premium renewed for customer ${sub.customer}`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as { customer: string }
      const { error } = await supabaseAdmin
        .from('credits')
        .update({
          plan: 'free',
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', sub.customer)
      if (error) console.error('[webhook] Failed to downgrade to free:', error.code)
      else console.log(`[webhook] Downgraded to free for customer ${sub.customer}`)
      break
    }

    default:
      break
  }

  // Mark event as processed after successful handling
  try {
    await markEventProcessed(event.id, event.type)
  } catch (err) {
    console.warn('[webhook] Could not mark event as processed:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ received: true })
}
