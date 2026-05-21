'use client'

import { useState, useRef, useCallback, useEffect, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthModal } from '@/components/AuthModal'
import { UpgradeModal } from '@/components/UpgradeModal'
import { AccountModal } from '@/components/AccountModal'
import { useAuth } from '@/hooks/useAuth'
import { useTier } from '@/hooks/useTier'
import type { GatedAnalysisResult, ImprovementTip, Observation, Rating } from '@/lib/types'
import { SCORE_DIMENSIONS } from '@/lib/constants'
import styles from './page.module.css'

type InputMode = 'url' | 'pdf'
type AppState  = 'idle' | 'loading' | 'result' | 'error'

const RATING_LABELS: Record<Rating, string> = {
  needs_work: 'Needs Work', below_average: 'Below Average', average: 'Average',
  good: 'Good', strong: 'Strong', excellent: 'Excellent',
}
const RATING_COLORS: Record<Rating, string> = {
  needs_work: '#B91C1C', below_average: '#C2410C', average: '#B45309',
  good: '#4D7C0F', strong: '#15803D', excellent: '#0E7490',
}
const IMPACT_COLORS: Record<ImprovementTip['impact'], string> = {
  high: '#B91C1C', medium: '#B45309', low: '#6B7280',
}

const PLAN_DEFS = {
  free:    { label: 'Free',    color: 'var(--text-tertiary)', price: '€0',    period: '', features: ['Overall score /100', 'Rating & summary', '2 of 4 observations', '1 of 3 improvement tips'] },
  pro:     { label: 'Pro',     color: 'var(--accent-text)',   price: '€2',    period: 'one-time', features: ['Score + 8 detailed dimensions', 'All 4 observations', 'All 3 tips with rewrites', 'Permanent access, no subscription'] },
  premium: { label: 'Premium', color: 'var(--score-high)',    price: '€7.99', period: '/month',   features: ['Everything in Pro', 'Unlimited analyses', 'History & progress tracking', 'Priority support'] },
}

const HOW_STEPS = [
  { n: '01', title: 'Paste a link or drop your PDF', desc: 'Portfolio URL, LinkedIn, personal site, or a PDF CV. Takes 5 seconds to submit.' },
  { n: '02', title: 'We read it like a recruiter would', desc: 'CVCheck scores 8 things recruiters actually care about — positioning, proof, structure, language, and more.' },
  { n: '03', title: 'You get a score and real feedback', desc: 'Not vague suggestions. Specific rewrites you can copy and use today.' },
]

const FEATURES = [
  { icon: '📊', title: 'A score that means something', desc: 'One number out of 100, broken down across 8 weighted dimensions. You know exactly where you stand.' },
  { icon: '🔍', title: '8 dimensions scored separately', desc: 'First impression, positioning, experience proof, skills, credibility, structure, language, CTA. Each one matters.' },
  { icon: '💬', title: 'Direct, no-sugarcoating feedback', desc: 'Strengths are strengths. Weaknesses are weaknesses. No "this is a great start" when it isn\'t.' },
  { icon: '✏️', title: 'Rewrites you can use right now', desc: 'Every improvement tip includes a rewritten version. Copy it, tweak it, paste it in.' },
]

const LOADING_STEPS = [
  'Reading your content…',
  'Evaluating structure & positioning…',
  'Scoring 8 dimensions…',
  'Writing your recommendations…',
]

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const CheckIcon = ({ size = 13, color = 'var(--score-high)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const LockIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

const ChevronDown = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const ArrowRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

// ─── ScoreRing ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 54, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 66 ? 'var(--score-high)' : score >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  return (
    <div className={styles.scoreRing}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="7"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 68 68)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}/>
      </svg>
      <div className={styles.scoreRingInner}>
        <span className={styles.scoreNumber} style={{ color }}>{score}</span>
        <span className={styles.scoreMax}>/100</span>
      </div>
    </div>
  )
}

