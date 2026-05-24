import * as cheerio from 'cheerio'

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'svg', 'img',
  'nav', 'footer', 'header', 'aside', 'form', 'button',
])

export async function scrapeUrl(url: string): Promise<string> {
  const normalised = url.startsWith('http') ? url : `https://${url}`

  let html: string
  try {
    const res = await fetch(normalised, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${normalised}`)
    html = await res.text()
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${(err as Error).message}`)
  }

  const $ = cheerio.load(html)

  // ── Pass 1: standard static extraction ──────────────────────────────────────
  const skipForExtraction = new Set([...SKIP_TAGS])
  skipForExtraction.forEach(tag => $(tag).remove())
  $('[aria-hidden="true"]').remove()
  $('[role="banner"], [role="navigation"], [role="contentinfo"]').remove()

  const title = $('title').text().trim()
  const metaDesc =
    $('meta[name="description"]').attr('content')?.trim() ??
    $('meta[property="og:description"]').attr('content')?.trim() ??
    $('meta[name="twitter:description"]').attr('content')?.trim() ??
    ''
  const metaTitle =
    $('meta[property="og:title"]').attr('content')?.trim() ??
    $('meta[name="twitter:title"]').attr('content')?.trim() ??
    ''

  const lines: string[] = []
  if (title) lines.push(`[Title] ${title}`)
  if (metaTitle && metaTitle !== title) lines.push(`[Title] ${metaTitle}`)
  if (metaDesc) lines.push(`[Description] ${metaDesc}`)

  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 2) lines.push(`[${el.tagName.toUpperCase()}] ${text}`)
  })

  $('p, li, td, th, blockquote, [class*="summary"], [class*="about"], [class*="bio"], [class*="experience"], [class*="skill"], [class*="work"], [class*="project"], [class*="role"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 20) lines.push(text)
  })

  // ── Pass 2: SPA fallback — extract from JSON-LD and inline JSON ──────────────
  // Reparse original html to get script tags back
  const $full = cheerio.load(html)
  const isSPA = lines.length < 5

  if (isSPA) {
    // JSON-LD structured data
    $full('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($full(el).html() ?? '')
        const text = JSON.stringify(json)
          .replace(/"[^"]+?":/g, ' ')
          .replace(/[{}[\]"]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text.length > 20) lines.push(text)
      } catch { /* ignore malformed JSON */ }
    })

    // aria-label and alt attributes — often contain real content in SPAs
    $full('[aria-label]').each((_, el) => {
      const text = ($full(el).attr('aria-label') ?? '').trim()
      if (text.length > 10) lines.push(text)
    })
    $full('img[alt]').each((_, el) => {
      const text = ($full(el).attr('alt') ?? '').trim()
      if (text.length > 5) lines.push(text)
    })

    // data attributes that may contain text content
    $full('[data-content], [data-text], [data-title], [data-description]').each((_, el) => {
      const attrs = ['data-content', 'data-text', 'data-title', 'data-description']
      attrs.forEach(attr => {
        const text = ($full(el).attr(attr) ?? '').trim()
        if (text.length > 10) lines.push(text)
      })
    })

    // Last resort: grab all visible text from body ignoring only script/style
    $full('script, style, noscript').remove()
    const bodyText = $full('body').text().replace(/\s+/g, ' ').trim()
    if (bodyText.length > 100) {
      // Chunk it into sentences/phrases
      bodyText.split(/[.!?\n]/).forEach(chunk => {
        const t = chunk.trim()
        if (t.length > 20 && t.length < 500) lines.push(t)
      })
    }
  }

  const extracted = [...new Set(lines)].join('\n')

  if (extracted.trim().length < 50) {
    throw new Error(
      'Could not extract enough content from this URL. ' +
      'This may be a JavaScript-heavy site that requires a browser to render. ' +
      'Try uploading a PDF version instead.'
    )
  }

  return extracted
}
