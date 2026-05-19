// scraper.ts — folosește fetch + node-html-parser în loc de Playwright
// Funcționează local, pe Vercel, oriunde. Rulează: npm install node-html-parser

import { parse } from 'node-html-parser'

export async function scrapeUrl(url: string): Promise<string> {
  let html: string

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    html = await res.text()
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`)
  }

  const root = parse(html)

  // Scoate elementele de zgomot
  for (const tag of ['script', 'style', 'noscript', 'svg', 'canvas', 'iframe', 'nav', 'footer']) {
    root.querySelectorAll(tag).forEach(el => el.remove())
  }

  const parts: string[] = []

  // Title
  const title = root.querySelector('title')?.text?.trim()
  if (title) parts.push(`PAGE TITLE: ${title}`)

  // Meta description
  const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()
  if (metaDesc) parts.push(`META DESCRIPTION: ${metaDesc}`)

  // OG title / description ca fallback
  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim()
  if (ogTitle && ogTitle !== title) parts.push(`OG TITLE: ${ogTitle}`)

  const ogDesc = root.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim()
  if (ogDesc && ogDesc !== metaDesc) parts.push(`OG DESCRIPTION: ${ogDesc}`)

  // H1
  root.querySelectorAll('h1').forEach(h => {
    const t = h.text?.trim()
    if (t) parts.push(`H1: ${t}`)
  })

  // H2
  root.querySelectorAll('h2').forEach(h => {
    const t = h.text?.trim()
    if (t) parts.push(`H2: ${t}`)
  })

  // H3 (primele 8)
  let h3Count = 0
  root.querySelectorAll('h3').forEach(h => {
    if (h3Count >= 8) return
    const t = h.text?.trim()
    if (t) { parts.push(`H3: ${t}`); h3Count++ }
  })

  // Body text — încearcă main/article întâi, fallback la body
  const mainEl = root.querySelector('main') ?? root.querySelector('article') ?? root.querySelector('body')
  const bodyText = mainEl?.text ?? ''

  const cleaned = bodyText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20)
    .slice(0, 120)
    .join('\n')

  if (cleaned) parts.push(`\nCONTENT:\n${cleaned}`)

  const result = parts.join('\n').trim()
  if (!result) return 'No content could be extracted from this page.'
  return result
}
