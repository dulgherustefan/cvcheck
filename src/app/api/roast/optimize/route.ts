import { NextRequest, NextResponse } from 'next/server'
import { getOptimizedCv } from '@/lib/claude'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserIdFromRequest } from '@/lib/auth'
import { checkRateLimit, makeIdentifier } from '@/lib/ratelimit'
import { extractContentFromRequest } from '@/lib/extract-content'

export const runtime = 'nodejs'
export const maxDuration = 30

const MIN_CONTENT_CHARS = 50
const MAX_JD_CHARS      = 6000

// ── POST /api/roast/optimize ───────────────────────────────────────────────────
// Generates the optimized CV + cover letter on demand, split out of the main
// /api/roast analysis so that call stays fast (see claude.ts for why). Pro and
// Premium only — the free tier never had access to this content.
//
// ?analysis_id=<uuid> is optional; when present and the caller is signed in,
// the generated text is saved back onto that roast row so it shows up again
// in history without regenerating.

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const { data: credit } = await supabaseAdmin
      .from('credits')
      .select('plan')
      .eq('user_id', userId)
      .single()

    const isPro = credit?.plan === 'pro' || credit?.plan === 'premium'
    if (!isPro) {
      return NextResponse.json({ error: 'This requires Pro or Premium.' }, { status: 403 })
    }

    const rl = await checkRateLimit(makeIdentifier(userId, 'n/a'), true)
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'rate_limit_exceeded', retryAfter: retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      )
    }

    const extracted = await extractContentFromRequest(req)
    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: extracted.status })
    }
    const { content, jobDescription } = extracted.data

    if (!content || content.trim().length < MIN_CONTENT_CHARS) {
      return NextResponse.json({ error: 'Could not extract enough content to analyze' }, { status: 422 })
    }

    const trimmedJd = jobDescription.trim().slice(0, MAX_JD_CHARS)
    const { optimized_cv, cover_letter } = await getOptimizedCv(content, trimmedJd || undefined)

    const analysisId = req.nextUrl.searchParams.get('analysis_id')
    if (analysisId) {
      const { error } = await supabaseAdmin
        .from('roasts')
        .update({ optimized_cv, cover_letter })
        .eq('id', analysisId)
        .eq('user_id', userId)
      if (error) console.warn('[roast/optimize] Could not persist to roast row:', error.code)
    }

    return NextResponse.json({ optimized_cv, cover_letter })
  } catch (err) {
    console.error('[roast/optimize] Unhandled error:', err)
    return NextResponse.json({ error: 'Could not generate this right now. Please try again.' }, { status: 500 })
  }
}
