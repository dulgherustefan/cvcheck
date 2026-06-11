'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useTier } from '@/hooks/useTier'

interface AccountModalProps {
  userId: string
  userEmail: string
  onClose: () => void
  onUpgrade: () => void
  onSignOut: () => void
}

const TIER_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:    { label: 'Free',    color: 'var(--text-tertiary)',  bg: 'var(--bg-subtle)',   border: 'var(--border)' },
  pro:     { label: 'Pro',     color: 'var(--accent)',     bg: 'var(--accent-subtle)', border: 'var(--border-strong)' },
  premium: { label: 'Premium', color: '#B8881C',               bg: 'rgba(239,159,39,0.10)', border: 'rgba(239,159,39,0.25)' },
}

export function AccountModal({ userId, userEmail, onClose, onUpgrade, onSignOut }: AccountModalProps) {
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)

  const { tier } = useTier(userId)
  const supabase = createSupabaseBrowser()
  const meta = TIER_META[tier] ?? TIER_META.free
  const initials = userEmail.slice(0, 2).toUpperCase()

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
        @keyframes _accFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _accFadeUp {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        ._acc-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--accent-subtle) !important;
          outline: none !important;
        }
        ._acc-accordion:hover { background: var(--bg-subtle) !important; }
        ._acc-signout:hover { color: #dc2626 !important; background: rgba(220,38,38,0.06) !important; }
        ._acc-close:hover { background: var(--accent-subtle) !important; border-color: var(--accent) !important; color: var(--accent) !important; }
        ._acc-upgrade:hover { color: var(--accent) !important; }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 24,
          animation: '_accFadeIn 0.18s ease',
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: '100%', maxWidth: 400,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-xl)',
            padding: 28,
            display: 'flex', flexDirection: 'column', gap: 0,
            boxShadow: 'var(--shadow-xl)',
            position: 'relative',
            animation: '_accFadeUp 0.22s cubic-bezier(0.16,1,0.3,1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            className="_acc-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 32, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, flexShrink: 0,
              border: '2px solid var(--border-strong)',
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 6,
              }}>
                {userEmail}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '2px 9px', borderRadius: 20,
                  color: meta.color, background: meta.bg,
                  border: `1px solid ${meta.border}`,
                }}>
                  {meta.label}
                </span>
                {tier !== 'premium' && (
                  <button
                    className="_acc-upgrade"
                    onClick={onUpgrade}
                    style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      transition: 'color 0.15s',
                    }}
                  >
                    Upgrade →
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '0 0 16px' }} />

          {/* Change password */}
          <div style={{ marginBottom: 16 }}>
            <button
              className="_acc-accordion"
              onClick={() => { setShowPwForm(v => !v); setPwError(''); setPwSuccess(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', background: 'none', border: 'none',
                padding: '9px 10px', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Change password
              </span>
              <svg
                width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                style={{ color: 'var(--text-tertiary)', transform: showPwForm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showPwForm && (
              <form onSubmit={handleChangePassword} style={{
                display: 'flex', flexDirection: 'column', gap: 12,
                marginTop: 10, padding: 16,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <PwField label="New password" placeholder="Min. 8 characters" value={pwNew} onChange={setPwNew} autoComplete="new-password"/>
                <PwField label="Confirm password" placeholder="Same again" value={pwConfirm} onChange={setPwConfirm} autoComplete="new-password"/>

                {pwError && (
                  <p style={{ fontSize: 12, color: 'var(--score-low)', margin: 0, padding: '8px 10px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--radius-sm)' }}>
                    {pwError}
                  </p>
                )}
                {pwSuccess && (
                  <p style={{ fontSize: 12, color: 'var(--score-high)', margin: 0, padding: '8px 10px', background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 'var(--radius-sm)' }}>
                    ✓ Password changed successfully.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pwLoading}
                  style={{
                    padding: '10px', background: 'var(--accent)', border: 'none',
                    borderRadius: 'var(--radius-sm)', color: '#fff',
                    fontSize: 13, fontWeight: 600,
                    opacity: pwLoading ? 0.6 : 1,
                    cursor: pwLoading ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {pwLoading ? 'Saving…' : 'Save password'}
                </button>
              </form>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '0 0 16px' }} />

          {/* Saved jobs quick link */}
          <a
            href="/history#saved"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 10px', borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)', textDecoration: 'none',
              fontSize: 14, fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Saved jobs
            </span>
            <svg width="13" height="13" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </a>

          <div style={{ height: 1, background: 'var(--border)', margin: '0 0 16px' }} />

          {/* Sign out */}
          <button
            className="_acc-signout"
            onClick={onSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              background: 'none', border: 'none',
              color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', padding: '9px 10px',
              borderRadius: 'var(--radius-md)', transition: 'all 0.15s',
              width: '100%',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
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
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)', fontSize: 14,
          outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
    </div>
  )
}
