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
    'Upload your CV or paste a link. Get an instant AI score out of 100, honest observations, and specific improvement tips in under 30 seconds. Free to try.',
  keywords: [
    'cv checker', 'cv feedback', 'ai cv review', 'portfolio feedback',
    'resume score', 'cv score', 'cv analysis', 'portfolio review',
    'cv improvement', 'resume feedback', 'landing page feedback',
    'ai resume checker', 'check my cv', 'cv checker online free',
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
      price: '2',
      priceCurrency: 'EUR',
      description: 'Full analysis with 8 dimensions, all observations and improvement tips',
    },
    {
      '@type': 'Offer',
      name: 'Premium',
      price: '7.99',
      priceCurrency: 'EUR',
      description: 'Unlimited analyses with full access',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '7.99',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
  ],
  featureList: [
    'CV score out of 100',
    '8 detailed scoring dimensions',
    'Strength and weakness observations',
    'Improvement tips with rewrites',
    'Portfolio and LinkedIn URL analysis',
    'PDF upload support',
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
