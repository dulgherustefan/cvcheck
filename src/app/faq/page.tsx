'use client'

import Link from 'next/link'
import { useState } from 'react'

const faqs = [
  {
    q: 'How does CVCheck score my CV?',
    a: "CVCheck reads your CV the way a recruiter does in the first few seconds, then runs a deeper pass across seven scoring dimensions: first impression, impact and achievements, ATS compatibility, red flags, career story, format and scannability, and credibility. Each dimension has its own weight, and the totals add up to a score out of 100. The same scale is used everywhere on the site: 0 to 30 is needs work, 31 to 50 is below average, 51 to 65 is average, 66 to 79 is good, 80 to 90 is strong, and 91 to 100 is excellent.",
  },
  {
    q: 'Is CVCheck really free?',
    a: 'Yes. The free tier includes your total score, an overall rating, your detected domain and seniority level, a full first impression breakdown, impact statistics, a red flag count with severity, an ATS verdict, a career trajectory summary, and a format verdict. Create a free account and you also get analysis history plus your first two job matches.',
  },
  {
    q: "What's the difference between Pro and Premium?",
    a: 'Pro is a one-time purchase that unlocks the actionable layer on top of the free report: a full ATS-clean CV rewrite you can download, bullet points rewritten from your actual text, a step-by-step fix for every red flag, the ATS keywords you are missing, and your top three priority actions with examples. If you pasted a job, Pro also shows the specific requirements you are missing plus a tailored cover letter built from your real experience. Premium is a monthly subscription. It includes everything in Pro, plus unlimited analyses and full job matching, with a fit score, strengths, and gaps for every job we find, not just the first two.',
  },
  {
    q: 'Can I check my CV against a specific job?',
    a: 'Yes. When you start an analysis there is an optional field where you can paste a job posting. CVCheck then scores how well your CV matches that job, shows the requirements you already cover, and counts the ones you are missing. On the free tier you see the match score and how many requirements are missing. Pro lists the exact missing requirements and adds a cover letter tailored to that job, written from your real experience.',
  },
  {
    q: 'How does the ATS compatibility check work?',
    a: 'ATS compatibility looks at how easily an applicant tracking system can parse your CV: whether your job titles match common search terms, whether your formatting avoids tables, columns, or graphics that confuse parsers, and whether the keywords recruiters search for in your field actually appear in your text. The free report tells you your ATS score and verdict. The Pro report goes further and lists the specific keywords missing for your detected domain and level, along with any formatting issues that could cause a parser to drop sections of your CV.',
  },
  {
    q: 'Where do the job matches come from?',
    a: 'Job listings come from two sources: Adzuna, which covers local and international postings across multiple countries, and Remotive, which is focused entirely on remote roles. CVCheck looks at the domain and seniority level detected from your CV and pulls relevant openings from both sources automatically once your analysis is ready. On Premium, each job comes with a fit score from 0 to 100, a short label, the strengths in your background that match the role, and the gaps you would need to address.',
  },
  {
    q: 'Can I get notified about new matching jobs automatically?',
    a: "Yes. You can subscribe to weekly job alert emails based on the domain, seniority level, and keywords detected from your CV. Alerts go out once a week and only include jobs above a minimum fit score, so you are not flooded with irrelevant postings. Every alert email includes a one-click unsubscribe link, and you can also manage your subscription from your account at any time.",
  },
  {
    q: 'What file formats can I upload?',
    a: 'You can upload a PDF of your CV directly, or paste a link to a portfolio or LinkedIn-style profile page. Uploaded files are checked for type and size before analysis, and only the content needed to evaluate your CV is sent to the AI model. Your file is not shared with third parties or used to train any model.',
  },
  {
    q: 'How long does an analysis take?',
    a: "Most analyses complete in well under a minute. CVCheck reads your CV, runs it through the scoring model, generates the first impression, red flags, and the rest of the report, and then kicks off job matching in the background so results appear almost immediately after the report loads.",
  },
  {
    q: 'Can I see my past analyses later?',
    a: 'Yes, analysis history is available to every account on the free tier, not just paying users. From your history page you can revisit any previous report, see which tier it was run on, and jump straight back into the saved jobs you bookmarked from that analysis.',
  },
  {
    q: 'How do I share my results?',
    a: "Every analysis can be turned into a shareable link from your history. The shared page shows your score, rating, and the parts of the report available on the free tier; anything that requires Pro or Premium is not included in the public link, so your unlock status stays private.",
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <div className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <nav className="navbar">
        <Link href="/" className="navbar-logo">
          <img src="/logo.svg" width="32" height="32" alt="CVCheck" className="logo-img" />
          CVCheck
        </Link>
        <div className="navbar-right">
          <Link href="/" className="nav-btn btn-outline nav-btn-login">Back to CVCheck</Link>
        </div>
      </nav>

      <main className="page-main">
        <section className="landing-section landing-section-base">
          <div className="section-wrap-sm">
            <h1 className="section-h2">Frequently asked questions</h1>
            <p className="section-body">
              Everything you need to know about how CVCheck scores your CV, what each plan
              includes, and how job matching and alerts work. If your question isn&apos;t
              answered here, reach out at{' '}
              <a href="mailto:hello@cvcheck.app" className="footer-bottom-link">hello@cvcheck.app</a>.
            </p>

            <div className="faq-list">
              {faqs.map((item, i) => (
                <article key={item.q} className={`faq-item${openIndex === i ? ' open' : ''}`}>
                  <button
                    className="faq-question"
                    onClick={() => toggle(i)}
                    aria-expanded={openIndex === i}
                  >
                    {item.q}
                    <svg
                      className="faq-chevron"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div className="faq-answer-wrap">
                    <div className="faq-answer-inner">
                      <p className="faq-answer prose-width">{item.a}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
