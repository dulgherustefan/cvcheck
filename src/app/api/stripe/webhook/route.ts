import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('[webhook] Event:', event.type)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        metadata?: { plan?: string; roast_id?: string; user_id?: string }
        customer?: string
        subscription?: string
      }
      const { plan, user_id } = session.metadata ?? {}

      if (plan === 'pro' && user_id) {
        // Seteaza plan: pro → userul are 1 analiza pro disponibila
        // route.ts o va folosi si reseta la free dupa analiza
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
        if (error) console.error('[webhook] Failed to set pro credit:', error)
        else console.log(`[webhook] Pro credit set for user ${user_id}`)
      }

      if (plan === 'premium' && user_id) {
        const { error } = await supabaseAdmin
          .from('credits')
          .upsert(
            {
              user_id,
              plan: 'premium',
              stripe_customer_id: session.customer ?? null,
              stripe_subscription_id: session.subscription ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
        if (error) console.error('[webhook] Failed to upsert credits (premium):', error)
        else console.log(`[webhook] Credits updated to premium for user ${user_id}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as { status: string; customer: string }
      if (sub.status === 'active') {
        const { error } = await supabaseAdmin
          .from('credits')
          .update({ plan: 'premium', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', sub.customer)
        if (error) console.error('[webhook] Failed to renew premium:', error)
        else console.log(`[webhook] Premium renewed for customer ${sub.customer}`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      // Abonamentul a expirat → revine la free
      const sub = event.data.object as { customer: string }
      const { error } = await supabaseAdmin
        .from('credits')
        .update({
          plan: 'free',
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', sub.customer)
      if (error) console.error('[webhook] Failed to downgrade to free:', error)
      else console.log(`[webhook] Downgraded to free for customer ${sub.customer}`)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
