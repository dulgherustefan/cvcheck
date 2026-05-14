// src/lib/scraper.ts
// Extrage conținutul unei pagini web folosind Playwright
// Rulează DOAR server-side (în API routes), niciodată în browser

import { chromium } from 'playwright'

export interface ScrapeResult {
  success: boolean
  content?: string
  error?: string
}

export async function scrapePage(url: string): Promise<ScrapeResult> {
  // Validare URL înainte să deschidem browserul
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, error: 'URL-ul trebuie să înceapă cu http:// sau https://' }
    }
  } catch {
    return { success: false, error: 'URL invalid' }
  }

  let browser = null

  try {
    // Deschidem Chromium headless (fără interfață grafică)
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    // Setăm un user agent ca să nu fim blocați ca bot
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (compatible; Roastd/1.0; +https://roastd.com/bot)'
    })

    // Navigăm la pagină cu timeout de 15 secunde
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 15000
    })

    // Extragem conținutul relevant (text + structură, fără HTML brut)
    const content = await page.evaluate(() => {
      // Eliminăm elementele care nu sunt utile pentru analiză
      const toRemove = document.querySelectorAll(
        'script, style, noscript, svg, img, video, audio, iframe, nav, footer'
      )
      toRemove.forEach(el => el.remove())

      // Extragem textul structurat
      const title = document.title || ''
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
      const h1s = Array.from(document.querySelectorAll('h1')).map(el => el.textContent?.trim()).filter(Boolean)
      const h2s = Array.from(document.querySelectorAll('h2')).map(el => el.textContent?.trim()).filter(Boolean)
      const bodyText = document.body?.innerText || ''

      // Limităm la 8000 caractere ca să nu depășim contextul Claude
      const truncated = bodyText.length > 8000
        ? bodyText.substring(0, 8000) + '\n[... conținut trunchiat ...]'
        : bodyText

      return `PAGE TITLE: ${title}
META DESCRIPTION: ${metaDesc}
H1 HEADINGS: ${h1s.join(' | ')}
H2 HEADINGS: ${h2s.slice(0, 10).join(' | ')}

FULL PAGE TEXT:
${truncated}`
    })

    await browser.close()
    return { success: true, content }

  } catch (err) {
    await browser?.close()
    const message = err instanceof Error ? err.message : 'Eroare necunoscută'

    // Mesaje de eroare prietenoase pentru cazuri comune
    if (message.includes('timeout')) {
      return { success: false, error: 'Pagina a durat prea mult să se încarce (>15s). Încearcă din nou.' }
    }
    if (message.includes('net::ERR')) {
      return { success: false, error: 'Nu am putut accesa URL-ul. Verifică că site-ul e live.' }
    }

    return { success: false, error: `Eroare scraper: ${message}` }
  }
}
