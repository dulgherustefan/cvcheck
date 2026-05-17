import { chromium } from 'playwright'

export async function scrapeUrl(url: string): Promise<string> {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })

    // Wait a moment for JS rendering
    await page.waitForTimeout(1500)

    // Extract meaningful text content
    const content = await page.evaluate(() => {
      // Remove noise elements
      const noiseSelectors = [
        'script', 'style', 'noscript', 'svg', 'canvas',
        'header nav', 'footer nav', '[aria-hidden="true"]',
        '.cookie-banner', '#cookie-consent', '.ads', '.advertisement',
      ]
      noiseSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove())
      })

      // Get structured content
      const parts: string[] = []

      // Title
      const title = document.title
      if (title) parts.push(`PAGE TITLE: ${title}`)

      // Meta description
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content')
      if (metaDesc) parts.push(`META DESCRIPTION: ${metaDesc}`)

      // H1s
      document.querySelectorAll('h1').forEach(h => {
        const t = h.textContent?.trim()
        if (t) parts.push(`H1: ${t}`)
      })

      // H2s
      document.querySelectorAll('h2').forEach(h => {
        const t = h.textContent?.trim()
        if (t) parts.push(`H2: ${t}`)
      })

      // H3s (first 5)
      let h3Count = 0
      document.querySelectorAll('h3').forEach(h => {
        if (h3Count >= 5) return
        const t = h.textContent?.trim()
        if (t) { parts.push(`H3: ${t}`); h3Count++ }
      })

      // Main body text
      const bodyText = document.body?.innerText || ''
      const cleaned = bodyText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 20)
        .slice(0, 100)
        .join('\n')

      if (cleaned) parts.push(`\nCONTENT:\n${cleaned}`)

      return parts.join('\n')
    })

    return content || 'No content could be extracted from this page.'
  } finally {
    await browser.close()
  }
}
