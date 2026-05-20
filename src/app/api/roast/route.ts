import { NextRequest, NextResponse } from 'next/server'
import { getRoast } from '@/lib/claude'
import { gateResult } from '@/lib/tiers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Tier } from '@/lib/types'

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

  // Premium = abonament activ → acces nelimitat la analize noi
  // Pro = one-time per roast → analizele noi sunt tot free
  if (data.plan === 'premium') return 'premium'
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

async function checkAndIncrementFreeLimit(identifier: string): Promise<{ allowed: boolean; count: number }> {
  const { data: existing } = await supabaseAdmin
    .from('free_scans')
    .select('scan_count')
    .eq('identifier', identifier)
    .single()

  const currentCount = existing?.scan_count ?? 0

  if (currentCount >= FREE_SCAN_LIMIT) {
    return { allowed: false, count: currentCount }
  }

  if (!existing) {
    await supabaseAdmin.from('free_scans').insert({
      identifier,
      scan_count: 1,
    })
  } else {
    await supabaseAdmin.from('free_scans').update({
      scan_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    }).eq('identifier', identifier)
  }

  return { allowed: true, count: currentCount + 1 }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    let content = ''
    let source: string | undefined

    const userId = await getUserIdFromRequest(req)
    const tier = await getTierForUser(userId)

    // Verifică limita pentru free tier (inclusiv useri cu plan pro — pro e per-roast)
    if (tier === 'free') {
      const identifier = getIdentifier(req, userId)
      const { allowed } = await checkAndIncrementFreeLimit(identifier)

      if (!allowed) {
        return NextResponse.json(
          { error: 'free_limit_reached' },
          { status: 403 }
        )
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

    const result = await getRoast(content)
    const gated = gateResult(result, tier)

    if (userId) {
      const { error: insertError } = await supabaseAdmin
        .from('roasts')
        .insert({
          id: result.analysis_id,
          user_id: userId,
          source: source ?? null,
          total_score: result.total_score,
          rating: result.rating,
          summary: result.summary,
          scores: result.scores,
          observations: result.observations,
          improvements: result.improvements,
          top_priority: result.top_priority,
        })

      if (insertError) {
        console.error('[roast] Failed to save to Supabase:', insertError)
      }
    }

    return NextResponse.json(gated)
  } catch (err) {
    console.error('[roast] Error:', err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
