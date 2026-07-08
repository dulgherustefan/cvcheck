import { NextRequest, NextResponse } from 'next/server'
import { getRoast } from '@/lib/claude'
import { gateResult } from '@/lib/tiers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, makeIdentifier } from '@/lib/ratelimit'
import { extractContentFromRequest } from '@/lib/extract-content'
import type { Tier } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const FREE_SCAN_LIMIT   = 1
const MIN_CONTENT_CHARS = 50
const MAX_CONTENT_CHARS = 14000                     // matches MAX_CONTENT_CHARS in claude.ts
const MAX_JD_CHARS      = 6000                      // hard cap; claude.ts caps tighter per tier

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getTierForUser(userId: string | null): Promise<Tier> {
  if (!userId) return 'free'
  const { data, error } = await supabaseAdmin
    .from('credits')
    .select('plan')
    .eq('user_id', userId)
    .single()
  if (error || !data) return 'free'
  if (data.plan === 'premium') return 'premium'
  if (data.plan === 'pro') return 'pro'
  return 'free'
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    // Sanity-check token length before hitting Supabase
    if (token.length < 20 || token.length > 2048) return null
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (!fwd) return 'unknown'
  // Take the first IP and strip any port — guard against header stuffing
  const ip = fwd.split(',')[0].trim().split(':')[0]
  // Basic sanity: only allow reasonable IP chars
  return /^[0-9a-fA-F.:]+$/.test(ip) ? ip : 'unknown'
}

function getIdentifier(req: NextRequest, userId: string | null): string {
  if (userId) return `user:${userId}`
  return `ip:${getClientIp(req)}`
}

async function checkAndIncrementFreeLimit(identifier: string): Promise<{ allowed: boolean }> {
  // Atomic check-and-increment via Postgres function — prevents the TOCTOU race
  // where two concurrent requests both pass the limit check. See
  // supabase/migrations/0001_free_scan_atomic.sql
  const { data, error } = await supabaseAdmin.rpc('increment_free_scan', {
    p_identifier: identifier,
    p_limit:      FREE_SCAN_LIMIT,
  })

  if (!error) return { allowed: data === true }

  // Fallback (RPC not deployed yet): conservative non-atomic path. Logs so the
  // migration gets applied; still better than failing the request entirely.
  console.warn('[roast] increment_free_scan RPC unavailable, using fallback:', error.code ?? error.message)
  const { data: existing } = await supabaseAdmin
    .from('free_scans')
    .select('scan_count')
    .eq('identifier', identifier)
    .single()

  const currentCount = existing?.scan_count ?? 0
  if (currentCount >= FREE_SCAN_LIMIT) return { allowed: false }

  if (!existing) {
    await supabaseAdmin.from('free_scans').insert({ identifier, scan_count: 1 })
  } else {
    await supabaseAdmin.from('free_scans').update({
      scan_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    }).eq('identifier', identifier)
  }

  return { allowed: true }
}

// ── Strip gated fields server-side before sending to client ──────────────────
// This is the critical layer — UI flags alone are not enough.
function applyServerSideGating(gated: ReturnType<typeof gateResult>) {
  if (gated.rewrites_locked) {
    if (gated.impact) (gated.impact as unknown as Record<string, unknown>).rewrites = null
  }
  if (gated.how_to_fix_locked && Array.isArray(gated.red_flags)) {
    gated.red_flags = (gated.red_flags as unknown as Record<string, unknown>[]).map((f) => ({
      ...f,
      how_to_fix: null,
    })) as unknown as typeof gated.red_flags
  }
  if (gated.keywords_locked && gated.ats) {
    const ats = gated.ats as unknown as Record<string, unknown>
    ats.missing_keywords    = null
    ats.formatting_issues   = null
  }
  if (gated.gaps_locked && gated.career_story) {
    const cs = gated.career_story as unknown as Record<string, unknown>
    cs.gaps_or_transitions = null
  }
  if (gated.missing_signals_locked && gated.credibility) {
    const cr = gated.credibility as unknown as Record<string, unknown>
    cr.signals_missing = null
  }
  if (gated.actions_locked && Array.isArray(gated.top_3_actions)) {
    gated.top_3_actions = (gated.top_3_actions as unknown as Record<string, unknown>[]).map((a) => ({
      ...a,
      how:     null,
      example: null,
    })) as unknown as typeof gated.top_3_actions
  }
  if (gated.job_match_locked && gated.job_match) {
    const jm = gated.job_match as unknown as Record<string, unknown>
    jm.missing_keywords = null   // the actual list for this job — Pro+
    jm.advice           = null   // tailored advice — Pro+
  }
  if (gated.optimized_cv_locked) {
    (gated as unknown as Record<string, unknown>).optimized_cv = null
  }
  if (gated.cover_letter_locked) {
    (gated as unknown as Record<string, unknown>).cover_letter = null
  }
  return gated
}

