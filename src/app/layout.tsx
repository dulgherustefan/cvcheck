import type { Metadata } from 'next'
import { ThemeScript } from '@/components/ThemeScript'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://cvcheck.app'),
  title: {
    default: 'CVCheck — AI Feedback on Your CV & Portfolio',
    template: '%s · CVCheck',
  },
  description:
    'Upload your CV or paste a link. Get an instant AI score, detailed diagnosis, rewritten bullets, and matched jobs in under 30 seconds. Free to try.',
  keywords: [
    'cv checker', 'cv feedback', 'ai cv review', 'resume score',
    'cv score', 'cv analysis', 'ats checker', 'resume feedback',
    'ai resume checker', 'check my cv', 'cv checker online free',
    'job matching cv', 'cv red flags', 'resume bullet rewrite',
  ],
  authors: [{ name: 'CVCheck' }],
  creator: 'CVCheck',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: 'https://cvcheck.app',
  },
  openGraph: {
    type: 'website',
    url: 'https://cvcheck.app',
    siteName: 'CVCheck',
    title: 'CVCheck — AI Feedback on Your CV & Portfolio',
    description:
      'Instant AI score for your CV or portfolio. See what\'s holding you back and get specific improvements in seconds.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CVCheck — AI CV Feedback',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CVCheck — Honest AI Feedback on Your CV',
    description: 'Score your CV out of 100 in seconds. See exactly what to fix.',
    images: ['/og-image.png'],
  },
}

const schemaOrg = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'CVCheck',
  url: 'https://cvcheck.app',
  description:
    'AI-powered CV and portfolio feedback tool. Get a score out of 100, detailed observations, and specific improvements.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'EUR',
      description: 'One free CV analysis with overall score',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '1.99',
      priceCurrency: 'EUR',
      description: 'Full analysis with 7 dimensions, bullet rewrites, red flag fixes, ATS keywords, and priority actions — one-time payment',
    },
    {
      '@type': 'Offer',
      name: 'Premium',
      price: '5.99',
      priceCurrency: 'EUR',
      description: 'Unlimited analyses, full job matching with fit scores, and weekly job alerts',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '5.99',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
  ],
  featureList: [
    'CV score out of 100',
    '7 detailed scoring dimensions',
    'First impression analysis',
    'Red flag detection with severity',
    'ATS compatibility verdict',
    'AI bullet rewrites on your actual text (Pro)',
    'How to fix every red flag (Pro)',
    'Missing ATS keywords for your domain (Pro)',
    'Career gap & seniority analysis (Pro)',
    'Top 3 priority actions with how-to + examples (Pro)',
    'Job matching from Adzuna + Remotive (Premium)',
    'Fit score 0–100 per job with strengths & gaps (Premium)',
    'Weekly job alert emails (Premium)',
    'Unlimited analyses (Premium)',
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="icon" href="/favicon.ico" sizes="any"/>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
        <link rel="manifest" href="/site.webmanifest"/>
        <ThemeScript/>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
