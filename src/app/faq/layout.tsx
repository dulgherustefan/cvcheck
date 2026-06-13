import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ · Frequently Asked Questions',
  description:
    'Answers to common questions about CVCheck: how the AI scoring works, what is included in Free, Pro, and Premium, how ATS compatibility is measured, and how job matching and job alerts work.',
  alternates: { canonical: 'https://cvcheck.app/faq' },
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
