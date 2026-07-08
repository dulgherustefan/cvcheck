'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useTier } from '@/hooks/useTier'

interface AccountModalProps {
  userId: string
  userEmail: string
  token: string | null
  onClose: () => void
  onUpgrade: () => void
  onSignOut: () => void
}

const TIER_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  free:    { label: 'Free',    color: 'var(--text-secondary)', bg: 'var(--bg-subtle)',          border: 'var(--border-strong)', dot: 'var(--text-tertiary)' },
  pro:     { label: 'Pro',     color: 'var(--accent)',          bg: 'var(--accent-subtle)',      border: 'var(--accent-border)', dot: 'var(--accent)' },
  premium: { label: 'Premium', color: 'var(--text-inverse)',   bg: 'var(--accent)',             border: 'transparent',          dot: 'var(--text-inverse)' },
}

export function AccountModal({ userId, userEmail, token, onClose, onUpgrade, onSignOut }: AccountModalProps) {
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)

  const [cancelConfirming, setCancelConfirming] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelDone, setCancelDone] = useState(false)

  const { tier } = useTier(userId)
  const supabase = createSupabaseBrowser()
  const meta = TIER_META[tier] ?? TIER_META.free
  const initials = userEmail.slice(0, 2).toUpperCase()

  async function handleCancelSubscription() {
    if (!token) { setCancelError('Please sign in again to cancel.'); return }
    setCancelLoading(true); setCancelError('')
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to cancel subscription')
      setCancelDone(true)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(''); setPwSuccess(false)
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match.'); return }
    if (pwNew.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwLoading(false)
    if (error) setPwError(error.message)
    else {
      setPwSuccess(true)
      setPwNew(''); setPwConfirm('')
      setTimeout(() => { setPwSuccess(false); setShowPwForm(false) }, 2500)
    }
  }

  return (
    <>
      <style>{`
        @keyframes _accFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _accFadeUp  {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        ._acc-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--accent-subtle) !important;
          outline: none !important;
        }
        ._acc-row {
          transition: background 0.15s cubic-bezier(0.16,1,0.3,1), color 0.15s !important;
          border-radius: 10px !important;
        }
        ._acc-row:hover { background: var(--bg-subtle) !important; }
        ._acc-danger:hover {
          background: rgba(255,95,95,0.06) !important;
          color: #D14343 !important;
        }
        ._acc-close {
          transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.14s cubic-bezier(0.34,1.56,0.64,1) !important;
        }
        ._acc-close:hover {
          background: var(--accent-subtle) !important;
          border-color: var(--accent-border) !important;
          color: var(--accent) !important;
          transform: scale(1.05) !important;
        }
        ._acc-close:active { transform: scale(0.95) !important; }
        ._acc-upgrade-btn {
          transition: background 0.15s, color 0.15s, transform 0.14s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s !important;
        }
        ._acc-upgrade-btn:hover {
          background: var(--accent) !important;
          color: var(--text-inverse) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 14px rgba(210,106,74,0.35) !important;
        }
        ._acc-upgrade-btn:active { transform: scale(0.97) !important; }
        ._acc-accordion {
          transition: background 0.15s cubic-bezier(0.16,1,0.3,1) !important;
          border-radius: 10px !important;
        }
        ._acc-accordion:hover { background: var(--bg-subtle) !important; }
        ._acc-pw-submit {
          transition: opacity 0.15s, transform 0.14s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s !important;
        }
        ._acc-pw-submit:hover:not(:disabled) {
          opacity: 0.92 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 14px rgba(210,106,74,0.30) !important;
        }
        ._acc-pw-submit:active:not(:disabled) { transform: scale(0.97) !important; }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 24,
          animation: '_accFadeIn 0.18s ease',
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: '100%', maxWidth: 420,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
            position: 'relative',
            animation: '_accFadeUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Top accent stripe */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))' }} />

          <div style={{ padding: '28px 28px 24px' }}>

            {/* Close */}
            <button
              className="_acc-close"
              onClick={onClose}
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

            {/* Profile hero */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              paddingRight: 40, marginBottom: 24,
            }}>
              {/* Avatar */}
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)',
                color: 'var(--text-inverse)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, flexShrink: 0,
                fontFamily: 'var(--font-display)',
                boxShadow: '0 4px 12px rgba(210,106,74,0.30)',
              }}>
                {initials}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: 8, letterSpacing: '-0.01em',
                }}>
                  {userEmail}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Tier badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '3px 10px', borderRadius: 20,
                    color: meta.color, background: meta.bg,
                    border: `1px solid ${meta.border}`,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: meta.dot, flexShrink: 0,
                    }} />
                    {meta.label}
                  </span>

                  {tier !== 'premium' && (
                    <button
                      className="_acc-upgrade-btn"
                      onClick={onUpgrade}
                      style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'var(--accent-subtle)',
                        border: '1px solid var(--accent-border)',
                        borderRadius: 20, padding: '3px 10px',
                        cursor: 'pointer',
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '0 0 8px' }} />

            {/* Nav rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '8px 0' }}>

              {/* Change password accordion */}
              <div>
                <button
                  className="_acc-accordion"
                  onClick={() => { setShowPwForm(v => !v); setPwError(''); setPwSuccess(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'none', border: 'none',
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>
                    <span style={{
                      width: 28, height: 28,
                      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                      borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="13" height="13" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </span>
                    Change password
                  </span>
                  <svg
                    width="13" height="13" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" viewBox="0 0 24 24"
                    style={{ transform: showPwForm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {showPwForm && (
                  <form onSubmit={handleChangePassword} style={{
                    display: 'flex', flexDirection: 'column', gap: 12,
                    margin: '4px 0 8px', padding: '16px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                  }}>
                    <PwField label="New password" placeholder="Min. 8 characters" value={pwNew} onChange={setPwNew} autoComplete="new-password"/>
                    <PwField label="Confirm password" placeholder="Same again" value={pwConfirm} onChange={setPwConfirm} autoComplete="new-password"/>

                    {pwError && (
                      <div style={{
                        fontSize: 12, color: '#D14343',
                        padding: '8px 12px',
                        background: 'rgba(255,95,95,0.06)',
                        border: '1px solid rgba(255,95,95,0.15)',
                        borderRadius: 8,
                        display: 'flex', gap: 7, alignItems: 'flex-start',
                      }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {pwError}
                      </div>
                    )}
                    {pwSuccess && (
                      <div style={{
                        fontSize: 12, color: 'var(--accent)',
                        padding: '8px 12px',
                        background: 'rgba(210,106,74,0.06)',
                        border: '1px solid rgba(210,106,74,0.15)',
                        borderRadius: 8,
                        display: 'flex', gap: 7, alignItems: 'center',
                      }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Password changed successfully.
                      </div>
                    )}

                    <button
                      type="submit"
                      className="_acc-pw-submit"
                      disabled={pwLoading}
                      style={{
                        padding: '10px', background: 'var(--accent)', border: 'none',
                        borderRadius: 9, color: 'var(--text-inverse)',
                        fontSize: 13, fontWeight: 700,
                        opacity: pwLoading ? 0.6 : 1,
                        cursor: pwLoading ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {pwLoading ? 'Saving…' : 'Save password'}
                    </button>
                  </form>
                )}
              </div>

              {/* Saved jobs */}
              <a
                href="/history?tab=saved"
                onClick={onClose}
                className="_acc-row"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px',
                  color: 'var(--text-primary)', textDecoration: 'none',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 28, height: 28,
                    background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="13" height="13" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" viewBox="0 0 24 24">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </span>
                  Saved jobs
                </span>
                <svg width="13" height="13" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>

              {/* Analysis history */}
              <a
                href="/history"
                onClick={onClose}
                className="_acc-row"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px',
                  color: 'var(--text-primary)', textDecoration: 'none',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 28, height: 28,
                    background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="13" height="13" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </span>
                  Analysis history
                </span>
                <svg width="13" height="13" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
            </div>

            {/* Cancel subscription (Premium only) */}
            {tier === 'premium' && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                {cancelDone ? (
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)',
                    padding: '10px 12px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}>
                    Subscription cancelled. You'll keep Premium until the end of your current billing period.
                  </div>
                ) : cancelConfirming ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 10,
                    padding: '12px', background: 'rgba(255,95,95,0.05)',
                    border: '1px solid rgba(255,95,95,0.18)', borderRadius: 10,
                  }}>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Cancel Premium? You'll keep access until the end of the current billing period, then drop to Free.
                    </p>
                    {cancelError && (
                      <p style={{ fontSize: 12, color: '#D14343', margin: 0 }}>{cancelError}</p>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancelLoading}
                        style={{
                          flex: 1, padding: '8px', background: '#D14343', border: 'none',
                          borderRadius: 8, color: '#fff', fontSize: 12.5, fontWeight: 700,
                          cursor: cancelLoading ? 'not-allowed' : 'pointer',
                          opacity: cancelLoading ? 0.6 : 1, fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {cancelLoading ? 'Cancelling…' : 'Confirm cancel'}
                      </button>
                      <button
                        onClick={() => { setCancelConfirming(false); setCancelError('') }}
                        disabled={cancelLoading}
                        style={{
                          flex: 1, padding: '8px', background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)', borderRadius: 8,
                          color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                      >
                        Never mind
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="_acc-row _acc-danger"
                    onClick={() => setCancelConfirming(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none',
                      color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', padding: '10px 12px', width: '100%',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{
                      width: 28, height: 28,
                      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                      borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    </span>
                    Cancel subscription
                  </button>
                )}
              </>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

            {/* Sign out */}
            <button
              className="_acc-row _acc-danger"
              onClick={onSignOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none',
                color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', padding: '10px 12px',
                width: '100%',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{
                width: 28, height: 28,
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s, border-color 0.15s',
              }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Sign out
            </button>

          </div>
        </div>
      </div>
    </>
  )
}

function PwField({ label, placeholder, value, onChange, autoComplete }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; autoComplete?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
        {label}
      </label>
      <input
        type="password" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} required
        className="_acc-input"
        style={{
          padding: '10px 12px',
          background: 'var(--bg-elevated)',
          border: '1.5px solid var(--border-strong)',
          borderRadius: 9,
          color: 'var(--text-primary)', fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  )
}
