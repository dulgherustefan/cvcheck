import { NextRequest, NextResponse } from 'next/server'
import { getRoast } from '@/lib/claude'
import { gateResult } from '@/lib/tiers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Tier } from '@/lib/types'

export const runtime = 'nodejs'

async function getTierForUser(userId: string | null): Promise<Tier> {
  if (!userId) return 'free'

  const { data, error } = await supabaseAdmin
    .from('credits')
    .select('plan')
    .eq('user_id', userId)
    .single()

  if (error || !data) return 'free'

  const plan = data.plan
  if (plan === 'premium' || plan === 'pro') return plan
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

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    let content = ''

    const userId = await getUserIdFromRequest(req)
    const tier = await getTierForUser(userId)

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const url = formData.get('url') as string | null

      if (file) {
        const { extractTextFromPDF } = await import('@/lib/pdf')
        const buffer = Buffer.from(await file.arrayBuffer())
        content = await extractTextFromPDF(buffer)
      } else if (url) {
        const { scrapeUrl } = await import('@/lib/scraper')
        content = await scrapeUrl(url)
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
    }

    if (!content || content.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract enough content to analyze' }, { status: 422 })
    }

    const result = await getRoast(content)
    const gated = gateResult(result, tier)

    return NextResponse.json(gated)
  } catch (err) {
    console.error('[roast] Error:', err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
