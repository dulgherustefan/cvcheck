// src/app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Roastd — Brutally honest portfolio feedback',
  description: 'Submit your portfolio, resume, or landing page. Get a brutal AI roast scored out of 100 in under 60 seconds.',
  openGraph: {
    title: 'Roastd — Get your portfolio roasted',
    description: 'Brutally honest AI feedback on your portfolio, resume, or landing page.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
