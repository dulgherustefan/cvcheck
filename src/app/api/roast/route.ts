// src/app/api/roast/route.ts
// Endpoint principal: primește un URL, returnează un roast
// POST /api/roast
// Body: { "url": "https://example.com" }

import { NextRequest, NextResponse } from 'next/server'
import { scrapePage } from '@/lib/scraper'
import { getRoast } from '@/lib/claude'
import { RoastResponse } from '@/lib/types'

// Setăm un timeout mai mare pentru Vercel (scraping + AI = lent)
export const maxDuration = 60 // secunde

export async function POST(request: NextRequest): Promise<NextResponse<RoastResponse>> {
  try {
    // ── 1. Validăm input-ul ──────────────────────────────────────
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL lipsă sau invalid' },
        { status: 400 }
      )
    }

    // Normalizăm URL-ul (adăugăm https:// dacă lipsește)
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

    console.log(`[roast] Starting roast for: ${normalizedUrl}`)

    // ── 2. Scraping ──────────────────────────────────────────────
    const scrapeResult = await scrapePage(normalizedUrl)

    if (!scrapeResult.success || !scrapeResult.content) {
      return NextResponse.json(
        { success: false, error: scrapeResult.error || 'Nu am putut accesa pagina' },
        { status: 422 }
      )
    }

    console.log(`[roast] Scraped ${scrapeResult.content.length} chars`)

    // ── 3. Claude API call ───────────────────────────────────────
    const result = await getRoast(normalizedUrl, scrapeResult.content)

    console.log(`[roast] Score: ${result.total_score}/100 (${result.vibe_check})`)

    // ── 4. (Viitor) Salvare în Supabase ─────────────────────────
    // TODO: salvează în DB, scade credit utilizator, returnează ID
    const roast_id = `demo_${Date.now()}` // placeholder până adăugăm Supabase

    return NextResponse.json({
      success: true,
      roast_id,
      result,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Eroare server'
    console.error('[roast] Error:', message)

    return NextResponse.json(
      { success: false, error: 'Ceva a mers prost. Încearcă din nou.' },
      { status: 500 }
    )
  }
}
