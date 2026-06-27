import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — CVCheck',
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
      <div style={{
        borderBottom: '0.5px solid var(--border)',
      }}>
        <header style={{
          padding: '0 24px',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 820,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 9,
            textDecoration: 'none', color: 'inherit',
          }}>
            <img src="/logo.svg" width="32" height="32" alt="CVCheck" style={{ display: 'block', borderRadius: 5 }} />
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
      </div>

      {/* Content */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px 96px', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 10px',
          }}>
            Legal
          </p>
          <h1 style={{
            fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em',
            margin: '0 0 12px', lineHeight: 1.1,
            color: 'var(--text-primary)',
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
            Last updated: May 2026
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <Section title="The short version">
            <p>We don&apos;t sell your data. We don&apos;t share it with third parties for advertising. We store only what we need to make CVCheck work, and you can delete your account at any time.</p>
          </Section>

          <Section title="What we collect">
            <p>When you use CVCheck, we collect:</p>
            <ul>
              <li><strong>The content you submit</strong> — your CV text (extracted from PDF or pasted directly). This is sent to Anthropic&apos;s Claude API to generate your analysis and is not stored beyond what&apos;s needed to show you your results.</li>
              <li><strong>Your email address</strong> — if you create an account or sign in with Google. Used to identify your account, send analysis notifications, and contact you about your subscription.</li>
              <li><strong>Payment information</strong> — handled entirely by Stripe. We never see or store your card number or payment details.</li>
              <li><strong>Basic usage data</strong> — which features you use and anonymized page views. Used solely to improve the product.</li>
              <li><strong>Your IP address</strong> — used to enforce the one free analysis limit for anonymous users. Not stored long-term.</li>
            </ul>
          </Section>

          <Section title="What we do with your data">
            <p>Your CV content is sent to Anthropic&apos;s API to generate the analysis. Anthropic does not train models on API inputs — see their policy at{' '}
              <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                anthropic.com/legal/privacy
              </a>.
            </p>
            <p>We save your analysis results to your account (if you&apos;re signed in) so you can access them later from your history. We do not read your analyses, sell them, or use them for any purpose other than displaying them to you.</p>
            <p>We never sell personal data to third parties. We never use your data for advertising purposes.</p>
          </Section>

          <Section title="Legal basis for processing (GDPR)">
            <p>We process your personal data under the following legal bases as defined by GDPR:</p>
            <ul>
              <li><strong>Contractual necessity</strong> — to provide the service you requested (analyzing your CV, managing your account, processing payments).</li>
              <li><strong>Legitimate interest</strong> — to improve the product using anonymized usage data and to prevent abuse.</li>
              <li><strong>Consent</strong> — for optional communications such as job alert emails. You can withdraw consent at any time.</li>
            </ul>
          </Section>

          <Section title="Cookies">
            <p>We use a single session cookie from Supabase to keep you signed in. We do not use advertising cookies, tracking pixels, or invasive third-party analytics. Your theme preference is stored in <code style={{ fontSize: 13, background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 3 }}>localStorage</code> on your device.</p>
          </Section>

          <Section title="Data storage and transfers">
            <p>Your data is stored on Supabase infrastructure hosted in the EU (Frankfurt region). Stripe stores payment details on their PCI-DSS compliant servers. Anthropic processes CV content on their servers — their infrastructure may be located outside the EU, but they are bound by their privacy policy and data processing terms.</p>
          </Section>

          <Section title="Data retention">
            <p>We retain your account data and analyses for as long as your account is active. If you delete your account, we delete your personal data and analyses within 30 days. Anonymized, non-identifiable usage statistics may be retained longer for product improvement.</p>
          </Section>

          <Section title="Your rights (GDPR)">
            <p>As a user in the EU/EEA, you have the following rights:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
              <li><strong>Rectification</strong> — ask us to correct inaccurate data.</li>
              <li><strong>Erasure</strong> — delete your account and all associated data from your account settings, or by emailing us.</li>
              <li><strong>Portability</strong> — request your data in a machine-readable format.</li>
              <li><strong>Objection</strong> — object to processing based on legitimate interest.</li>
              <li><strong>Withdraw consent</strong> — unsubscribe from job alerts at any time via the 1-click link in any email we send.</li>
            </ul>
            <p>To exercise any of these rights, email us at <a href="mailto:hello@cvcheck.app" style={{ color: 'var(--accent)' }}>hello@cvcheck.app</a>. We will respond within 30 days.</p>
            <p>You also have the right to lodge a complaint with your national data protection authority. In Romania, this is the <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>ANSPDCP</a>.</p>
          </Section>

          <Section title="Children">
            <p>CVCheck is a tool for job seekers, intended for users aged 16 and over. We do not knowingly collect data from anyone under 16. If you believe a minor has created an account, contact us and we will delete it promptly.</p>
          </Section>

          <Section title="Changes to this policy">
            <p>If we make significant changes to how we handle your data, we will update the date at the top of this page and notify you by email if you have an account.</p>
          </Section>

          <Section title="Data controller">
            <p>The data controller for CVCheck is the individual operator behind cvcheck.app, based in Romania. For any privacy-related questions or requests, contact us at <a href="mailto:hello@cvcheck.app" style={{ color: 'var(--accent)' }}>hello@cvcheck.app</a>.</p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <div style={{ borderTop: '0.5px solid var(--border)' }}>
        <footer style={{
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          maxWidth: 820, margin: '0 auto', width: '100%',
          boxSizing: 'border-box',
          fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap', gap: 10,
        }}>
          <span>© 2026 CVCheck</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Home</Link>
            <Link href="/terms" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Terms</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{
        fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
        color: 'var(--text-primary)', margin: 0,
        paddingBottom: 12, borderBottom: '0.5px solid var(--border)',
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
