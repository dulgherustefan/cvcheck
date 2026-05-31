import { NextRequest, NextResponse } from 'next/server'
import { getRoast } from '@/lib/claude'
import { gateResult } from '@/lib/tiers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Tier } from '@/lib/types'


// ── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_ANON      = 10
const RATE_LIMIT_AUTHED    = 30

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// Cleanup old entries every hour to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) rateLimitStore.delete(key)
    }
  }, RATE_LIMIT_WINDOW_MS)
}

export const runtime = 'nodejs'
export const maxDuration = 60

const FREE_SCAN_LIMIT = 1

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
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

function getIdentifier(req: NextRequest, userId: string | null): string {
  if (userId) return `user:${userId}`
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `ip:${ip}`
}

async function checkAndIncrementFreeLimit(identifier: string): Promise<{ allowed: boolean }> {
  const { data: existing } = await supabaseAdmin
    .from('free_scans')
    .select('scan_count')
    .eq('identifier', identifier)
    .single()

  const currentCount = existing?.scan_count ?? 0

  if (currentCount >= FREE_SCAN_LIMIT) {
    return { allowed: false }
  }

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

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    let content = ''
    let source: string | undefined

    const userId = await getUserIdFromRequest(req)
    const tier = await getTierForUser(userId)

    // Rate limiting
    const ip = (() => {
      const fwd = req.headers.get('x-forwarded-for')
      return fwd ? fwd.split(',')[0].trim() : 'unknown'
    })()
    const rlKey   = userId ? `user:${userId}` : `ip:${ip}`
    const rlLimit = userId ? RATE_LIMIT_AUTHED : RATE_LIMIT_ANON
    const rl      = checkRateLimit(rlKey, rlLimit)

    if (!rl.allowed) {
      const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'rate_limit_exceeded', retryAfter: retryAfterSec },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(rlLimit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
          },
        }
      )
    }

    // Free tier — verifică limita
    if (tier === 'free') {
      const identifier = getIdentifier(req, userId)
      const { allowed } = await checkAndIncrementFreeLimit(identifier)
      if (!allowed) {
        return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 })
      }
    }

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const url = formData.get('url') as string | null

      if (file) {
        const { extractPdfText } = await import('@/lib/pdf')
        const buffer = Buffer.from(await file.arrayBuffer())
        content = await extractPdfText(buffer)
        source = file.name
      } else if (url) {
        const { scrapeUrl } = await import('@/lib/scraper')
        content = await scrapeUrl(url)
        source = url
      } else {
        return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 })
      }
    } else {
      const body = await req.json()
      const url: string | undefined = body?.url
      if (!url) {
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
      }
      const { scrapeUrl } = await import('@/lib/scraper')
      content = await scrapeUrl(url)
      source = url
    }

    if (!content || content.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract enough content to analyze' }, { status: 422 })
    }

    const result = await getRoast(content, tier)
    const gated = gateResult(result, tier)

    if (userId) {
      // Salvează roast-ul curent primul — previne race cu claim-ul de mai jos
      const { error: insertError } = await supabaseAdmin
        .from('roasts')
        .upsert({
          id: result.analysis_id,
          user_id: userId,
          source: source ?? null,
          total_score: result.total_score,
          rating: result.rating,
          detected_domain: result.detected_domain,
          detected_level: result.detected_level,
          summary: result.summary,
          scores: result.scores,
          first_impression: result.first_impression,
          impact: result.impact,
          ats: result.ats,
          red_flags: result.red_flags,
          career_story: result.career_story,
          format: result.format,
          credibility: result.credibility,
          top_3_actions: result.top_3_actions,
          observations: null,
          improvements: null,
          top_priority: null,
          tier,
        }, { onConflict: 'id', ignoreDuplicates: true })
      if (insertError) console.error('[roast] Failed to save to Supabase:', insertError)

      // Adoptă analizele anonime făcute de același IP înainte de login
      // Rulează DUPĂ insert ca să nu se claim-uiască roast-ul tocmai creat
      const ip = (() => {
        const fwd = req.headers.get('x-forwarded-for')
        return fwd ? fwd.split(',')[0].trim() : null
      })()
      if (ip) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { error: claimError } = await supabaseAdmin
          .from('roasts')
          .update({ user_id: userId })
          .is('user_id', null)
          .gte('created_at', since)
        if (claimError) console.error('[roast] Failed to claim anonymous roasts:', claimError)
        else console.log(`[roast] Claimed anonymous roasts for user ${userId}`)
      }

      // Daca a folosit creditul pro, reseteaza la free
      if (tier === 'pro') {
        const { error: resetError } = await supabaseAdmin
          .from('credits')
          .update({ plan: 'free', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        if (resetError) console.error('[roast] Failed to reset pro credit:', resetError)
        else console.log(`[roast] Pro credit used and reset to free for user ${userId}`)
      }
    }

    return NextResponse.json(gated)
  } catch (err) {
    console.error('[roast] Error:', err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
