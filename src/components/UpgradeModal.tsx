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
  const [loading, setLoading]       = useState<'pro' | 'premium' | null>(null)
  const [step, setStep]             = useState<Step>('plans')
  const [pendingPlan, setPendingPlan] = useState<'pro' | 'premium' | null>(null)

  // Login state
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [authMode, setAuthMode]   = useState<'login' | 'register'>('login')
  const [authError, setAuthError]   = useState('')
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
      if (password.length < 8) {
        setAuthError('Password must be at least 8 characters.')
        setAuthLoading(false); return
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
    }
    setAuthLoading(false)
    // After auth, re-attempt checkout
    if (pendingPlan) checkout(pendingPlan)
    else setStep('plans')
  }

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity:0; transform:translateY(16px) scale(0.98); }
          to   { opacity:1; transform:translateY(0)    scale(1); }
        }
        @keyframes overlayIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .um-plan:hover { border-color: var(--border-strong) !important; }
        .um-cta-pro:hover:not(:disabled) { opacity: 0.8 !important; }
        .um-cta-dark:hover:not(:disabled) { opacity:0.82 !important; }
        .um-google:hover:not(:disabled)   { border-color: var(--border-strong) !important; background: var(--bg-subtle) !important; }
        .um-tab-active { background: var(--bg-elevated) !important; color: var(--text-primary) !important; box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important; border: 1px solid var(--border) !important; }
        .um-field:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent) !important; }
        .um-submit:hover:not(:disabled)   { opacity: 0.8 !important; }
        .um-close:hover { background: var(--bg-muted) !important; border-color: var(--border-strong) !important; color: var(--text-primary) !important; }
        .um-back:hover  { color: var(--text-primary) !important; }
        @media (max-width: 480px) {
          .um-body { padding: 22px 18px 20px !important; }
          .um-features-grid { grid-template-columns: 1fr !important; }
          .um-premium-row { flex-wrap: wrap !important; }
          .um-premium-row > button { width: 100% !important; }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px 16px',
          animation: 'overlayIn 0.2s ease',
        }}
      >
        {/* Modal */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 20,
            width: '100%',
            maxWidth: step === 'login' ? 440 : 580,
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.12)',
            animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transition: 'max-width 0.3s ease',
            overflow: 'hidden',
          }}
        >
          {/* Terracotta stripe */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))', flexShrink: 0 }} />

          {/* Close button */}
          <button
            className="um-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)', cursor: 'pointer',
              transition: 'all 0.15s', zIndex: 1,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* ── PLANS STEP ── */}
          {step === 'plans' && (
            <div className="um-body" style={{ padding: '32px 32px 32px' }}>

              {/* Header */}
              <div style={{ marginBottom: 28, paddingRight: 32 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>
                  Unlock full access
                </p>
                <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-heading)', margin: '0 0 10px', lineHeight: 1.15, fontFamily: 'var(--font-display)' }}>
                  Your free preview is ready. Unlock everything for €1.99.
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, maxWidth: 440 }}>
                  The free scan shows your overall score and a glimpse of what's holding you back.
                  Pro unlocks all 7 dimension scores, every red flag fix, bullet rewrites, and priority actions with how-to steps.
                </p>
              </div>

              {/* What's locked callout */}
              <div style={{
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 12,
                marginBottom: 20,
              }}>
                <svg width="16" height="16" fill="none" stroke="var(--score-mid)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Your score and first impression are visible. Pro unlocks <strong style={{ color: 'var(--text-primary)' }}>bullet rewrites</strong>, <strong style={{ color: 'var(--text-primary)' }}>how to fix every red flag</strong>, missing ATS keywords, and full how-to steps for all 3 priority actions.
                </p>
              </div>

              {/* Plans — Pro featured, Premium compact row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>

                {/* Pro — featured */}
                <div
                  className="um-plan"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1.5px solid var(--accent-border)',
                    borderRadius: 12,
                    padding: '20px 22px',
                    display: 'flex', flexDirection: 'column', gap: 14,
                    transition: 'border-color 0.2s',
                    cursor: 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {PLANS.pro.name}
                      </p>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                        background: 'var(--accent)', color: 'var(--text-inverse)',
                        padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap',
                      }}>
                        Most popular
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>
                        {PLANS.pro.price}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>one-time</span>
                    </div>
                  </div>

                  <ul className="um-features-grid" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {PLANS.pro.features.map(f => <FeatureItem key={f} text={f}/>)}
                  </ul>

                  <button
                    className="um-cta-pro"
                    onClick={() => checkout('pro')}
                    disabled={loading !== null}
                    style={{
                      width: '100%', padding: '12px 16px',
                      fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                      color: 'var(--text-inverse)', background: 'var(--accent)', border: 'none',
                      borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'opacity 0.15s', fontFamily: 'var(--font-sans)',
                      boxShadow: '0 4px 14px rgba(210,106,74,0.35)',
                      opacity: loading && loading !== 'pro' ? 0.5 : 1,
                    }}
                  >
                    {loading === 'pro' ? <Spinner/> : (
                      <>{PLANS.pro.cta}
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                        </svg>
                      </>
                    )}
                  </button>
                </div>

                {/* Premium — compact row */}
                <div
                  className="um-plan um-premium-row"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '16px 22px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'border-color 0.2s', cursor: 'default',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {PLANS.premium.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>
                          {PLANS.premium.price}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/mo</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                      Everything in Pro · unlimited analyses · cancel anytime
                    </p>
                  </div>
                  <button
                    className="um-cta-dark"
                    onClick={() => checkout('premium')}
                    disabled={loading !== null}
                    style={{
                      padding: '10px 18px', flexShrink: 0,
                      fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
                      color: 'var(--accent)', background: 'transparent', border: '1.5px solid var(--accent)',
                      borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      transition: 'opacity 0.15s', fontFamily: 'var(--font-sans)',
                      opacity: loading && loading !== 'premium' ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {loading === 'premium' ? <Spinner light/> : PLANS.premium.cta}
                  </button>
                </div>
              </div>

              {/* Trust row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 20, flexWrap: 'wrap',
                paddingTop: 18, borderTop: '1px solid var(--border)',
              }}>
                {[
                  { icon: lockIcon, text: 'Stripe · secure payment' },
                  { icon: boltIcon, text: 'Instant access after payment' },
                  { icon: refreshIcon, text: 'Cancel anytime (Premium)' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {icon}
                    {text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LOGIN GATE STEP ── */}
          {step === 'login' && (
            <div className="um-body" style={{ padding: '36px 32px 32px' }}>

              {/* Back link */}
              <button
                className="um-back"
                onClick={() => setStep('plans')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 13, color: 'var(--text-tertiary)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', padding: 0,
                  marginBottom: 22, transition: 'color 0.15s',
                }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                Back to plans
              </button>

              {/* Header */}
              <div style={{ marginBottom: 24, paddingRight: 32 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>
                  {pendingPlan === 'pro' ? 'Pro — €1.99 one-time' : 'Premium — €5.99/month'}
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-heading)', margin: '0 0 8px', lineHeight: 1.25, fontFamily: 'var(--font-display)' }}>
                  Sign in to continue
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  You need a free account to purchase and access your analysis anytime, on any device.
                </p>
              </div>

              {/* Google */}
              <button
                className="um-google"
                onClick={handleGoogle}
                disabled={googleLoading || authLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '12px 16px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: 14, fontWeight: 500,
                  cursor: googleLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                  marginBottom: 14,
                }}
              >
                {googleLoading ? <Spinner/> : <><GoogleIcon/>Continue with Google</>}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '0 2px' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
              </div>

              {/* Auth tabs */}
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: 3, gap: 2, marginBottom: 14 }}>
                {(['login', 'register'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setAuthMode(m); setAuthError('') }}
                    className={authMode === m ? 'um-tab-active' : ''}
                    style={{
                      flex: 1, padding: '7px 12px', fontSize: 13, fontWeight: 500,
                      background: 'transparent', border: 'none',
                      borderRadius: 'calc(var(--radius-md) - 2px)',
                      color: authMode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {m === 'login' ? 'I have an account' : 'New account'}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AuthField label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} autoComplete="email"/>
                <AuthField
                  label="Password" type="password"
                  placeholder={authMode === 'register' ? 'Min. 8 characters' : 'Your password'}
                  value={password} onChange={setPassword}
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                />

                {authError && (
                  <p style={{ fontSize: 13, color: '#ef4444', margin: 0, padding: '10px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', lineHeight: 1.5 }}>
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  className="um-submit"
                  disabled={authLoading || googleLoading}
                  style={{
                    marginTop: 4, padding: '13px',
                    background: 'var(--accent)', border: 'none',
                    borderRadius: 8,
                    color: 'var(--text-inverse)', fontSize: 14, fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(210,106,74,0.30)',
                    cursor: authLoading ? 'not-allowed' : 'pointer',
                    opacity: authLoading ? 0.65 : 1,
                    transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                    letterSpacing: '-0.01em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {authLoading ? <Spinner/> : (authMode === 'login' ? 'Sign in & unlock' : 'Create account & unlock')}
                </button>
              </form>

              {/* Trust note */}
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', margin: '16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {lockIcon} Your data is never sold or shared.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      <svg width="13" height="13" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      {text}
    </li>
  )
}

function Spinner({ light }: { light?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: `2px solid ${light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.3)'}`,
      borderTopColor: light ? 'rgba(0,0,0,0.7)' : '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }}/>
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
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} required
        className="um-field"
        style={{
          padding: '11px 14px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)', fontSize: 14,
          outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
          fontFamily: 'var(--font-sans)', width: '100%',
        }}
      />
    </div>
  )
}

// ── Icon helpers ───────────────────────────────────────────────────────────────
const lockIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)
const boltIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const refreshIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
  </svg>
)