// ── POST /api/roast ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req)
    const tier   = await getTierForUser(userId)
    const ip     = getClientIp(req)

    // Rate limiting
    const rlKey = makeIdentifier(userId, ip)
    const rl    = await checkRateLimit(rlKey, !!userId)

    if (!rl.allowed) {
      const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'rate_limit_exceeded', retryAfter: retryAfterSec },
        {
          status: 429,
          headers: {
            'Retry-After':           String(retryAfterSec),
            'X-RateLimit-Limit':     String(rl.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     String(Math.ceil(rl.resetAt / 1000)),
          },
        }
      )
    }

    // Free tier scan limit — applies whether or not the free-tier user is
    // logged in. Previously this only ran for anonymous requests, so any
    // free account (trivial to create) got unlimited full analyses, bounded
    // only by the generic 30/hour rate limit that resets every hour forever.
    if (tier === 'free') {
      const identifier = getIdentifier(req, userId)
      const { allowed } = await checkAndIncrementFreeLimit(identifier)
      if (!allowed) {
        return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 })
      }
    }

    // Parse request body (file/URL → raw text), shared with /api/roast/optimize
    const extracted = await extractContentFromRequest(req)
    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: extracted.status })
    }
    let { content, source, jobDescription } = extracted.data

    // Cap content length (prevent huge prompt injection)
    content = content.slice(0, MAX_CONTENT_CHARS)

    if (!content || content.trim().length < MIN_CONTENT_CHARS) {
      return NextResponse.json({ error: 'Could not extract enough content to analyze' }, { status: 422 })
    }

    // Optional job-target. Cap hard here; claude.ts caps tighter per tier.
    jobDescription = jobDescription.trim().slice(0, MAX_JD_CHARS)

    const result = await getRoast(content, tier, jobDescription || undefined)
    const gated  = gateResult(result, tier)

    // ── Critical: strip locked data server-side, don't rely on UI alone ──────
    const safeGated = applyServerSideGating(gated)

    // Share link works instantly for every result, signed in or not — this is
    // the whole viral loop, so it can't depend on a second authenticated round trip.
    const shareToken = crypto.randomUUID()

    if (userId) {
      const { error: insertError } = await supabaseAdmin
        .from('roasts')
        .upsert({
          id:              result.analysis_id,
          user_id:         userId,
          share_token:     shareToken,
          source:          source ?? null,
          total_score:     result.total_score,
          rating:          result.rating,
          detected_domain: result.detected_domain,
          detected_level:  result.detected_level,
          summary:           result.summary,
          quick_win:         result.quick_win ?? null,
          scores:            result.scores,
          first_impression:  result.first_impression,
          impact:            result.impact,
          ats:               result.ats,
          red_flags:         result.red_flags,
          buzzwords_detected:result.buzzwords_detected ?? [],
          career_story:      result.career_story,
          format:            result.format,
          credibility:       result.credibility,
          top_3_actions:     result.top_3_actions,
          job_match:         result.job_match ?? null,
          optimized_cv:      result.optimized_cv ?? null,
          cover_letter:      result.cover_letter ?? null,
          observations:      null,
          improvements:      null,
          top_priority:      null,
          tier,
        }, { onConflict: 'id', ignoreDuplicates: true })
      if (insertError) console.error('[roast] Failed to save to Supabase:', insertError.code)

      // Adopt anonymous scans from same IP (last 24h)
      if (ip && ip !== 'unknown') {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { error: claimError } = await supabaseAdmin
          .from('roasts')
          .update({ user_id: userId })
          .is('user_id', null)
          .eq('ip_address', ip)
          .gte('created_at', since)
        if (claimError) {
          console.warn('[roast] Could not claim anonymous roasts:', claimError.message)
        }
      }

      // Reset pro credit after use
      if (tier === 'pro') {
        const { error: resetError } = await supabaseAdmin
          .from('credits')
          .update({ plan: 'free', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        if (resetError) console.error('[roast] Failed to reset pro credit:', resetError.code)
      }
    } else if (ip && ip !== 'unknown') {
      // Anonymous scan — still persist a row (free-tier data only, no locked
      // fields exist to leak) so the share link works and it can be claimed
      // if this visitor signs up within 24h.
      const anonRow: Record<string, unknown> = {
        id:              result.analysis_id,
        user_id:         null,
        ip_address:      ip,
        share_token:     shareToken,
        source:          source ?? null,
        total_score:     result.total_score,
        rating:          result.rating,
        detected_domain: result.detected_domain,
        detected_level:  result.detected_level,
        summary:           result.summary,
        quick_win:         result.quick_win ?? null,
        scores:            result.scores,
        first_impression:  result.first_impression,
        impact:            result.impact,
        ats:               result.ats,
        red_flags:         result.red_flags,
        buzzwords_detected:result.buzzwords_detected ?? [],
        career_story:      result.career_story,
        format:            result.format,
        credibility:       result.credibility,
        top_3_actions:     result.top_3_actions,
        job_match:         result.job_match ?? null,
        optimized_cv:      result.optimized_cv ?? null,
        cover_letter:      result.cover_letter ?? null,
        observations:      null,
        improvements:      null,
        top_priority:      null,
        tier,
      }
      const { error: insertError } = await supabaseAdmin
        .from('roasts').upsert(anonRow, { onConflict: 'id', ignoreDuplicates: true })
      if (insertError) {
        console.error('[roast] Failed to save anonymous roast:', insertError.code)
        // ip_address column may not exist yet (pending migration 0003) — retry
        // without it so the share link still works today. 42703 = missing
        // column (direct Postgres); PGRST204 = missing column in PostgREST's
        // schema cache (what Supabase actually returns here).
        if (insertError.code === '42703' || insertError.code === 'PGRST204') {
          delete anonRow.ip_address
          const { error: retryError } = await supabaseAdmin
            .from('roasts').upsert(anonRow, { onConflict: 'id', ignoreDuplicates: true })
          if (retryError) console.error('[roast] Anonymous roast retry also failed:', retryError.code)
        }
      }
    }

    return NextResponse.json({ ...safeGated, share_token: shareToken })
  } catch (err) {
    // Never expose internal error details to client
    console.error('[roast] Unhandled error:', err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
