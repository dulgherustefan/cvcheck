import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// GET /api/jobs/alert/unsubscribe?token=<uuid>
// Called from email link — no auth required, just token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse('Invalid unsubscribe link.', { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  const { error } = await supabaseAdmin
    .from('job_alerts')
    .update({ subscribed: false })
    .eq('unsubscribe_token', token)

  if (error) {
    return new NextResponse('Something went wrong. Please try again.', { status: 500, headers: { 'Content-Type': 'text/html' } })
  }

  // Redirect to homepage with a query param that shows a toast
  return NextResponse.redirect(
    new URL('/?unsubscribed=1', req.url),
    { status: 302 }
  )
}
