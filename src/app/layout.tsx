import type { Metadata } from 'next'
import './globals.css'
import { ThemeScript } from '@/components/ThemeScript'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'Roastd',
  description: 'Get an honest, AI-powered score and roast of your portfolio, CV, or landing page. No sugarcoating.',
  openGraph: {
    title: 'Roastd — Get roasted',
    description: 'AI-powered brutal feedback for portfolios, CVs, and landing pages.',
    type: 'website',
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
        <Analytics />
      </body>
    </html>
  )
}
