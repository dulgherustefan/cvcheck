import type { MetadataRoute } from 'next'
import { LANDING_PAGES } from '@/lib/landing-pages'

const BASE = 'https://cvcheck.app'

// Stable content date. Bump this when page content meaningfully changes, rather
// than emitting `new Date()` on every build — a lastmod that moves on every
// crawl is a weak signal Google learns to ignore.
const LAST_CONTENT_UPDATE = '2026-07-04'

export default function sitemap(): MetadataRoute.Sitemap {
  const core: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: LAST_CONTENT_UPDATE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/faq`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const landing: MetadataRoute.Sitemap = LANDING_PAGES.map((p) => ({
    url: `${BASE}/${p.slug}`,
    lastModified: LAST_CONTENT_UPDATE,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [...core, ...landing]
}
