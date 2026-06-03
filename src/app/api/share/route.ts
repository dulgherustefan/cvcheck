// src/app/api/share/route.ts
// POST /api/share — generates (or returns existing) share_token for a roast
// GET  /api/share?token=... — fetch public data for share page

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Reuse the shared admin client instead of creating a new one per request
// (the original created a new Supabase client on every POST/GET call)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
    // Auth required — anonymous users shouldn't be able to generate share links
    // for arbitrary roast IDs
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { roast_id?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { roast_id } = body
    if (!roast_id || typeof roast_id !== 'string') {
      return NextResponse.json({ error: 'Missing roast_id' }, { status: 400 })
    }

    // Validate roast_id format before querying DB
    if (!UUID_REGEX.test(roast_id)) {
      return NextResponse.json({ error: 'Invalid roast_id' }, { status: 400 })
    }

    // Fetch roast and verify ownership in one query
    // This prevents users from generating share links for other users' roasts
    const { data: roast, error: fetchError } = await supabaseAdmin
      .from('roasts')
      .select('id, user_id, share_token')
      .eq('id', roast_id)
      .eq('user_id', userId)   // ownership check
      .single()

    if (fetchError || !roast) {
      // Return 404 regardless — don't reveal whether roast exists but belongs to someone else
      return NextResponse.json({ error: 'Roast not found' }, { status: 404 })
    }

    // Token already exists — return it
    if (roast.share_token) {
      return NextResponse.json({ token: roast.share_token })
    }

    // Generate new UUID token
    const token = crypto.randomUUID()

    const { error: updateError } = await supabaseAdmin
      .from('roasts')
      .update({ share_token: token })
      .eq('id', roast_id)
      .eq('user_id', userId)  // double-check ownership on update too

    if (updateError) {
      console.error('[share] Failed to save token:', updateError.code)
      return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
    }

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[share] Unexpected error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // Validate token format
  if (!UUID_REGEX.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const { data: roast, error } = await supabaseAdmin
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

  // Strip any locked fields from public share view
  // Share page shows: score, dimensions, first impression — not rewrites/actions details
  const publicRoast = {
    ...roast,
    // Nullify pro-only fields on the public share page
    top_3_actions: Array.isArray(roast.top_3_actions)
      ? roast.top_3_actions.map((a: Record<string, unknown>) => ({
          ...a,
          how:     null,
          example: null,
        }))
      : null,
    red_flags: Array.isArray(roast.red_flags)
      ? roast.red_flags.map((f: Record<string, unknown>) => ({
          ...f,
          how_to_fix: null,
        }))
      : null,
  }

  return NextResponse.json({ roast: publicRoast })
}
