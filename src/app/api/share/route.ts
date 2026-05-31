// src/app/api/share/route.ts
// POST /api/share — generates (or returns existing) share_token for a roast
// Body: { roast_id: string }
// Auth: optional — but roast must belong to the user if user is logged in,
//       OR roast must have no user_id (anonymous scan)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseBrowser } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { roast_id } = await req.json()
    if (!roast_id) {
      return NextResponse.json({ error: 'Missing roast_id' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // Fetch the roast
    const { data: roast, error: fetchError } = await admin
      .from('roasts')
      .select('id, user_id, share_token')
      .eq('id', roast_id)
      .single()

    if (fetchError || !roast) {
      return NextResponse.json({ error: 'Roast not found' }, { status: 404 })
    }

    // If token already exists, return it
    if (roast.share_token) {
      return NextResponse.json({ token: roast.share_token })
    }

    // Generate new UUID token
    const token = crypto.randomUUID()

    const { error: updateError } = await admin
      .from('roasts')
      .update({ share_token: token })
      .eq('id', roast_id)

    if (updateError) {
      console.error('[share] Failed to save token:', updateError)
      return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
    }

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[share] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/share?token=... — fetch public data for a share page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  const { data: roast, error } = await admin
    .from('roasts')
    .select(`
      id, total_score, rating, summary,
      detected_domain, detected_level,
      scores, first_impression, red_flags,
      top_3_actions, share_token
    `)
    .eq('share_token', token)
    .single()

  if (error || !roast) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ roast })
}
