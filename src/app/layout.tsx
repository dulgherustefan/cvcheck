import type { Metadata } from 'next'
import { ThemeScript } from '@/components/ThemeScript'
import { Inter, DM_Mono, Bricolage_Grotesque } from 'next/font/google'
import { PageTransition } from '@/components/PageTransition'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

// Display face for headings — a contemporary grotesque with real character,
// deliberately not Inter (used only for body) to give the brand its own voice.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://cvcheck.app'),
  title: {
    default: 'CVCheck · Free CV Checker & AI Feedback',
    template: '%s · CVCheck',
  },
  description:
    'Free CV checker powered by AI. Get a score out of 100, fix red flags, rewrite weak bullets, and match your CV to any job description. In under 30 seconds, no signup.',
  keywords: [
    // High-volume direct intent
    'free cv checker', 'cv checker free', 'check my cv', 'cv checker online',
    'free resume checker', 'resume checker free', 'check my resume',
    // ATS-specific (very high search volume)
    'ats resume checker', 'ats cv checker', 'ats checker free', 'ats resume scan',
    'ats score checker', 'ats friendly resume checker',
    // Score/grade intent
    'cv score', 'resume score', 'rate my resume', 'resume grader', 'cv grader',
    'resume score checker', 'score my resume',
    // Review/feedback intent
    'cv review free', 'resume review free', 'ai cv review', 'ai resume review',
    'cv feedback', 'resume feedback', 'instant cv feedback',
    // Fix/improve intent
    'how to improve cv', 'cv improvement tool', 'resume optimizer free',
    'cv optimizer', 'resume bullet rewrite', 'improve my cv',
    // Job matching
    'cv job matching', 'resume job matching', 'job match cv',
    'match cv to job description', 'tailor cv to job', 'tailor resume to job description',
    // Cover letter (new)
    'ai cover letter generator', 'free cover letter generator', 'cover letter from cv',
    // Long-tail
    'cv checker online free no signup', 'ai powered cv checker',
    'free resume analysis', 'cv analysis tool free',
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
    title: 'CVCheck · Free CV Checker & AI Feedback',
    description:
      'Get an honest AI score for your CV — free. See exactly what recruiters notice, what to fix, and land more interviews.',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'CVCheck — Free AI CV Checker',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CVCheck · Free CV Checker',
    description: 'Score your CV out of 100 for free. See exactly what to fix and get more interviews.',
    images: ['/api/og'],
  },
}

const schemaOrg = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'CVCheck',
  url: 'https://cvcheck.app',
  description:
    'Free AI-powered CV checker. Get a score out of 100, see red flags, rewrite weak bullets, and match with relevant jobs.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Free CV check with overall score, first impression, red flags, and ATS verdict',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '1.99',
      priceCurrency: 'EUR',
      description: 'Full CV analysis with bullet rewrites, red flag fixes, missing ATS keywords, and priority actions — one-time payment',
    },
    {
      '@type': 'Offer',
      name: 'Premium',
      price: '5.99',
      priceCurrency: 'EUR',
      description: 'Unlimited CV checks, full job matching with fit scores, and weekly job alert emails',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '5.99',
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    },
  ],
  featureList: [
    'Free CV score out of 100',
    'Free ATS compatibility check',
    '7 detailed scoring dimensions',
    'First impression analysis',
    'Red flag detection with severity',
    'AI bullet rewrites on your actual text (Pro)',
    'How to fix every red flag (Pro)',
    'Missing ATS keywords for your field (Pro)',
    'Career gap and seniority analysis (Pro)',
    'Top 3 priority actions with examples (Pro)',
    'Job matching from Adzuna and Remotive (Premium)',
    'Fit score per job with strengths and gaps (Premium)',
    'Weekly job alert emails (Premium)',
    'Unlimited CV checks (Premium)',
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
      <body className={`${inter.variable} ${dmMono.variable} ${bricolage.variable}`}><PageTransition>{children}</PageTransition></body>
    </html>
  )
}
