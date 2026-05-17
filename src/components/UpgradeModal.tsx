'use client'

import { useState } from 'react'
import { PLANS } from '@/lib/tiers'
import { createSupabaseBrowser } from '@/lib/supabase'

interface Props {
  onClose: () => void
  roastId?: string
  userId?: string
  userEmail?: string
}

type Step = 'plans' | 'login'

export function UpgradeModal({ onClose, roastId, userId, userEmail }: Props) {
  const [loading, setLoading] = useState<'pro' | 'premium' | null>(null)
  const [step, setStep] = useState<Step>('plans')
  const [pendingPlan, setPendingPlan] = useState<'pro' | 'premium' | null>(null)

  // Login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const supabase = createSupabaseBrowser()

  const checkout = async (plan: 'pro' | 'premium') => {
    if (!userId) {
      setPendingPlan(plan)
      setStep('login')
      return
    }
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, roast_id: roastId, user_id: userId }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error(err)
      setLoading(null)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true); setAuthError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setAuthError(error.message); setGoogleLoading(false) }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(''); setAuthLoading(true)
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
    } else {
      if (password.length < 8) { setAuthError('Password must be at least 8 characters.'); setAuthLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
    }
    setAuthLoading(false)
    // After auth, page will re-render with userId; user can click buy again
    setStep('plans')
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        <button style={s.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* ── PLANS STEP ── */}
        {step === 'plans' && (
          <>
            <div style={s.header}>
              <p style={s.eyebrow}>Unlock full access</p>
              <h2 style={s.title}>See the complete roast</h2>
              <p style={s.subtitle}>
                Your free preview shows the overall score and 2 issues.
                Unlock every dimension, observation, and fix below.
              </p>
            </div>

            <div style={s.plans}>
              {/* Pro */}
              <div style={s.planCard}>
                <div style={s.planHeader}>
                  <div>
                    <p style={s.planName}>{PLANS.pro.name}</p>
                    <p style={s.planTagline}>One scan, full detail</p>
                  </div>
                  <div style={s.priceBlock}>
                    <span style={s.price}>{PLANS.pro.price}</span>
                    <span style={s.period}>one-time</span>
                  </div>
                </div>
                <ul style={s.features}>
                  {PLANS.pro.features.map(f => <FeatureItem key={f} text={f} />)}
                </ul>
                <button
                  style={{ ...s.cta, background: 'var(--accent)' }}
                  onClick={() => checkout('pro')}
                  disabled={loading !== null}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
                >
                  {loading === 'pro' ? <Spinner /> : PLANS.pro.cta}
                </button>
              </div>

              {/* Premium */}
              <div style={{ ...s.planCard, ...s.planCardFeatured }}>
                <div style={s.badge}>Best value</div>
                <div style={s.planHeader}>
                  <div>
                    <p style={s.planName}>{PLANS.premium.name}</p>
                    <p style={s.planTagline}>Unlimited analyses</p>
                  </div>
                  <div style={s.priceBlock}>
                    <span style={s.price}>{PLANS.premium.price}</span>
                    <span style={s.period}>/ month</span>
                  </div>
                </div>
                <ul style={s.features}>
                  {PLANS.premium.features.map(f => <FeatureItem key={f} text={f} />)}
                </ul>
                <button
                  style={{ ...s.cta, background: 'var(--text-primary)', color: 'var(--bg)' }}
                  onClick={() => checkout('premium')}
                  disabled={loading !== null}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {loading === 'premium' ? <Spinner light /> : PLANS.premium.cta}
                </button>
              </div>
            </div>

            <div style={s.trust}>
              <TrustItem icon="🔒" text="Stripe — secure payment" />
              <TrustItem icon="⚡" text="Instant access" />
              <TrustItem icon="↩" text="Cancel anytime (Premium)" />
            </div>
          </>
        )}

        {/* ── LOGIN GATE STEP ── */}
        {step === 'login' && (
          <>
            <div style={s.header}>
              <p style={s.eyebrow}>
                {pendingPlan === 'pro' ? 'Pro — €2 one-time' : 'Premium — €9.99/lună'}
              </p>
              <h2 style={s.title}>Create an account first</h2>
              <p style={s.subtitle}>
                You need an account to purchase and access your analysis anytime.
              </p>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading || authLoading}
              style={s.googleBtn}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {googleLoading ? <Spinner /> : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>

            <div style={s.divider}>
              <span style={s.dividerText}>or continue with email</span>
            </div>

            {/* Tabs */}
            <div style={s.authTabs}>
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setAuthMode(m); setAuthError('') }} style={{
                  ...s.authTab,
                  ...(authMode === m ? s.authTabActive : {}),
                }}>
                  {m === 'login' ? 'I have an account' : 'New account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AuthField label="Email" type="email" placeholder="you@example.com"
                value={email} onChange={setEmail} autoComplete="email" />
              <AuthField label="Password" type="password"
                placeholder={authMode === 'register' ? 'Min. 8 characters' : 'Your password'}
                value={password} onChange={setPassword}
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} />

              {authError && (
                <p style={s.authError}>{authError}</p>
              )}

              <button type="submit" disabled={authLoading || googleLoading} style={{
                ...s.cta, background: 'var(--accent)', marginTop: 2,
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
              >
                {authLoading ? <Spinner /> : authMode === 'login' ? 'Sign in & continue' : 'Create account & continue'}
              </button>
            </form>

            <button onClick={() => setStep('plans')} style={s.backBtn}>
              ← Back to plans
            </button>
          </>
        )}

      </div>
    </div>
  )
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      <svg width="14" height="14" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      {text}
    </li>
  )
}

function TrustItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-tertiary)' }}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

function Spinner({ light }: { light?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: `2px solid ${light ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}`,
      borderTopColor: light ? '#000' : '#fff',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.251 17.64 11.945 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function AuthField({ label, type, placeholder, value, onChange, autoComplete }: {
  label: string; type: string; placeholder: string
  value: string; onChange: (v: string) => void; autoComplete?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} required
        style={{
          padding: '10px 13px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)', fontSize: 14,
          outline: 'none', transition: 'border-color 0.15s',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 24,
  },
  modal: {
    position: 'relative',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '40px 32px 32px',
    width: '100%', maxWidth: 560,
    display: 'flex', flexDirection: 'column', gap: 22,
    boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
    maxHeight: '92vh', overflowY: 'auto',
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-tertiary)', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
  eyebrow: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--accent)', margin: 0,
  },
  title: {
    fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em',
    color: 'var(--text-primary)', margin: 0,
  },
  subtitle: {
    fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0,
  },
  plans: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
  },
  planCard: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  planCardFeatured: {
    border: '1.5px solid var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 4%, var(--bg))',
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--accent)', color: '#fff',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', padding: '3px 12px', borderRadius: 20,
    whiteSpace: 'nowrap',
  },
  planHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
  },
  planName: {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0,
  },
  planTagline: {
    fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0',
  },
  priceBlock: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0,
  },
  price: {
    fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)',
  },
  period: { fontSize: 11, color: 'var(--text-tertiary)' },
  features: {
    listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, flex: 1,
    margin: 0, padding: 0,
  },
  cta: {
    width: '100%', padding: '11px 16px',
    fontSize: 14, fontWeight: 600,
    color: '#fff', border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  trust: {
    display: 'flex', justifyContent: 'center',
    gap: 20, flexWrap: 'wrap',
    paddingTop: 2,
    borderTop: '1px solid var(--border)',
  },
  // Login gate
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', padding: '11px 16px',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', transition: 'border-color 0.15s',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12,
    color: 'var(--text-tertiary)',
  },
  dividerText: {
    fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
    padding: '0 2px',
    position: 'relative',
  },
  authTabs: {
    display: 'flex', background: 'var(--bg-subtle)',
    borderRadius: 'var(--radius-md)', padding: 3, gap: 2,
  },
  authTab: {
    flex: 1, padding: '7px 12px',
    fontSize: 13, fontWeight: 500,
    background: 'transparent', border: 'none',
    borderRadius: 'calc(var(--radius-md) - 2px)',
    color: 'var(--text-secondary)', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  authTabActive: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    border: '1px solid var(--border)',
  },
  authError: {
    fontSize: 13, color: '#ef4444', margin: 0,
    padding: '9px 12px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius-sm)',
  },
  backBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-tertiary)', fontSize: 13,
    cursor: 'pointer', padding: 0, textAlign: 'center' as const,
  },
}
