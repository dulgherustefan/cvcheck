import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LANDING_PAGES, getLandingPage } from '@/lib/landing-pages'

// Only the known landing slugs are valid; everything else 404s. Static routes
// (/, /faq, /privacy, /terms, ...) take precedence over this dynamic segment.
export const dynamicParams = false

export function generateStaticParams() {
  return LANDING_PAGES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = getLandingPage(slug)
  if (!page) return {}
  const url = `https://cvcheck.app/${page.slug}`
  // Per-page OG image: distinct social/SERP card carrying this page's own
  // headline instead of the shared generic brand card.
  const ogImage = `/api/og?headline=${encodeURIComponent(page.h1)}&eyebrow=${encodeURIComponent(page.eyebrow)}`
  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: 'CVCheck',
      title: `${page.title} · CVCheck`,
      description: page.metaDescription,
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.h1 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.metaDescription,
      images: [ogImage],
    },
  }
}

export default async function LandingPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getLandingPage(slug)
  if (!page) notFound()

  const url = `https://cvcheck.app/${page.slug}`

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'CVCheck', item: 'https://cvcheck.app' },
      { '@type': 'ListItem', position: 2, name: page.eyebrow, item: url },
    ],
  }

  return (
    <div className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <nav className="navbar">
        <Link href="/" className="navbar-logo">
          <img src="/logo.svg" width="32" height="32" alt="CVCheck" className="logo-img" />
          CVCheck
        </Link>
        <div className="navbar-right">
          <Link href="/" className="nav-btn-accent btn-primary">Check my CV free</Link>
        </div>
      </nav>

      <main className="page-main">
        <section className="landing-section landing-section-base">
          <div className="section-wrap-sm">
            <div className="eyebrow-badge">{page.eyebrow}</div>
            <h1 className="section-h2">{page.h1}</h1>
            <p className="section-body">{page.lead}</p>
            <Link href="/" className="section-btn">{page.ctaLabel}</Link>

            <ul className="landing-bullets" aria-label={page.bulletsLabel}>
              {page.bullets.map((b) => (
                <li key={b.title} className="landing-bullet">
                  <span className="landing-bullet-title">{b.title}</span>
                  <span className="landing-bullet-desc">{b.desc}</span>
                </li>
              ))}
            </ul>

            {page.sections.map((s) => (
              <div key={s.h2} className="landing-block">
                <h2 className="landing-block-h2">{s.h2}</h2>
                {s.body.map((p, i) => (
                  <p key={i} className="landing-block-p">{p}</p>
                ))}
              </div>
            ))}

            <div className="landing-block">
              <h2 className="landing-block-h2">Frequently asked questions</h2>
              {page.faq.map((f) => (
                <div key={f.q} className="landing-faq">
                  <h3 className="landing-faq-q">{f.q}</h3>
                  <p className="landing-faq-a">{f.a}</p>
                </div>
              ))}
            </div>

            <div className="landing-cta-final">
              <h2 className="landing-block-h2">Ready to see your score?</h2>
              <p className="landing-block-p">Free, no signup, and your CV is never used to train AI.</p>
              <Link href="/" className="section-btn">{page.ctaLabel}</Link>
            </div>

            <nav className="landing-related" aria-label="Related tools">
              <span className="landing-related-label">More free tools</span>
              {page.related.map((slug) => {
                const r = getLandingPage(slug)
                if (!r) return null
                return (
                  <Link key={slug} href={`/${slug}`} className="landing-related-link">{r.eyebrow}</Link>
                )
              })}
            </nav>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-bottom">
            <span>© 2025-2026 CVCheck · cvcheck.app</span>
            <div className="footer-bottom-links">
              <Link href="/privacy" className="footer-bottom-link">Privacy</Link>
              <Link href="/terms" className="footer-bottom-link">Terms</Link>
              <Link href="/faq" className="footer-bottom-link">FAQ</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