// ─── DimensionBar ─────────────────────────────────────────────────────────────
function DimensionBar({ label, score, max, desc, locked, onUnlock }: {
  label: string; score: number; max: number; desc: string
  locked?: boolean; onUnlock?: () => void
}) {
  const pct   = (score / max) * 100
  const color = pct >= 66 ? 'var(--score-high)' : pct >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  if (locked) return (
    <div className={`${styles.dimBar} ${styles.dimBarLocked}`} onClick={onUnlock}>
      <div className={styles.dimBarRow}>
        <div>
          <span className={styles.dimLabel} style={{ filter: 'blur(4px)', userSelect: 'none' }}>{label}</span>
          <span className={styles.dimDesc}  style={{ filter: 'blur(3px)', userSelect: 'none' }}>{desc}</span>
        </div>
        <span className={styles.lockIcon}><LockIcon/></span>
      </div>
      <div className={styles.barTrack}><div className={styles.barFillLocked} style={{ width: '65%' }}/></div>
    </div>
  )
  return (
    <div className={styles.dimBar}>
      <div className={styles.dimBarRow}>
        <div>
          <span className={styles.dimLabel}>{label}</span>
          <span className={styles.dimDesc}>{desc}</span>
        </div>
        <span className={styles.dimScore} style={{ color }}>{score}<span className={styles.dimMax}>/{max}</span></span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }}/>
      </div>
    </div>
  )
}

