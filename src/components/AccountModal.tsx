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

const TIER_META: Record<string, { label: string; color: string; bg: string }> = {
  free:    { label: 'Free',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  pro:     { label: 'Pro',     color: 'var(--text-primary)', bg: 'var(--bg-muted)' },
  premium: { label: 'Premium', color: 'var(--score-high)', bg: 'rgba(34,197,94,0.1)' },
}

export function AccountModal({ userId, userEmail, onClose, onUpgrade, onSignOut }: AccountModalProps) {
  const [pwCurrent, setPwCurrent] = useState('')
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
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setTimeout(() => { setPwSuccess(false); setShowPwForm(false) }, 2500)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        <button style={s.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Profile section */}
        <div style={s.profileSection}>
          <div style={s.avatar}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={s.emailText}>{userEmail}</div>
            <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ ...s.tierBadge, color: meta.color, background: meta.bg }}>
                {meta.label}
              </span>
              {tier !== 'premium' && (
                <button onClick={onUpgrade} style={s.upgradeLink}>
                  Upgrade →
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={s.divider} />

        {/* Change password accordion */}
        <div>
          <button onClick={() => { setShowPwForm(v => !v); setPwError(''); setPwSuccess(false) }} style={s.accordionTrigger}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
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
            <form onSubmit={handleChangePassword} style={s.pwForm}>
              <p style={s.pwHint}>
                Dacă te-ai autentificat cu Google, după salvare poți folosi și email + parolă.
              </p>
              <PwField label="New password" placeholder="Min. 8 characters"
                value={pwNew} onChange={setPwNew} autoComplete="new-password" />
              <PwField label="Confirm password" placeholder="Repeat password"
                value={pwConfirm} onChange={setPwConfirm} autoComplete="new-password" />

              {pwError && <p style={s.errorMsg}>{pwError}</p>}
              {pwSuccess && <p style={s.successMsg}>✓ Password changed successfully.</p>}

              <button type="submit" disabled={pwLoading} style={{
                ...s.pwSubmit,
                opacity: pwLoading ? 0.6 : 1,
                cursor: pwLoading ? 'not-allowed' : 'pointer',
              }}>
                {pwLoading ? 'Saving…' : 'Save password'}
              </button>
            </form>
          )}
        </div>

        <div style={s.divider} />

        {/* Sign out */}
        <button onClick={onSignOut} style={s.signOutBtn}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Sign out
        </button>

      </div>
    </div>
  )
}

function PwField({ label, placeholder, value, onChange, autoComplete }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; autoComplete?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type="password" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} required
        style={{
          padding: '10px 13px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)', fontSize: 14,
          outline: 'none',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: 24,
  },
  modal: {
    width: '100%', maxWidth: 400,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: 28,
    display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: '0 40px 100px rgba(0,0,0,0.45)',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-tertiary)', cursor: 'pointer',
  },
  profileSection: {
    display: 'flex', alignItems: 'center', gap: 14, paddingRight: 24,
  },
  avatar: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'var(--bg-muted)',
    color: 'var(--text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, flexShrink: 0,
    border: '1px solid var(--border)',
  },
  emailText: {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tierBadge: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '2px 8px', borderRadius: 20,
    display: 'inline-block',
  },
  upgradeLink: {
    fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    textDecoration: 'underline', textUnderlineOffset: '2px',
  },
  divider: {
    height: 1, background: 'var(--border)', margin: '0 -4px',
  },
  accordionTrigger: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', background: 'none', border: 'none',
    padding: '2px 0', cursor: 'pointer', textAlign: 'left' as const,
  },
  pwForm: {
    display: 'flex', flexDirection: 'column', gap: 12,
    marginTop: 14, padding: 16,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  pwHint: {
    fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5,
  },
  pwSubmit: {
    padding: '10px', background: 'var(--text-primary)', border: 'none',
    borderRadius: 'var(--radius-sm)', color: 'var(--bg)',
    fontSize: 14, fontWeight: 600,
  },
  errorMsg: {
    fontSize: 13, color: '#ef4444', margin: 0,
    padding: '8px 12px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius-sm)',
  },
  successMsg: {
    fontSize: 13, color: '#22c55e', margin: 0,
    padding: '8px 12px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 'var(--radius-sm)',
  },
  signOutBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'none', border: 'none',
    color: '#ef4444', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', padding: '2px 0',
  },
}
