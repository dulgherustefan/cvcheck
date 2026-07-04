import type { MetadataRoute } from 'next'

const BASE = 'https://cvcheck.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Crawl-budget hygiene: keep bots out of JSON API endpoints and
        // auth-gated shells that have no standalone SEO value. /api/og is left
        // crawlable because it serves the Open Graph images referenced in meta
        // tags. /share/* is deliberately NOT disallowed here: those pages carry
        // a noindex meta tag, and blocking crawl would stop Google from ever
        // seeing that directive.
        disallow: [
          '/api/roast',
          '/api/stripe/',
          '/api/user/',
          '/api/jobs/',
          '/api/share',
          '/auth/',
          '/history',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
