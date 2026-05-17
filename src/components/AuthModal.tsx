'use client'

import { useState, useEffect, useRef, forwardRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'

interface AuthModalProps {
  onClose: () => void
  defaultMode?: 'login' | 'register' | 'forgot'
}

type Mode = 'login' | 'register' | 'forgot'

export function AuthModal({ onClose, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const supabase = createSupabaseBrowser()

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  function close() { onClose() }

  function switchMode(m: Mode) {
    setError(''); setSuccess(''); setPassword(''); setConfirmPassword('')
    setMode(m)
    setTimeout(() => emailRef.current?.focus(), 50)
  }

  async function handleGoogle() {
    setGoogleLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else close()
    }

    if (mode === 'register') {
      if (password !== confirmPassword) { setError("Passwords don't match."); setLoading(false); return }
      if (password.length < 8) { setError('Use at least 8 characters for your password.'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setSuccess('Check your inbox to confirm your account.')
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      if (error) setError(error.message)
      else setSuccess('Reset link sent. Check your inbox.')
    }

    setLoading(false)
  }

  const isLoading = loading || googleLoading

  const heading: Record<Mode, string> = {
    login: 'Sign in',
    register: 'Create an account',
    forgot: 'Reset your password',
  }
  const subheading: Record<Mode, string> = {
    login: 'Good to have you back.',
    register: 'Get your work roasted.',
    forgot: "Enter your email and we'll send you a link.",
  }

  return (
    <>
      <style>{`
        @keyframes _fadeUp {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes _fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _spin   { to { transform: rotate(360deg); } }
        ._auth-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent) !important;
          outline: none !important;
        }
        ._auth-google:hover:not(:disabled) { border-color: var(--border-strong) !important; background: var(--bg-subtle) !important; }
        ._auth-submit:hover:not(:disabled) { opacity: 0.85 !important; }
        ._auth-link:hover { color: var(--text-primary) !important; }
        ._auth-close:hover { background: var(--bg-subtle) !important; }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 20,
          animation: '_fadeIn 0.18s ease',
        }}
        onClick={close}
      >
        {/* Panel */}
        <div
          style={{
            width: '100%', maxWidth: 376,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '28px 26px 22px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            position: 'relative',
            animation: '_fadeUp 0.22s cubic-bezier(0.16,1,0.3,1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            className="_auth-close"
            onClick={close}
            aria-label="Close"
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', borderRadius: 7,
              color: 'var(--text-tertiary)', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Heading */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{
              fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em',
              color: 'var(--text-primary)', margin: '0 0 5px',
            }}>
              {heading[mode]}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {subheading[mode]}
            </p>
          </div>

          {/* Google OAuth */}
          {mode !== 'forgot' && (
            <>
              <button
                className="_auth-google"
                onClick={handleGoogle}
                disabled={isLoading}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '9px 14px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 9, marginBottom: 14,
                  color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                  cursor: isLoading ? 'default' : 'pointer',
                  opacity: isLoading ? 0.55 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {googleLoading
                  ? <Spinner dark />
                  : (
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden>
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.251 17.64 11.945 17.64 9.2z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                  )
                }
                {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', userSelect: 'none' as const }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Field
              ref={emailRef}
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              disabled={isLoading}
            />

            {mode !== 'forgot' && (
              <Field
                label="Password"
                type="password"
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                disabled={isLoading}
              />
            )}

            {mode === 'register' && (
              <Field
                label="Confirm password"
                type="password"
                placeholder="Same again"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                disabled={isLoading}
              />
            )}

            {error && (
              <p style={{
                fontSize: 13, color: '#dc2626', margin: 0,
                padding: '8px 11px',
                background: 'rgba(220,38,38,0.07)',
                border: '1px solid rgba(220,38,38,0.15)',
                borderRadius: 7, lineHeight: 1.45,
              }}>
                {error}
              </p>
            )}

            {success && (
              <p style={{
                fontSize: 13, color: '#15803d', margin: 0,
                padding: '8px 11px',
                background: 'rgba(21,128,61,0.07)',
                border: '1px solid rgba(21,128,61,0.15)',
                borderRadius: 7, lineHeight: 1.45,
              }}>
                {success}
              </p>
            )}

            <button
              type="submit"
              className="_auth-submit"
              disabled={isLoading}
              style={{
                marginTop: 3,
                padding: '10px 16px',
                background: 'var(--accent)',
                border: 'none', borderRadius: 9,
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                transition: 'opacity 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              {loading && <Spinner />}
              {loading ? 'Just a moment…'
                : mode === 'login' ? 'Sign in'
                : mode === 'register' ? 'Create account'
                : 'Send reset link'}
            </button>
          </form>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 16, flexWrap: 'wrap' as const,
          }}>
            {mode === 'login' && (
              <>
                <FooterLink onClick={() => switchMode('forgot')}>Forgot password?</FooterLink>
                <span style={{ color: 'var(--border-strong)', fontSize: 12, lineHeight: 1 }}>·</span>
                <FooterLink onClick={() => switchMode('register')}>Create an account</FooterLink>
              </>
            )}
            {mode === 'register' && (
              <FooterLink onClick={() => switchMode('login')}>Already have an account?</FooterLink>
            )}
            {mode === 'forgot' && (
              <FooterLink onClick={() => switchMode('login')}>← Back to sign in</FooterLink>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const Field = forwardRef<HTMLInputElement, {
  label: string; type: string; placeholder: string; value: string
  onChange: (v: string) => void; autoComplete?: string; disabled?: boolean
}>(({ label, type, placeholder, value, onChange, autoComplete, disabled }, ref) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{
      fontSize: 12, fontWeight: 500, letterSpacing: '0.005em',
      color: 'var(--text-secondary)',
    }}>
      {label}
    </label>
    <input
      ref={ref}
      className="_auth-input"
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete}
      disabled={disabled}
      style={{
        padding: '9px 11px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: 'var(--text-primary)',
        fontSize: 14,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        opacity: disabled ? 0.55 : 1,
      }}
    />
  </div>
))
Field.displayName = 'Field'

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', flexShrink: 0,
      width: 13, height: 13,
      border: `2px solid ${dark ? 'var(--border)' : 'rgba(255,255,255,0.3)'}`,
      borderTopColor: dark ? 'var(--text-primary)' : '#fff',
      borderRadius: '50%',
      animation: '_spin 0.65s linear infinite',
    }} />
  )
}

function FooterLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="_auth-link"
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: 0,
        color: 'var(--text-tertiary)', fontSize: 13,
        cursor: 'pointer', transition: 'color 0.15s',
      }}
    >
      {children}
    </button>
  )
}
