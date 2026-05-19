import * as cheerio from 'cheerio'

// Tags whose content we skip entirely — navigation, scripts, ads, etc.
const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'svg', 'img',
  'nav', 'footer', 'header', 'aside', 'form', 'button',
])

/**
 * Fetches a URL and extracts meaningful text content.
 * Works in Vercel serverless (no browser required).
 */
export async function scrapeUrl(url: string): Promise<string> {
  const normalised = url.startsWith('http') ? url : `https://${url}`

  let html: string
  try {
    const res = await fetch(normalised, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CVCheck/1.0; +https://cvcheck.app)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${normalised}`)
    }

    html = await res.text()
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${(err as Error).message}`)
  }

  const $ = cheerio.load(html)

  // Remove noise elements
  SKIP_TAGS.forEach(tag => $(tag).remove())
  $('[aria-hidden="true"]').remove()
  $('[role="banner"], [role="navigation"], [role="contentinfo"]').remove()

  // Extract title + meta description first (high signal, low token cost)
  const title = $('title').text().trim()
  const metaDesc =
    $('meta[name="description"]').attr('content')?.trim() ??
    $('meta[property="og:description"]').attr('content')?.trim() ??
    ''

  // Walk the body and collect text, preserving some structure
  const lines: string[] = []

  if (title) lines.push(`[Title] ${title}`)
  if (metaDesc) lines.push(`[Description] ${metaDesc}`)

  // Headings first — they carry the most signal
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 2) lines.push(`[${el.tagName.toUpperCase()}] ${text}`)
  })

  // Body text — paragraphs, list items, divs with direct text
  $('p, li, td, th, blockquote, [class*="summary"], [class*="about"], [class*="bio"], [class*="experience"], [class*="skill"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 20) lines.push(text)
  })

  const extracted = [...new Set(lines)].join('\n') // dedupe identical lines

  if (extracted.trim().length < 50) {
    throw new Error('Could not extract enough content from this URL')
  }

  return extracted
}
