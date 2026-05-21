import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How CVCheck handles your data.',
}

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: 58,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 820,
        margin: '0 auto',
        width: '100%',
      }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 9,
          textDecoration: 'none', color: 'inherit',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.025em' }}>CVCheck</span>
        </Link>
        <Link href="/" style={{
          fontSize: 13, color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: 5,
          textDecoration: 'none',
        }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to CVCheck
        </Link>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px 96px' }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--accent-text)', margin: '0 0 10px' }}>
            Legal
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 12px', lineHeight: 1.1 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
            Last updated: May 2026
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <Section title="The short version">
            <p>We don't sell your data. We don't share it with third parties for advertising. We store only what we need to make CVCheck work, and you can delete your account at any time.</p>
          </Section>

          <Section title="What we collect">
            <p>When you use CVCheck, we collect:</p>
            <ul>
              <li><strong>The content you submit</strong> — your CV text (extracted from PDF) or the URL you paste. This is sent to Anthropic's Claude API to generate your analysis.</li>
              <li><strong>Your email address</strong> — if you create an account or sign in with Google. We use this to identify your account, send you your analysis, and contact you if there's an issue with your subscription.</li>
              <li><strong>Payment information</strong> — handled entirely by Stripe. We never see or store your card number.</li>
              <li><strong>Usage data</strong> — which features you use and basic analytics (page views, errors). We use this to improve the product.</li>
              <li><strong>Your IP address</strong> — used to enforce the one free scan limit for users without an account. Not stored long-term.</li>
            </ul>
          </Section>

          <Section title="What we do with it">
            <p>Your CV content is sent to Anthropic's API to generate the analysis. Anthropic does not train models on API inputs — you can read their data usage policy at <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>anthropic.com/legal/privacy</a>.</p>
            <p>We save your analysis results to your account (if you're signed in) so you can access them later. We don't read your analyses, sell them, or use them for any purpose other than showing them to you.</p>
          </Section>

          <Section title="Cookies">
            <p>We use a single session cookie from Supabase to keep you signed in. We don't use advertising cookies, tracking pixels, or third-party analytics beyond basic, privacy-respecting page view counts.</p>
          </Section>

          <Section title="Data storage">
            <p>Your data is stored on Supabase, hosted in the EU. Stripe stores your payment details on their servers, which are PCI-DSS compliant.</p>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul>
              <li>Delete your account and all associated data at any time from your account settings.</li>
              <li>Request a copy of your data by emailing us.</li>
              <li>Ask us to delete specific analyses from your history.</li>
            </ul>
            <p>If you're in the EU, you have rights under GDPR including the right to access, rectify, and erase your personal data.</p>
          </Section>

          <Section title="Children">
            <p>CVCheck is intended for people looking for work, which generally means adults. We don't knowingly collect data from anyone under 16. If you believe a minor has created an account, contact us and we'll delete it promptly.</p>
          </Section>

          <Section title="Changes to this policy">
            <p>If we make significant changes, we'll update the date at the top and, if the changes affect how we use your data, we'll notify you by email.</p>
          </Section>

          <Section title="Contact">
            <p>Questions? Email us at <a href="mailto:hello@cvcheck.app" style={{ color: 'var(--accent-text)' }}>hello@cvcheck.app</a>. We'll get back to you within a few days.</p>
          </Section>
        </div>
      </main>

      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 820, margin: '0 auto', width: '100%',
        fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap', gap: 10,
      }}>
        <span>© 2026 CVCheck</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link href="/" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Home</Link>
          <Link href="/terms" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{
        fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
        color: 'var(--text-primary)', margin: 0,
        paddingBottom: 12, borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {children}
      </div>
    </div>
  )
}
