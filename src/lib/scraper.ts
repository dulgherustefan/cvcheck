import * as cheerio from 'cheerio'
import { lookup } from 'dns/promises'

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'svg', 'img',
  'nav', 'footer', 'header', 'aside', 'form', 'button',
])

// ── SSRF protection ───────────────────────────────────────────────────────────

/**
 * Returns true if the IP address is in a private/reserved range.
 * Covers IPv4 and IPv6 loopback, link-local, private, and cloud metadata ranges.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [, a, b, c, d] = v4.map(Number)
    return (
      a === 0 ||                                        // 0.0.0.0/8
      a === 10 ||                                       // 10.0.0.0/8
      a === 127 ||                                      // 127.0.0.0/8 loopback
      (a === 169 && b === 254) ||                       // 169.254.0.0/16 link-local (AWS metadata)
      (a === 172 && b >= 16 && b <= 31) ||              // 172.16.0.0/12
      (a === 192 && b === 168) ||                       // 192.168.0.0/16
      (a === 192 && b === 0 && c === 2) ||              // 192.0.2.0/24 TEST-NET
      (a === 198 && b === 51 && c === 100) ||           // 198.51.100.0/24 TEST-NET-2
      (a === 203 && b === 0 && c === 113) ||            // 203.0.113.0/24 TEST-NET-3
      (a === 100 && b >= 64 && b <= 127) ||             // 100.64.0.0/10 CGNAT
      a >= 224                                          // 224+ multicast/reserved
    )
  }

  // IPv6 checks (normalised to lowercase)
  const ip6 = ip.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  return (
    ip6 === '::1' ||                                    // loopback
    ip6 === '::' ||                                     // unspecified
    ip6.startsWith('fe80:') ||                          // link-local
    ip6.startsWith('fc') ||                             // unique local fc00::/7
    ip6.startsWith('fd') ||                             // unique local fd00::/8
    ip6.startsWith('ff') ||                             // multicast
    ip6.startsWith('::ffff:')                           // IPv4-mapped (re-check below)
  )
}

/**
 * Validates a URL before fetching:
 *  1. Must be http or https
 *  2. Hostname must not be an IP literal in a private range
 *  3. DNS resolves to a public IP (blocks DNS rebinding)
 * Throws a safe error message on failure (no internal detail leaked).
 */
async function validateUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL format.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed.')
  }

  const hostname = parsed.hostname

  // Block IP literals directly in the URL
  if (isPrivateIp(hostname)) {
    throw new Error('URL resolves to a private or reserved address.')
  }

  // DNS resolution check — catches DNS rebinding where a public hostname
  // resolves to a private IP at request time
  try {
    const addresses = await lookup(hostname, { all: true })
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        throw new Error('URL resolves to a private or reserved address.')
      }
    }
  } catch (err) {
    // If the error is our own SSRF error, rethrow it
    if ((err as Error).message.includes('private or reserved')) throw err
    // DNS lookup failure — block to be safe
    throw new Error('Could not resolve URL hostname.')
  }

  return parsed
}

// ── Fetch with redirect safety ─────────────────────────────────────────────────

/**
 * Fetches a URL while validating every redirect hop for SSRF.
 * Native fetch follows redirects automatically without re-checking the
 * destination — we use redirect: 'manual' and follow hops ourselves.
 */
async function safeFetch(url: string, maxRedirects = 5): Promise<string> {
  let currentUrl = url
  let hops       = 0

  while (hops <= maxRedirects) {
    const parsed = await validateUrl(currentUrl)

    const res = await fetch(parsed.toString(), {
      redirect: 'manual',   // never auto-follow — we validate each hop
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control':   'no-cache',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new Error('Redirect with no Location header.')

      // Resolve relative redirects against current URL
      currentUrl = new URL(location, currentUrl).toString()
      hops++
      continue
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  }

  throw new Error('Too many redirects.')
}

// ── Main scraper ──────────────────────────────────────────────────────────────

export async function scrapeUrl(url: string): Promise<string> {
  const normalised = url.startsWith('http') ? url : `https://${url}`

  let html: string
  try {
    html = await safeFetch(normalised)
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

  // ── Pass 2: SPA fallback ─────────────────────────────────────────────────────
  const $full = cheerio.load(html)
  const isSPA = lines.length < 5

  if (isSPA) {
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

    $full('[aria-label]').each((_, el) => {
      const text = ($full(el).attr('aria-label') ?? '').trim()
      if (text.length > 10) lines.push(text)
    })
    $full('img[alt]').each((_, el) => {
      const text = ($full(el).attr('alt') ?? '').trim()
      if (text.length > 5) lines.push(text)
    })

    $full('[data-content], [data-text], [data-title], [data-description]').each((_, el) => {
      const attrs = ['data-content', 'data-text', 'data-title', 'data-description']
      attrs.forEach(attr => {
        const text = ($full(el).attr(attr) ?? '').trim()
        if (text.length > 10) lines.push(text)
      })
    })

    $full('script, style, noscript').remove()
    const bodyText = $full('body').text().replace(/\s+/g, ' ').trim()
    if (bodyText.length > 100) {
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
