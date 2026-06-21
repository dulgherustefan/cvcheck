import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { buildConfirmationEmail } from '@/lib/email-templates'
import type { JobsRequest } from '@/lib/types'

export const runtime = 'nodejs'

// Lazily construct Resend — instantiating at module load crashes the build
// when RESEND_API_KEY isn't present (e.g. local/CI without the secret).
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}
const FROM_EMAIL = process.env.RESEND_FROM ?? 'CVCheck <alerts@cvcheck.app>'

// Allowed values for validation
const ALLOWED_ACTIONS = new Set(['subscribe', 'unsubscribe'])

async function getUserIdFromRequest(req: NextRequest): Promise<{ userId: string; email: string } | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')

    // Basic token sanity check — JWTs are at least 20 chars
    if (token.length < 20 || token.length > 2048) return null

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

  const { data, error } = await supabaseAdmin
    .from('job_alerts')
    .select('subscribed, detected_domain, detected_level, created_at, last_sent_at')
    .eq('user_id', auth.userId)
    .single()

  // Don't leak DB error details to client
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found, that's fine
    console.error('[alert GET] DB error:', error.code)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ alert: data ?? null })
}

// ── POST /api/jobs/alert ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await getUserIdFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate Content-Type
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 415 })
  }

  let body: {
    action: 'subscribe' | 'unsubscribe'
    cvMeta?: Pick<JobsRequest, 'detected_domain' | 'detected_level' | 'trajectory' | 'keywords'>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate action field
  if (!body?.action || !ALLOWED_ACTIONS.has(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (body.action === 'unsubscribe') {
    const { error } = await supabaseAdmin
      .from('job_alerts')
      .update({ subscribed: false })
      .eq('user_id', auth.userId)

    if (error) {
      console.error('[alert unsubscribe] DB error:', error.code)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, subscribed: false })
  }

  // subscribe
  if (!body.cvMeta?.detected_domain) {
    return NextResponse.json({ error: 'cvMeta is required for subscribe' }, { status: 400 })
  }

  // Sanitize inputs — strip anything suspicious, cap lengths
  const detected_domain = String(body.cvMeta.detected_domain).slice(0, 100)
  const detected_level  = String(body.cvMeta.detected_level ?? '').slice(0, 50)
  const trajectory      = String(body.cvMeta.trajectory ?? '').slice(0, 500)
  const keywords        = Array.isArray(body.cvMeta.keywords)
    ? body.cvMeta.keywords.slice(0, 30).map(k => String(k).slice(0, 50))
    : []

  const { data: alertRow, error: upsertError } = await supabaseAdmin
    .from('job_alerts')
    .upsert({
      user_id:         auth.userId,
      email:           auth.email,
      detected_domain,
      detected_level,
      trajectory,
      keywords,
      subscribed:      true,
    }, { onConflict: 'user_id' })
    .select('unsubscribe_token')
    .single()

  if (upsertError) {
    console.error('[alert subscribe] Upsert error:', upsertError.code)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const unsubscribeToken = alertRow?.unsubscribe_token ?? ''

  try {
    await getResend().emails.send({
      from:    FROM_EMAIL,
      to:      auth.email,
      subject: '✓ Job alerts activated — CVCheck',
      html:    buildConfirmationEmail({
        email: auth.email,
        domain: detected_domain,
        level:  detected_level,
        unsubscribeToken,
      }),
    })
  } catch (emailErr) {
    // Don't fail the subscription if email fails — log and continue
    console.error('[alert subscribe] Email send failed:', emailErr)
  }

  return NextResponse.json({ ok: true, subscribed: true })
}
