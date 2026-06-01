import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { buildConfirmationEmail } from '@/lib/email-templates'
import type { JobsRequest } from '@/lib/types'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM_EMAIL = process.env.RESEND_FROM ?? 'CVCheck <alerts@cvcheck.app>'

async function getUserIdFromRequest(req: NextRequest): Promise<{ userId: string; email: string } | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user?.email) return null
    return { userId: user.id, email: user.email }
  } catch {
    return null
  }
}

// ── GET /api/jobs/alert ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await getUserIdFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('job_alerts')
    .select('subscribed, detected_domain, detected_level, created_at, last_sent_at')
    .eq('user_id', auth.userId)
    .single()

  return NextResponse.json({ alert: data ?? null })
}

// ── POST /api/jobs/alert ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await getUserIdFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'subscribe' | 'unsubscribe'
    cvMeta?: Pick<JobsRequest, 'detected_domain' | 'detected_level' | 'trajectory' | 'keywords'>
  }

  if (body.action === 'unsubscribe') {
    await supabaseAdmin
      .from('job_alerts')
      .update({ subscribed: false })
      .eq('user_id', auth.userId)
    return NextResponse.json({ ok: true, subscribed: false })
  }

  if (body.action === 'subscribe') {
    if (!body.cvMeta?.detected_domain) {
      return NextResponse.json({ error: 'cvMeta is required for subscribe' }, { status: 400 })
    }

    const { data: alertRow, error: upsertError } = await supabaseAdmin
      .from('job_alerts')
      .upsert({
        user_id:         auth.userId,
        email:           auth.email,
        detected_domain: body.cvMeta.detected_domain,
        detected_level:  body.cvMeta.detected_level,
        trajectory:      body.cvMeta.trajectory ?? '',
        keywords:        body.cvMeta.keywords ?? [],
        subscribed:      true,
      }, { onConflict: 'user_id' })
      .select('unsubscribe_token')
      .single()

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      auth.email,
      subject: '✓ Job alerts activated — CVCheck',
      html:    buildConfirmationEmail({
        email:            auth.email,
        domain:           body.cvMeta.detected_domain,
        level:            body.cvMeta.detected_level,
        unsubscribeToken: alertRow?.unsubscribe_token ?? '',
      }),
    })

    return NextResponse.json({ ok: true, subscribed: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
