import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Basic UUID v4 format check — prevents SQL injection attempts and garbage tokens
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/jobs/alert/unsubscribe?token=<uuid>
// Called from email link — no auth required, just token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  // Validate token format before touching DB
  if (!token || !UUID_REGEX.test(token)) {
    return new NextResponse('Invalid unsubscribe link.', {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Fetch the alert row first to check if token is valid and still active
  const { data: alertRow, error: fetchError } = await supabaseAdmin
    .from('job_alerts')
    .select('id, subscribed')
    .eq('unsubscribe_token', token)
    .single()

  if (fetchError || !alertRow) {
    // Token not found — don't reveal whether it was valid or already used
    // Redirect to homepage anyway (better UX, don't expose info)
    return NextResponse.redirect(
      new URL('/?unsubscribed=1', req.url),
      { status: 302 }
    )
  }

  // Already unsubscribed — idempotent, just redirect
  if (!alertRow.subscribed) {
    return NextResponse.redirect(
      new URL('/?unsubscribed=1', req.url),
      { status: 302 }
    )
  }

  // Unsubscribe and rotate the token so the link can't be reused
  const { error: updateError } = await supabaseAdmin
    .from('job_alerts')
    .update({
      subscribed:        false,
      // Generate a new token so the old email link is invalidated
      unsubscribe_token: crypto.randomUUID(),
    })
    .eq('id', alertRow.id)

  if (updateError) {
    console.error('[unsubscribe] DB update error:', updateError.code)
    return new NextResponse('Something went wrong. Please try again.', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return NextResponse.redirect(
    new URL('/?unsubscribed=1', req.url),
    { status: 302 }
  )
}
