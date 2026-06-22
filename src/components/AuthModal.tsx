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
    login: 'Welcome back',
    register: 'Create your account',
    forgot: 'Reset password',
  }
  const subheading: Record<Mode, string> = {
    login: 'Sign in to access your CV analyses and saved jobs.',
    register: 'Get your CV scored and land more interviews.',
    forgot: "Enter your email and we'll send a reset link.",
  }

  return (
    <>
      <style>{`
        @keyframes _authFadeUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes _authFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _authSpin   { to { transform: rotate(360deg); } }

        ._auth-input {
          transition: border-color 0.15s, box-shadow 0.15s !important;
        }
        ._auth-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--accent-subtle) !important;
          outline: none !important;
        }
        ._auth-input:disabled { opacity: 0.5; }

        ._auth-google:hover:not(:disabled) {
          border-color: var(--border-strong) !important;
          background: var(--bg-subtle) !important;
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(0,0,0,0.10) !important;
        }
        ._auth-google { transition: background 0.15s, border-color 0.15s, transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s !important; }
        ._auth-google:active { transform: scale(0.97) !important; transition-duration: 0.08s !important; }

        ._auth-submit {
          transition: opacity 0.15s, transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s !important;
        }
        ._auth-submit:hover:not(:disabled) {
          opacity: 0.92 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(61,255,160,0.40) !important;
        }
        ._auth-submit:active:not(:disabled) {
          transform: scale(0.97) !important;
          box-shadow: none !important;
        }

        ._auth-link {
          transition: color 0.15s !important;
        }
        ._auth-link:hover { color: var(--accent) !important; }

        ._auth-close {
          transition: all 0.15s !important;
        }
        ._auth-close:hover {
          background: var(--accent-subtle) !important;
          border-color: var(--accent-border) !important;
          color: var(--accent) !important;
        }

        ._auth-tab {
          transition: all 0.18s ease !important;
          font-weight: 500;
          color: var(--text-tertiary);
        }
        ._auth-tab:hover:not(._auth-tab-active) {
          color: var(--text-secondary) !important;
        }
        ._auth-tab-active {
          background: var(--bg-elevated) !important;
          color: var(--text-primary) !important;
          font-weight: 600 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.10) !important;
          border: 1px solid var(--border) !important;
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 20,
          animation: '_authFadeIn 0.2s ease',
        }}
        onClick={close}
      >
        {/* Panel */}
        <div
          style={{
            width: '100%', maxWidth: 420,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
            position: 'relative',
            animation: '_authFadeUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Top accent stripe */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
          }} />

          <div style={{ padding: '28px 36px 30px' }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 20 }}>
              <img src="/logo.png" width="28" height="28" alt="CVCheck" style={{ display: 'block', borderRadius: 6 }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>CVCheck</span>
            </div>

            {/* Close */}
            <button
              className="_auth-close"
              onClick={close}
              aria-label="Close"
              style={{
                position: 'absolute', top: 18, right: 18,
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-tertiary)', cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Logo + heading */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <img src="/logo.png" width="26" height="26" alt="CVCheck" style={{ display: 'block', borderRadius: 6 }} />
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: 'var(--accent)',
                  letterSpacing: '-0.01em',
                  fontFamily: 'var(--font-display)',
                }}>CVCheck</span>
              </div>

              <h2 style={{
                fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em',
                lineHeight: 1.1,
                fontFamily: 'var(--font-display)',
                color: 'var(--text-heading)', margin: '0 0 8px',
              }}>
                {heading[mode]}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55, fontWeight: 500 }}>
                {subheading[mode]}
              </p>
            </div>

            {/* Mode tabs (login/register only) */}
            {mode !== 'forgot' && (
              <div style={{
                display: 'flex', gap: 4, background: 'var(--bg-subtle)',
                borderRadius: 10, padding: 4, marginBottom: 24,
                border: '1px solid var(--border)',
              }}>
                {(['login', 'register'] as Mode[]).map(m => (
                  <button
                    key={m}
                    className={`_auth-tab${mode === m ? ' _auth-tab-active' : ''}`}
                    onClick={() => switchMode(m)}
                    style={{
                      flex: 1, padding: '8px 12px',
                      fontSize: 13,
                      background: 'transparent', border: 'none',
                      borderRadius: 7,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {m === 'login' ? 'Sign in' : 'Sign up'}
                  </button>
                ))}
              </div>
            )}

            {/* Google OAuth (login + register only) */}
            {mode !== 'forgot' && (
              <>
                <button
                  className="_auth-google"
                  onClick={handleGoogle}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    padding: '11px 14px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 10, marginBottom: 16,
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                    cursor: isLoading ? 'default' : 'pointer',
                    opacity: isLoading ? 0.55 : 1,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {googleLoading ? <Spinner dark /> : (
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.251 17.64 11.945 17.64 9.2z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                  )}
                  {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.04em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field
                ref={emailRef}
                label="Email address"
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
                <div style={{
                  fontSize: 13, color: '#B91C1C', margin: 0,
                  padding: '10px 14px',
                  background: 'rgba(220,38,38,0.06)',
                  border: '1px solid rgba(220,38,38,0.18)',
                  borderRadius: 8, lineHeight: 1.5,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {success && (
                <div style={{
                  fontSize: 13, color: 'var(--accent)', margin: 0,
                  padding: '10px 14px',
                  background: 'rgba(22,163,74,0.06)',
                  border: '1px solid rgba(22,163,74,0.18)',
                  borderRadius: 8, lineHeight: 1.5,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="_auth-submit"
                disabled={isLoading}
                style={{
                  marginTop: 4,
                  padding: '12px 16px',
                  background: 'var(--accent)',
                  border: 'none', borderRadius: 10,
                  color: 'var(--text-inverse)', fontSize: 14, fontWeight: 700,
                  cursor: isLoading ? 'default' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '-0.01em',
                }}
              >
                {loading && <Spinner />}
                {loading ? 'Just a moment…'
                  : mode === 'login' ? 'Sign in to CVCheck'
                  : mode === 'register' ? 'Create account'
                  : 'Send reset link'}
              </button>
            </form>

            {/* Footer links */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 20, flexWrap: 'wrap',
            }}>
              {mode === 'login' && (
                <>
                  <FooterLink onClick={() => switchMode('forgot')}>Forgot password?</FooterLink>
                  <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>·</span>
                  <FooterLink onClick={() => switchMode('register')}>New to CVCheck?</FooterLink>
                </>
              )}
              {mode === 'register' && (
                <FooterLink onClick={() => switchMode('login')}>Already have an account? Sign in</FooterLink>
              )}
              {mode === 'forgot' && (
                <FooterLink onClick={() => switchMode('login')}>← Back to sign in</FooterLink>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const Field = forwardRef<HTMLInputElement, {
  label: string; type: string; placeholder: string; value: string
  onChange: (v: string) => void; autoComplete?: string; disabled?: boolean
}>(({ label, type, placeholder, value, onChange, autoComplete, disabled }, ref) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{
      fontSize: 12, fontWeight: 600, letterSpacing: '0.01em',
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
        padding: '11px 14px',
        background: 'var(--bg)',
        border: '1.5px solid var(--border-strong)',
        borderRadius: 10,
        color: 'var(--text-primary)',
        fontSize: 14,
        outline: 'none',
        width: '100%',
      }}
    />
  </div>
))
Field.displayName = 'Field'

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', flexShrink: 0,
      width: 14, height: 14,
      border: `2px solid ${dark ? 'var(--border-strong)' : 'rgba(255,255,255,0.35)'}`,
      borderTopColor: dark ? 'var(--accent)' : '#fff',
      borderRadius: '50%',
      animation: '_authSpin 0.65s linear infinite',
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
        color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
