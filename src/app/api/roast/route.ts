import { NextRequest, NextResponse } from 'next/server'
import { getRoast } from '@/lib/claude'
import { gateResult } from '@/lib/tiers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, makeIdentifier } from '@/lib/ratelimit'
import type { Tier } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const FREE_SCAN_LIMIT   = 1
const MAX_FILE_SIZE     = 5 * 1024 * 1024          // 5 MB
const ALLOWED_MIME      = new Set(['application/pdf', 'text/plain'])
const MIN_CONTENT_CHARS = 50
const MAX_CONTENT_CHARS = 6000                      // matches constants.ts

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
  return gated
}

// ── POST /api/roast ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    let content = ''
    let source: string | undefined

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

    // Free tier scan limit — only for anonymous users
    if (tier === 'free' && !userId) {
      const identifier = getIdentifier(req, userId)
      const { allowed } = await checkAndIncrementFreeLimit(identifier)
      if (!allowed) {
        return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 })
      }
    }

    // Parse request body
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const url  = formData.get('url') as string | null

      if (file) {
        // ── Server-side file validation ──────────────────────────────────────
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })
        }
        // Validate MIME type from the file object (client-provided) AND magic bytes
        if (!ALLOWED_MIME.has(file.type)) {
          return NextResponse.json({ error: 'Only PDF and plain-text files are accepted' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        // Magic-byte check for PDF — %PDF header
        if (file.type === 'application/pdf') {
          if (buffer.length < 4 || buffer.slice(0, 4).toString('ascii') !== '%PDF') {
            return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 })
          }
        }

        if (file.type === 'text/plain') {
          // text/plain is in the allowlist — read it directly instead of
          // running it through the PDF parser (which throws InvalidPDFException)
          content = buffer.toString('utf8')
          source = 'text-upload'
        } else {
          const { extractPdfText } = await import('@/lib/pdf')
          content = await extractPdfText(buffer)
          // Strip source filename to avoid storing user filesystem paths
          source = 'pdf-upload'
        }
      } else if (url) {
        // Basic URL validation
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return NextResponse.json({ error: 'Only http/https URLs are accepted' }, { status: 400 })
        }
        // Block SSRF — private/loopback ranges
        const host = parsed.hostname
        if (
          host === 'localhost' ||
          host.startsWith('127.') ||
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          host.startsWith('172.16.') ||
          host === '0.0.0.0' ||
          host === '[::1]'
        ) {
          return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
        }
        const { scrapeUrl } = await import('@/lib/scraper')
        content = await scrapeUrl(url)
        source = url
      } else {
        return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 })
      }
    } else if (contentType.includes('application/json')) {
      let body: { url?: string }
      try {
        body = await req.json()
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const url = body?.url
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
      }
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ error: 'Only http/https URLs are accepted' }, { status: 400 })
      }
      const host = parsed.hostname
      if (
        host === 'localhost' ||
        host.startsWith('127.') ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.startsWith('172.16.') ||
        host === '0.0.0.0' ||
        host === '[::1]'
      ) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
      }
      const { scrapeUrl } = await import('@/lib/scraper')
      content = await scrapeUrl(url)
      source = url
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
    }

    // Cap content length (prevent huge prompt injection)
    content = content.slice(0, MAX_CONTENT_CHARS)

    if (!content || content.trim().length < MIN_CONTENT_CHARS) {
      return NextResponse.json({ error: 'Could not extract enough content to analyze' }, { status: 422 })
    }

    const result = await getRoast(content, tier)
    const gated  = gateResult(result, tier)

    // ── Critical: strip locked data server-side, don't rely on UI alone ──────
    const safeGated = applyServerSideGating(gated)

    if (userId) {
      const { error: insertError } = await supabaseAdmin
        .from('roasts')
        .upsert({
          id:              result.analysis_id,
          user_id:         userId,
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
    }

    return NextResponse.json(safeGated)
  } catch (err) {
    // Never expose internal error details to client
    console.error('[roast] Unhandled error:', err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
