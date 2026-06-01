import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { JobListing } from '@/lib/types'

export const runtime = 'nodejs'

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

// ── GET /api/jobs/save?status=saved|applied ───────────────────────────────────
// Returns all saved jobs for the current user, optionally filtered by status

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'saved' | 'applied' | null (all)

  let query = supabaseAdmin
    .from('saved_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })

  if (status === 'saved' || status === 'applied') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}

// ── POST /api/jobs/save ───────────────────────────────────────────────────────
// Body: { action: 'save'|'unsave'|'apply'|'unapply', listing: JobListing }
// - save:    insert row with status='saved'
// - unsave:  delete row (regardless of status)
// - apply:   upsert row with status='applied'
// - unapply: update status back to 'saved' if row exists, else delete

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'save' | 'unsave' | 'apply' | 'unapply'
    listing: JobListing
  }

  const { action, listing } = body
  if (!action || !listing?.id) {
    return NextResponse.json({ error: 'action and listing.id are required' }, { status: 400 })
  }

  if (action === 'unsave') {
    const { error } = await supabaseAdmin
      .from('saved_jobs')
      .delete()
      .eq('user_id', userId)
      .eq('job_id', listing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'unsaved' })
  }

  if (action === 'unapply') {
    // Revert to 'saved' — keep the row but remove applied status
    const { error } = await supabaseAdmin
      .from('saved_jobs')
      .update({ status: 'saved', applied_at: null })
      .eq('user_id', userId)
      .eq('job_id', listing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'unapplied' })
  }

  // save or apply — upsert
  const row = {
    user_id:      userId,
    job_id:       listing.id,
    title:        listing.title,
    company:      listing.company,
    location:     listing.location ?? null,
    redirect_url: listing.redirect_url,
    salary_min:   listing.salary_min ?? null,
    salary_max:   listing.salary_max ?? null,
    remote:       listing.remote ?? false,
    country_code: listing.country_code ?? null,
    status:       action === 'apply' ? 'applied' : 'saved',
    applied_at:   action === 'apply' ? new Date().toISOString() : null,
  }

  const { error } = await supabaseAdmin
    .from('saved_jobs')
    .upsert(row, { onConflict: 'user_id,job_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action: action === 'apply' ? 'applied' : 'saved' })
}