// ─── ObservationCard ──────────────────────────────────────────────────────────
function ObservationCard({ obs, index, locked, onUnlock }: {
  obs: Observation; index: number; locked: boolean; onUnlock: () => void
}) {
  const isStr  = obs.type === 'strength'
  const color  = isStr ? 'var(--score-high)' : 'var(--score-low)'
  const bg     = isStr ? 'rgba(21,128,61,0.06)'  : 'rgba(185,28,28,0.06)'
  const border = isStr ? 'rgba(21,128,61,0.18)'  : 'rgba(185,28,28,0.18)'

  if (locked) return (
    <div onClick={onUnlock}
      style={{ padding: '14px 20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
      onMouseOut={e  => (e.currentTarget.style.background = 'var(--bg-elevated)')}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', filter: 'blur(5px)', userSelect: 'none', flex: 1, margin: 0, lineHeight: 1.65 }}>{obs.detail}</p>
      <div style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', marginTop: 2 }}><LockIcon/></div>
    </div>
  )

  return (
    <div className={styles.obsCard} style={{ background: bg, border: `1px solid ${border}` }}>
      <div className={styles.obsCardHeader}>
        <span className={styles.obsBadge} style={{ color, background: isStr ? 'rgba(21,128,61,0.1)' : 'rgba(185,28,28,0.1)' }}>
          {isStr ? '✓ Strength' : '✗ Weakness'}
        </span>
        <span className={styles.obsTitle}>{obs.title}</span>
      </div>
      <p className={styles.obsDetail}>{obs.detail}</p>
    </div>
  )
}

// ─── TipCard ──────────────────────────────────────────────────────────────────
function TipCard({ tip, index, locked, onUnlock }: {
  tip: ImprovementTip; index: number; locked: boolean; onUnlock: () => void
}) {
  const [open, setOpen] = useState(index === 0 && !locked)
  const ic = IMPACT_COLORS[tip.impact]

  if (locked) return (
    <div className={`${styles.tipCard} ${styles.tipLocked}`} onClick={onUnlock}>
      <div className={styles.tipHeader} style={{ cursor: 'pointer' }}>
        <div className={styles.tipHeaderLeft}>
          <span className={styles.tipImpact} style={{ color: ic, background: `${ic}14`, borderColor: `${ic}28` }}>{tip.impact}</span>
          <span className={styles.tipArea} style={{ filter: 'blur(4px)', userSelect: 'none' }}>{tip.area}</span>
        </div>
        <div className={styles.lockBadge}><LockIcon size={10}/>Unlock</div>
      </div>
      <div className={styles.tipBody} style={{ paddingTop: 0 }}>
        <p style={{ filter: 'blur(5px)', userSelect: 'none', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{tip.problem}</p>
      </div>
    </div>
  )

  return (
    <div className={styles.tipCard}>
      <button className={styles.tipHeader} onClick={() => setOpen(!open)}>
        <div className={styles.tipHeaderLeft}>
          <span className={styles.tipImpact} style={{ color: ic, background: `${ic}14`, borderColor: `${ic}28` }}>{tip.impact}</span>
          <span className={styles.tipArea}>{tip.area}</span>
        </div>
        <span className={`${styles.tipChevron} ${open ? styles.tipChevronOpen : ''}`}><ChevronDown/></span>
      </button>
      {open && (
        <div className={styles.tipBody}>
          <p className={styles.tipProblem}>{tip.problem}</p>
          <div className={styles.tipFix}>
            <span className={styles.tipFixLabel}>How to fix it</span>
            <p className={styles.tipFixText}>{tip.fix}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AccountDropdown ──────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  free: 'var(--text-tertiary)', pro: 'var(--accent-text)', premium: 'var(--score-high)',
}
function AccountDropdown({ user, tier, onOpenAccount, onOpenPlans, onSignOut }: {
  user: { email?: string }; tier: string
  onOpenAccount: () => void; onOpenPlans: () => void; onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const initials = (user.email ?? 'U').slice(0, 2).toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <style>{`@keyframes ddIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}.dd-row:hover{background:var(--bg-subtle)!important;color:var(--text-primary)!important}.dd-danger:hover{background:rgba(185,28,28,0.07)!important;color:#b91c1c!important}`}</style>
      <button className={styles.accountBtn} onClick={() => setOpen(v => !v)}>
        <span className={styles.accountAvatar}>{initials}</span>
        <span className={styles.accountEmail}>{user.email?.split('@')[0]}</span>
        <svg width="11" height="11" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', zIndex: 1000, animation: 'ddIn 0.15s ease' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            <div style={{ fontSize: 11, color: TIER_COLORS[tier] ?? 'var(--text-tertiary)', fontWeight: 600, marginTop: 3, textTransform: 'capitalize' }}>{tier} plan</div>
          </div>
          {[
            { label: 'My account', onClick: () => { onOpenAccount(); setOpen(false) }, icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4' },
            { label: 'History',    onClick: () => { router.push('/history'); setOpen(false) }, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1' },
            { label: 'Plans',      onClick: () => { onOpenPlans(); setOpen(false) }, icon: 'M3 3h18M3 9h18M3 15h18' },
          ].map(item => (
            <button key={item.label} className="dd-row" onClick={item.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d={item.icon}/></svg>
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button className="dd-danger" onClick={() => { onSignOut(); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', color: '#b91c1c', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PlansModal ────────────────────────────────────────────────────────────────
function PlansModal({ tier, userId, onClose, onBuy }: {
  tier: string; userId?: string; onClose: () => void; onBuy: () => void
}) {
  const isPremium = tier === 'premium'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: isPremium ? 400 : 680, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto', animation: 'scaleIn 0.22s cubic-bezier(0.16,1,0.3,1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Plans</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>Active: <strong style={{ color: TIER_COLORS[tier] ?? 'var(--text-tertiary)', textTransform: 'capitalize' }}>{tier}</strong></p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isPremium ? (
            <div style={{ padding: 22, borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--score-high)', background: 'rgba(21,128,61,0.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>You have full access to everything CVCheck offers. Thanks for being a Premium subscriber.</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PLAN_DEFS.premium.features.map(f => <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><CheckIcon/>{f}</li>)}
              </ul>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: tier === 'pro' ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
              {(tier === 'pro' ? ['premium'] : ['free', 'pro', 'premium'] as const).map(pk => {
                const p = PLAN_DEFS[pk]
                const isCurrent = tier === pk
                const isFeatured = pk === 'pro'
                return (
                  <div key={pk} style={{ padding: 20, borderRadius: 'var(--radius-lg)', border: `${isFeatured ? '1.5px' : '1px'} solid ${isFeatured ? 'var(--accent)' : 'var(--border)'}`, background: isFeatured ? 'color-mix(in srgb, var(--accent) 3%, var(--bg-elevated))' : 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
                    {isFeatured && <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>Best value</div>}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: p.color }}>{p.label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginTop: 6, lineHeight: 1 }}>
                        {p.price}{p.period && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}> {p.period}</span>}
                      </div>
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {p.features.map(f => <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}><CheckIcon size={12}/>{f}</li>)}
                    </ul>
                    {isCurrent
                      ? <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>Current plan</div>
                      : pk === 'free'
                        ? <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>Free — always</div>
                        : <button onClick={onBuy} style={{ padding: '11px', border: 'none', borderRadius: 'var(--radius-md)', background: pk === 'premium' ? 'var(--text-primary)' : 'var(--accent)', color: pk === 'premium' ? 'var(--bg)' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', transition: 'opacity 0.15s' }}>
                            Get {p.label}
                          </button>
                    }
                  </div>
                )
              })}
            </div>
          )}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <LockIcon size={11}/> Stripe · Secure payment · Cancel anytime (Premium)
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const { tier } = useTier(user?.id)

  const [showAuthModal,    setShowAuthModal]    = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showPlansModal,   setShowPlansModal]   = useState(false)

  const [mode,       setMode]       = useState<InputMode>('url')
  const [url,        setUrl]        = useState('')
  const [file,       setFile]       = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [appState,   setAppState]   = useState<AppState>('idle')
  const [result,     setResult]     = useState<GatedAnalysisResult | null>(null)
  const [error,      setError]      = useState('')
  const [copied,     setCopied]     = useState(false)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [loadingStep,   setLoadingStep]   = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (appState !== 'loading') { setLoadingStep(0); return }
    const timers = LOADING_STEPS.map((_, i) => setTimeout(() => setLoadingStep(i), i * 4200))
    return () => timers.forEach(clearTimeout)
  }, [appState])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') setFile(f)
  }, [])

  const submit = async () => {
    if (mode === 'url' && !url.trim()) return
    if (mode === 'pdf' && !file) return
    if (tier === 'free' && analysisCount >= 1) { setShowUpgradeModal(true); return }
    setAppState('loading'); setError(''); setResult(null)
    try {
      let res: Response
      if (mode === 'pdf' && file) {
        const form = new FormData(); form.append('file', file)
        res = await fetch('/api/roast', { method: 'POST', body: form, headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} })
      } else {
        res = await fetch('/api/roast', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ url: url.trim() }) })
      }
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.error === 'free_limit_reached') { setShowUpgradeModal(true); setAppState('idle'); return }
        throw new Error(data.error || 'Analysis failed')
      }
      setResult(data); setAppState('result'); setAnalysisCount(c => c + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong'); setAppState('error')
    }
  }

  const reset = () => { setAppState('idle'); setResult(null); setError(''); setUrl(''); setFile(null) }
  const copyShare = async () => {
    if (!result) return
    await navigator.clipboard.writeText(`My CV score: ${result.total_score}/100 (${RATING_LABELS[result.rating]})\n${result.summary}\n\ncvcheck.app`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const isPro = result?.tier === 'pro' || result?.tier === 'premium'

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark}>
              <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <span className={styles.logoText}>CVCheck</span>
          </Link>
          <div className={styles.headerRight}>
            {!authLoading && (user ? (
              <AccountDropdown user={user} tier={tier} onOpenAccount={() => setShowAccountModal(true)} onOpenPlans={() => setShowPlansModal(true)} onSignOut={() => signOut()}/>
            ) : (
              <>
                <button className={styles.signInBtn} onClick={() => setShowAuthModal(true)}>Sign in</button>
                <button className={styles.upgradeHeaderBtn} onClick={() => setShowUpgradeModal(true)}>Get Pro — €2</button>
              </>
            ))}
            <ThemeToggle/>
          </div>
        </div>
      </header>

      {/* ── Modals ── */}
      {showAuthModal    && <AuthModal onClose={() => setShowAuthModal(false)}/>}
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} roastId={result?.analysis_id} userId={user?.id} userEmail={user?.email}/>}
      {showAccountModal && user && <AccountModal onClose={() => setShowAccountModal(false)} userId={user.id} userEmail={user.email ?? ''} onUpgrade={() => { setShowAccountModal(false); setShowPlansModal(true) }} onSignOut={() => { setShowAccountModal(false); signOut() }}/>}
      {showPlansModal   && <PlansModal tier={tier} userId={user?.id} onClose={() => setShowPlansModal(false)} onBuy={() => { setShowPlansModal(false); setShowUpgradeModal(true) }}/>}

      <main className={styles.main}>

        {/* ── IDLE / ERROR ── */}
        {(appState === 'idle' || appState === 'error') && (
          <div className={styles.hero}>

            {/* ── HERO 2-col grid ── */}
            <div className={styles.heroTop}>

              {/* Left: headline + trust */}
              <div className={styles.heroLeft}>
                <div className={styles.heroEyebrow}>
                  <span className={styles.heroEyebrowDot}/>
                  AI feedback · CV &amp; portfolios
                </div>

                <h1 className={styles.heroTitle}>
                  Find out why your CV<br/>
                  <span className={styles.heroTitleItalic}>isn't getting replies.</span>
                </h1>

                <p className={styles.heroSubtitle}>
                  Paste a link or upload your CV. Get a score, a breakdown of what's working and what isn't, and specific rewrites — in about 30 seconds.
                </p>

                <div className={styles.heroTrust}>
                  {[
                    'No account required to start',
                    'CV, portfolio or LinkedIn URL',
                    'Results in under 30 seconds',
                    'One honest free scan',
                  ].map(t => (
                    <div key={t} className={styles.heroTrustItem}>
                      <span className={styles.heroTrustDot}/>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: input card */}
              <div className={styles.heroRight}>
                <div className={styles.inputCard}>
                  <div className={styles.inputCardLabel}>Analyze your CV</div>

                  {/* Mode tabs */}
                  <div className={styles.modeTabs}>
                    {(['url', 'pdf'] as const).map(m => (
                      <button key={m} className={`${styles.modeTab} ${mode === m ? styles.modeTabActive : ''}`} onClick={() => setMode(m)}>
                        {m === 'url'
                          ? <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Paste a link</>
                          : <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Upload PDF</>
                        }
                      </button>
                    ))}
                  </div>

                  {/* URL input */}
                  {mode === 'url' && (
                    <div className={styles.urlInputWrapper}>
                      <svg className={styles.urlIcon} width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                      </svg>
                      <input type="url" className={styles.urlField}
                        placeholder="yoursite.com or linkedin.com/in/you"
                        value={url} onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submit()}
                        autoComplete="off" spellCheck={false}/>
                    </div>
                  )}

                  {/* Dropzone */}
                  {mode === 'pdf' && (
                    <div className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''} ${file ? styles.dropzoneHasFile : ''}`}
                      onDrop={handleDrop}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onClick={() => !file && fileInputRef.current?.click()}>
                      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf"
                        onChange={e => { const f = e.target.files?.[0]; if (f?.type === 'application/pdf') setFile(f) }}
                        style={{ display: 'none' }}/>
                      {file ? (
                        <div className={styles.filePreview}>
                          <div className={styles.fileIcon}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                          <div className={styles.fileMeta}>
                            <span className={styles.fileName}>{file.name}</span>
                            <span className={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB · PDF ready</span>
                          </div>
                          <button className={styles.fileRemove} onClick={e => { e.stopPropagation(); setFile(null) }}>
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className={styles.dropzonePrompt}>
                          <div className={styles.dropzoneIconWrap}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          </div>
                          <span className={styles.dropzoneText}>Drop your CV here</span>
                          <span className={styles.dropzoneHint}>or click to browse · PDF · max 10 MB</span>
                        </div>
                      )}
                    </div>
                  )}

                  {appState === 'error' && (
                    <div className={styles.errorBanner}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {error}
                    </div>
                  )}

                  <button className={styles.submitBtn} onClick={submit} disabled={mode === 'url' ? !url.trim() : !file}>
                    Analyze my CV
                    <ArrowRight/>
                  </button>

                  <p className={styles.freeNote}>
                    {tier === 'free' && analysisCount >= 1
                      ? <>Free scan used — <button className={styles.freeNoteLink} onClick={() => setShowUpgradeModal(true)}>upgrade for unlimited</button></>
                      : tier === 'premium'
                        ? <>✓ Unlimited · Premium active</>
                        : <>One free scan · No account needed</>}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Social proof strip ── */}
            <div className={styles.socialStrip}>
              {[
                { n: '8',     label: 'Dimensions scored'      },
                { n: '~30s',  label: 'From link to results'   },
                { n: '€2',    label: 'Full access, one-time'  },
                { n: '0',     label: 'Sugarcoating'           },
              ].map(({ n, label }) => (
                <div key={label} className={styles.socialStripItem}>
                  <span className={styles.socialStripNum}>{n}</span>
                  <span className={styles.socialStripLabel}>{label}</span>
                </div>
              ))}
            </div>

            {/* ── How it works ── */}
            <section className={styles.howSection}>
              <div>
                <p className={styles.sectionEyebrow}>How it works</p>
                <h2 className={styles.sectionTitle}>
                  Simple enough that you'll<br/>
                  <span className={styles.sectionTitleStrong}>actually use it.</span>
                </h2>
              </div>
              <div className={styles.howGrid}>
                {HOW_STEPS.map(s => (
                  <div key={s.n} className={styles.howCard}>
                    <div className={styles.howNum}>{s.n}</div>
                    <p className={styles.howTitle}>{s.title}</p>
                    <p className={styles.howDesc}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Features ── */}
            <section className={styles.featSection}>
              <div>
                <p className={styles.sectionEyebrow}>What you get</p>
                <h2 className={styles.sectionTitle}>
                  Feedback you can<br/>
                  <span className={styles.sectionTitleStrong}>do something with.</span>
                </h2>
              </div>
              <div className={styles.featGrid}>
                {FEATURES.map(f => (
                  <div key={f.title} className={styles.featCard}>
                    <div className={styles.featIcon}>{f.icon}</div>
                    <p className={styles.featTitle}>{f.title}</p>
                    <p className={styles.featDesc}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Pricing ── */}
            <section className={styles.pricingSection}>
              <div>
                <p className={styles.sectionEyebrow}>Pricing</p>
                <h2 className={styles.sectionTitle}>
                  No tricks,<br/>
                  <span className={styles.sectionTitleStrong}>no "contact us".</span>
                </h2>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10, maxWidth: 420 }}>
                  Try it free. If you want the full picture, Pro is €2 — one-time, no subscription.
                </p>
              </div>
              <div className={styles.pricingGrid}>
                {(['free', 'pro', 'premium'] as const).map(pk => {
                  const p = PLAN_DEFS[pk]
                  const isFeatured = pk === 'pro'
                  const isCurrent  = tier === pk
                  return (
                    <div key={pk} className={`${styles.pricingCard} ${isFeatured ? styles.pricingFeatured : ''}`}>
                      {isFeatured && <div className={styles.pricingBadge}>Most popular</div>}
                      <div>
                        <div className={styles.pricingTier}>{p.label}</div>
                        <div style={{ marginTop: 8 }}>
                          <span className={styles.pricingPrice}>{p.price}</span>
                          {p.period && <span className={styles.pricingPeriod}> {p.period}</span>}
                        </div>
                      </div>
                      <div className={styles.pricingDivider}/>
                      <ul className={styles.pricingFeatures}>
                        {p.features.map(f => (
                          <li key={f} className={styles.pricingFeatureItem}>
                            <CheckIcon/>{f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent
                        ? <div className={styles.pricingCtaGhost}>Current plan</div>
                        : pk === 'free'
                          ? <button className={`${styles.pricingCtaGhost} ${styles.pricingCtaGhostClickable}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Start free ↑</button>
                          : pk === 'pro'
                            ? <button className={styles.pricingCtaBlue} onClick={() => setShowUpgradeModal(true)}>Get Pro — €2</button>
                            : <button className={styles.pricingCtaDark} onClick={() => setShowUpgradeModal(true)}>Get Premium</button>
                      }
                    </div>
                  )
                })}
              </div>
              <p className={styles.pricingFootnote}>
                <LockIcon size={11}/> Stripe · Secure checkout · No subscription on Pro
              </p>
            </section>
          </div>
        )}

        {/* ── LOADING ── */}
        {appState === 'loading' && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}/>
            <p className={styles.loadingLabel}>Analyzing your CV…</p>
            <div className={styles.loadingSteps}>
              {LOADING_STEPS.map((step, i) => (
                <div key={step} className={`${styles.loadingStep} ${i === loadingStep ? styles.loadingStepActive : ''}`} style={{ opacity: i <= loadingStep ? 1 : 0.25 }}>
                  <div className={`${styles.loadingDot} ${i === loadingStep ? styles.loadingDotActive : ''}`}/>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {appState === 'result' && result && (
          <div className={styles.results}>
            {/* Nav row */}
            <div className={styles.resultsNav}>
              <button className={styles.navBtn} onClick={reset}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                New analysis
              </button>
              <button className={styles.navBtn} onClick={copyShare}>
                {copied
                  ? <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                  : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share score</>}
              </button>
            </div>

            {/* Score hero */}
            <div className={styles.scoreHero}>
              <ScoreRing score={result.total_score}/>
              <div className={styles.scoreHeroMeta}>
                <span className={styles.ratingBadge} style={{ color: RATING_COLORS[result.rating], borderColor: `${RATING_COLORS[result.rating]}25`, background: `${RATING_COLORS[result.rating]}0D` }}>
                  {RATING_LABELS[result.rating]}
                </span>
                <p className={styles.scoreSummary}>{result.summary}</p>
                {result.source && <span className={styles.sourceChip}>{result.source}</span>}
              </div>
            </div>

            {/* Score breakdown */}
            <div className={styles.resultSection}>
              <div className={styles.resultSectionHeader}>
                <span className={styles.resultSectionLabel}>Score breakdown</span>
                {result.scores_locked && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgradeModal(true)}>
                    <LockIcon size={11}/> Unlock — €2
                  </button>
                )}
              </div>
              <div className={styles.dimBars}>
                {SCORE_DIMENSIONS.map(({ key, label, max, desc }) => (
                  <DimensionBar key={key} label={label}
                    score={(result.scores as unknown as Record<string, number>)[key] ?? 0}
                    max={max} desc={desc}
                    locked={result.scores_locked}
                    onUnlock={() => setShowUpgradeModal(true)}/>
                ))}
              </div>
            </div>

            {/* Observations */}
            <div className={styles.resultSection}>
              <div className={styles.resultSectionHeader}>
                <span className={styles.resultSectionLabel}>Observations</span>
                {!isPro && result.observations.length > result.observations_locked_from && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgradeModal(true)}>
                    <LockIcon size={11}/> See all {result.observations.length}
                  </button>
                )}
              </div>
              <div className={styles.obsGrid}>
                {result.observations.map((obs, i) => (
                  <ObservationCard key={i} obs={obs} index={i}
                    locked={i >= result.observations_locked_from}
                    onUnlock={() => setShowUpgradeModal(true)}/>
                ))}
              </div>
            </div>

            {/* Improvements */}
            <div className={styles.resultSection}>
              <div className={styles.resultSectionHeader}>
                <span className={styles.resultSectionLabel}>How to improve</span>
                {!isPro && result.improvements.length > result.improvements_locked_from && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgradeModal(true)}>
                    <LockIcon size={11}/> {result.improvements.length - result.improvements_locked_from} more locked
                  </button>
                )}
              </div>
              <div className={styles.tipsWrap}>
                {result.improvements.map((tip, i) => (
                  <TipCard key={i} tip={tip} index={i}
                    locked={i >= result.improvements_locked_from}
                    onUnlock={() => setShowUpgradeModal(true)}/>
                ))}
              </div>
            </div>

            {/* Top priority */}
            <div className={styles.priorityCard}>
              <div className={styles.priorityCardEyebrow}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Do this first
              </div>
              <p className={styles.priorityText}>{result.top_priority}</p>
            </div>

            {/* Upgrade banner */}
            {!isPro && (
              <div className={styles.upgradeBanner}>
                <div className={styles.upgradeBannerLeft}>
                  <p className={styles.upgradeBannerTitle}>There's more you haven't seen yet.</p>
                  <p className={styles.upgradeBannerSub}>
                    Unlock 8 dimension scores, all {result.observations.length} observations, and {result.improvements.length} improvement tips with specific rewrites. €2, one-time.
                  </p>
                </div>
                <div className={styles.upgradeBannerActions}>
                  <button className={styles.upgradeBannerCta} onClick={() => setShowUpgradeModal(true)}>Unlock for €2</button>
                  <button className={styles.upgradeBannerSecondary} onClick={() => setShowUpgradeModal(true)}>Premium — €7.99/mo</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <span>© 2026 CVCheck</span>
        <div className={styles.footerLinks}>
          <Link href="/privacy" className={styles.footerLink}>Privacy</Link>
          <Link href="/terms"   className={styles.footerLink}>Terms</Link>
          <button className={styles.footerLink} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontSize: 12, cursor: 'pointer', padding: 0 }} onClick={() => setShowUpgradeModal(true)}>Pricing</button>
        </div>
      </footer>
    </div>
  )
}
