import type { Metadata } from 'next'
import './globals.css'
import { ThemeScript } from '@/components/ThemeScript'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'CVCheck — AI feedback on your CV & portfolio',
  description: 'Upload your CV or paste a link. Get a detailed score, honest critique, and actionable tips in seconds. No sugarcoating.',
  openGraph: {
    title: 'CVCheck — AI feedback on your CV & portfolio',
    description: 'Get an honest AI-powered score and critique of your CV, portfolio, or landing page.',
    type: 'website',
    url: 'https://cvcheck.app',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
