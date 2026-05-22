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
  needs_work: '#F87171', below_average: '#FB923C', average: '#FBB040',
  good: '#86EFAC', strong: '#4ADE80', excellent: '#67E8F9',
}
const IMPACT_C: Record<ImprovementTip['impact'], string> = {
  high: '#F87171', medium: '#FBB040', low: '#6B7280',
}

const PLANS = {
  free:    { label: 'Free',    price: '€0',    period: '', features: ['Overall score /100', 'Rating & summary', '2 of 4 observations', '1 of 3 improvement tips'] },
  pro:     { label: 'Pro',     price: '€2',    period: 'one-time', features: ['8 detailed dimension scores', 'All 4 observations', 'All 3 tips with rewrites', 'Permanent access, no sub'] },
  premium: { label: 'Premium', price: '€7.99', period: '/month',   features: ['Everything in Pro', 'Unlimited analyses', 'History & progress tracking', 'Priority support'] },
}

const HOW = [
  { n: '01', title: 'Paste a link or drop your PDF', desc: 'Portfolio URL, LinkedIn, personal site, or a PDF CV. Submitting takes 5 seconds.' },
  { n: '02', title: 'We read it like a recruiter would', desc: 'CVCheck scores 8 things recruiters actually look for — positioning, proof, structure, language, and more.' },
  { n: '03', title: 'You get a score and real feedback', desc: 'Not vague suggestions. Specific rewrites you can copy and use today.' },
]

const FEATS = [
  { ico: '📊', title: 'A score that means something', desc: 'One number out of 100, broken down across 8 weighted dimensions. You know exactly where you stand and why.' },
  { ico: '🔍', title: '8 dimensions scored separately', desc: 'First impression, positioning, experience proof, skills, credibility, structure, language, CTA. Each one matters.' },
  { ico: '💬', title: 'Direct, no-sugarcoating feedback', desc: 'Strengths labeled as strengths. Weaknesses labeled as weaknesses. No "this is a great start" when it isn\'t.' },
  { ico: '✏️', title: 'Rewrites you can use right now', desc: 'Every tip includes a rewritten version. Copy it, tweak it, paste it in. Done.' },
]

const LOAD_STEPS = [
  'Reading your content…',
  'Evaluating structure & positioning…',
  'Scoring 8 dimensions…',
  'Writing your recommendations…',
]

/* ── Icons ─────────────────────────────────────────────────────────────────── */
const Chk = ({ s = 13, c = 'var(--score-hi)' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const Lock = ({ s = 12 }: { s?: number }) => (
  <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)
const Arr = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)
const Chev = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

/* ── ScoreRing ──────────────────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const r = 54, c = 2 * Math.PI * r
  const dash = (score / 100) * c
  const color = score >= 66 ? 'var(--score-hi)' : score >= 40 ? 'var(--score-md)' : 'var(--score-lo)'
  return (
    <div className={styles.scoreRing}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="7"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`} transform="rotate(-90 68 68)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}/>
      </svg>
      <div className={styles.scoreRingInner}>
        <span className={styles.scoreNum} style={{ color }}>{score}</span>
        <span className={styles.scoreOf}>/100</span>
      </div>
    </div>
  )
}

/* ── DimBar ─────────────────────────────────────────────────────────────────── */
function DimBar({ label, score, max, desc, locked, onUnlock }: {
  label: string; score: number; max: number; desc: string
  locked?: boolean; onUnlock?: () => void
}) {
  const pct   = (score / max) * 100
  const color = pct >= 66 ? 'var(--score-hi)' : pct >= 40 ? 'var(--score-md)' : 'var(--score-lo)'
  if (locked) return (
    <div className={`${styles.dimBar} ${styles.dimLocked}`} onClick={onUnlock}>
      <div className={styles.dimBarRow}>
        <div>
          <span className={styles.dimLabel} style={{ filter: 'blur(4px)', userSelect: 'none' }}>{label}</span>
          <span className={styles.dimDesc} style={{ filter: 'blur(3px)', userSelect: 'none' }}>{desc}</span>
        </div>
        <span className={styles.lockIco}><Lock/></span>
      </div>
      <div className={styles.track}><div className={styles.fillLocked} style={{ width: '65%' }}/></div>
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
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%`, background: color }}/>
      </div>
    </div>
  )
}

/* ── ObsCard ────────────────────────────────────────────────────────────────── */
function ObsCard({ obs, locked, onUnlock }: { obs: Observation; locked: boolean; onUnlock: () => void }) {
  const str  = obs.type === 'strength'
  const col  = str ? 'var(--score-hi)' : 'var(--score-lo)'
  const bg   = str ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)'
  const bord = str ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'

  if (locked) return (
    <div onClick={onUnlock}
      style={{ padding: '14px 20px', borderRadius: 'var(--r-md)', background: 'var(--bg-1)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--accent-sub)')}
      onMouseOut={e  => (e.currentTarget.style.background = 'var(--bg-1)')}>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', filter: 'blur(5px)', userSelect: 'none', flex: 1, margin: 0, lineHeight: 1.65 }}>{obs.detail}</p>
      <div style={{ color: 'var(--ink-3)', flexShrink: 0, marginTop: 2 }}><Lock/></div>
    </div>
  )
  return (
    <div className={styles.obsCard} style={{ background: bg, border: `1px solid ${bord}` }}>
      <div className={styles.obsHead}>
        <span className={styles.obsBadge} style={{ color: col, background: str ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)' }}>
          {str ? '✓ Strength' : '✗ Weakness'}
        </span>
        <span className={styles.obsTitle}>{obs.title}</span>
      </div>
      <p className={styles.obsDetail}>{obs.detail}</p>
    </div>
  )
}

/* ── TipCard ────────────────────────────────────────────────────────────────── */
function TipCard({ tip, index, locked, onUnlock }: {
  tip: ImprovementTip; index: number; locked: boolean; onUnlock: () => void
}) {
  const [open, setOpen] = useState(index === 0 && !locked)
  const ic = IMPACT_C[tip.impact]
  if (locked) return (
    <div className={`${styles.tipCard} ${styles.tipLocked}`} onClick={onUnlock}>
      <div className={styles.tipHead} style={{ cursor: 'pointer' }}>
        <div className={styles.tipHeadL}>
          <span className={styles.tipImpact} style={{ color: ic, background: `${ic}14`, borderColor: `${ic}28` }}>{tip.impact}</span>
          <span className={styles.tipArea} style={{ filter: 'blur(4px)', userSelect: 'none' }}>{tip.area}</span>
        </div>
        <div className={styles.lockBadge}><Lock s={10}/>Unlock</div>
      </div>
      <div className={styles.tipBody} style={{ paddingTop: 0 }}>
        <p style={{ filter: 'blur(5px)', userSelect: 'none', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>{tip.problem}</p>
      </div>
    </div>
  )
  return (
    <div className={styles.tipCard}>
      <button className={styles.tipHead} onClick={() => setOpen(!open)}>
        <div className={styles.tipHeadL}>
          <span className={styles.tipImpact} style={{ color: ic, background: `${ic}14`, borderColor: `${ic}28` }}>{tip.impact}</span>
          <span className={styles.tipArea}>{tip.area}</span>
        </div>
        <span className={styles.tipChev}><Chev open={open}/></span>
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

/* ── AccountDropdown ────────────────────────────────────────────────────────── */
function AccountDropdown({ user, tier, onOpenAccount, onOpenPlans, onSignOut }: {
  user: { email?: string }; tier: string
  onOpenAccount: () => void; onOpenPlans: () => void; onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', color: 'var(--ink-2)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', transition: 'all 0.1s' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <style>{`@keyframes ddIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}.acdd-r:hover{background:var(--bg-2)!important;color:var(--ink-1)!important}.acdd-d:hover{background:rgba(248,113,113,0.08)!important;color:var(--score-lo)!important}`}</style>
      <button className={styles.accountBtn} onClick={() => setOpen(v => !v)}>
        <span className={styles.accountAvatar}>{(user.email ?? 'U').slice(0, 2).toUpperCase()}</span>
        <span className={styles.accountEmail}>{user.email?.split('@')[0]}</span>
        <svg width="11" height="11" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-xl)', zIndex: 1000, animation: 'ddIn 0.15s ease' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 3, textTransform: 'capitalize' }}>{tier} plan</div>
          </div>
          <div style={{ padding: '4px 0' }}>
            {[
              { label: 'My account', fn: () => { onOpenAccount(); setOpen(false) } },
              { label: 'History',    fn: () => { router.push('/history'); setOpen(false) } },
              { label: 'Plans',      fn: () => { onOpenPlans(); setOpen(false) } },
            ].map(({ label, fn }) => (
              <button key={label} className="acdd-r" onClick={fn} style={row}>{label}</button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: '4px 0' }}>
            <button className="acdd-d" onClick={() => { onSignOut(); setOpen(false) }} style={{ ...row, color: 'var(--score-lo)' }}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── PlansModal ─────────────────────────────────────────────────────────────── */
function PlansModal({ tier, onClose, onBuy }: { tier: string; onClose: () => void; onBuy: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: tier === 'premium' ? 400 : 680, background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-2xl)', boxShadow: 'var(--sh-xl)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto', animation: 'scaleIn 0.22s cubic-bezier(0.16,1,0.3,1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-1)', margin: 0, letterSpacing: '-0.03em' }}>Plans</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '4px 0 0' }}>Active: <strong style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{tier}</strong></p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'var(--font-body)' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tier === 'premium' ? (
            <div style={{ padding: 22, borderRadius: 'var(--r-lg)', border: '1px solid var(--accent-glow)', background: 'var(--accent-sub)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0, lineHeight: 1.65 }}>You have full access. Thanks for being Premium!</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PLANS.premium.features.map(f => <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}><Chk/>{f}</li>)}
              </ul>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: tier === 'pro' ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
              {(tier === 'pro' ? ['premium'] as const : ['free', 'pro', 'premium'] as const).map(pk => {
                const p = PLANS[pk]; const isCur = tier === pk; const isFeat = pk === 'pro'
                return (
                  <div key={pk} style={{ padding: 20, borderRadius: 'var(--r-lg)', border: `${isFeat ? '1.5px' : '1px'} solid ${isFeat ? 'var(--accent)' : 'var(--border-2)'}`, background: isFeat ? 'color-mix(in srgb, var(--accent) 5%, var(--bg-1))' : 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
                    {isFeat && <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'var(--ink-inv)', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap', fontFamily: 'var(--font-display)' }}>Best value</div>}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-3)' }}>{p.label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--ink-1)', marginTop: 6, lineHeight: 1 }}>
                        {p.price}{p.period && <span style={{ fontSize: 13, fontWeight: 400, fontFamily: 'var(--font-body)', color: 'var(--ink-3)' }}> {p.period}</span>}
                      </div>
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {p.features.map(f => <li key={f} style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}><Chk s={12}/>{f}</li>)}
                    </ul>
                    {isCur ? (
                      <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)' }}>Current plan</div>
                    ) : pk === 'free' ? (
                      <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)' }}>Free — always</div>
                    ) : (
                      <button onClick={onBuy} style={{ padding: '11px', border: 'none', borderRadius: 'var(--r-md)', background: pk === 'pro' ? 'var(--accent)' : 'var(--ink-1)', color: pk === 'pro' ? 'var(--ink-inv)' : 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', transition: 'all 0.15s' }}>
                        Get {p.label}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Lock s={11}/> Stripe · Secure payment · Cancel anytime (Premium)
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function Home() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const { tier } = useTier(user?.id)

  const [showAuth,    setShowAuth]    = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showPlans,   setShowPlans]   = useState(false)

  const [mode,    setMode]    = useState<InputMode>('url')
  const [url,     setUrl]     = useState('')
  const [file,    setFile]    = useState<File | null>(null)
  const [dragging,setDragging]= useState(false)
  const [state,   setState]   = useState<AppState>('idle')
  const [result,  setResult]  = useState<GatedAnalysisResult | null>(null)
  const [err,     setErr]     = useState('')
  const [copied,  setCopied]  = useState(false)
  const [scans,   setScans]   = useState(0)
  const [lstep,   setLstep]   = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state !== 'loading') { setLstep(0); return }
    const ts = LOAD_STEPS.map((_, i) => setTimeout(() => setLstep(i), i * 4200))
    return () => ts.forEach(clearTimeout)
  }, [state])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') setFile(f)
  }, [])

  const submit = async () => {
    if (mode === 'url' && !url.trim()) return
    if (mode === 'pdf' && !file) return
    if (tier === 'free' && scans >= 1) { setShowUpgrade(true); return }
    setState('loading'); setErr(''); setResult(null)
    try {
      let res: Response
      if (mode === 'pdf' && file) {
        const fd = new FormData(); fd.append('file', file)
        res = await fetch('/api/roast', { method: 'POST', body: fd, headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} })
      } else {
        res = await fetch('/api/roast', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ url: url.trim() }) })
      }
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.error === 'free_limit_reached') { setShowUpgrade(true); setState('idle'); return }
        throw new Error(data.error || 'Analysis failed')
      }
      setResult(data); setState('result'); setScans(n => n + 1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong'); setState('error')
    }
  }

  const reset = () => { setState('idle'); setResult(null); setErr(''); setUrl(''); setFile(null) }
  const share = async () => {
    if (!result) return
    await navigator.clipboard.writeText(`My CV score: ${result.total_score}/100 (${RATING_LABELS[result.rating]})\n${result.summary}\n\ncvcheck.app`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const isPro = result?.tier === 'pro' || result?.tier === 'premium'

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark}>
              <svg width="16" height="16" fill="none" stroke="var(--ink-inv)" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <span className={styles.logoText}>CVCheck</span>
          </Link>
          <div className={styles.headerRight}>
            {!authLoading && (user
              ? <AccountDropdown user={user} tier={tier} onOpenAccount={() => setShowAccount(true)} onOpenPlans={() => setShowPlans(true)} onSignOut={signOut}/>
              : <>
                  <button className={styles.signInBtn} onClick={() => setShowAuth(true)}>Sign in</button>
                  <button className={styles.upgradeHeaderBtn} onClick={() => setShowUpgrade(true)}>Get Pro — €2</button>
                </>
            )}
            <ThemeToggle/>
          </div>
        </div>
      </header>

      {showAuth    && <AuthModal onClose={() => setShowAuth(false)}/>}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} roastId={result?.analysis_id} userId={user?.id} userEmail={user?.email}/>}
      {showAccount && user && <AccountModal onClose={() => setShowAccount(false)} userId={user.id} userEmail={user.email ?? ''} onUpgrade={() => { setShowAccount(false); setShowPlans(true) }} onSignOut={() => { setShowAccount(false); signOut() }}/>}
      {showPlans   && <PlansModal tier={tier} onClose={() => setShowPlans(false)} onBuy={() => { setShowPlans(false); setShowUpgrade(true) }}/>}

      <main className={styles.main}>

        {/* ── IDLE / ERROR ── */}
        {(state === 'idle' || state === 'error') && (
          <div className={styles.hero}>

            {/* 2-col hero */}
            <div className={styles.heroGrid}>

              {/* Left */}
              <div className={styles.heroLeft}>
                <div className={styles.heroBadge}>
                  <span className={styles.heroBadgeDot}/>
                  AI feedback · CV &amp; portfolios
                </div>

                <h1 className={styles.heroTitle}>
                  Find out why<br/>
                  your CV isn't<br/>
                  getting{' '}
                  <span className={styles.heroTitleAccent}>replies.</span>
                </h1>

                <p className={styles.heroSub}>
                  Paste a link or upload your CV. Get a score, a breakdown of what's working and what isn't, and specific rewrites — in about 30 seconds.
                </p>

                <div className={styles.heroTrust}>
                  {['No account required', 'CV, portfolio or LinkedIn URL', 'Results in under 30 seconds', 'One honest free scan'].map(t => (
                    <div key={t} className={styles.heroTrustRow}>
                      <span className={styles.heroTrustCheck}>
                        <svg width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — input card */}
              <div className={styles.heroRight}>
                <div className={styles.inputCard}>
                  <div className={styles.inputLabel}>Analyze your CV</div>

                  <div className={styles.tabs}>
                    {(['url', 'pdf'] as const).map(m => (
                      <button key={m} className={`${styles.tab} ${mode === m ? styles.tabActive : ''}`} onClick={() => setMode(m)}>
                        {m === 'url'
                          ? <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Paste a link</>
                          : <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Upload PDF</>}
                      </button>
                    ))}
                  </div>

                  {mode === 'url' && (
                    <div className={styles.urlWrap}>
                      <svg className={styles.urlIcon} width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                      </svg>
                      <input type="url" className={styles.urlInput}
                        placeholder="yoursite.com or linkedin.com/in/you"
                        value={url} onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submit()}
                        autoComplete="off" spellCheck={false}/>
                    </div>
                  )}

                  {mode === 'pdf' && (
                    <div className={`${styles.drop} ${dragging ? styles.dropActive : ''} ${file ? styles.dropHasFile : ''}`}
                      onDrop={onDrop}
                      onDragOver={e => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onClick={() => !file && fileRef.current?.click()}>
                      <input ref={fileRef} type="file" accept=".pdf,application/pdf"
                        onChange={e => { const f = e.target.files?.[0]; if (f?.type === 'application/pdf') setFile(f) }}
                        style={{ display: 'none' }}/>
                      {file ? (
                        <div className={styles.fileRow}>
                          <div className={styles.fileIconBox}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <div className={styles.fileMeta}>
                            <div className={styles.fileName}>{file.name}</div>
                            <div className={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB · PDF ready</div>
                          </div>
                          <button className={styles.fileX} onClick={e => { e.stopPropagation(); setFile(null) }}>
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className={styles.dropPrompt}>
                          <div className={styles.dropIconBox}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          </div>
                          <span className={styles.dropText}>Drop your CV here</span>
                          <span className={styles.dropHint}>or click to browse · PDF · max 10 MB</span>
                        </div>
                      )}
                    </div>
                  )}

                  {state === 'error' && (
                    <div className={styles.errBanner}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {err}
                    </div>
                  )}

                  <button className={styles.cta} onClick={submit} disabled={mode === 'url' ? !url.trim() : !file}>
                    Analyze my CV <Arr/>
                  </button>

                  <p className={styles.freeNote}>
                    {tier === 'free' && scans >= 1
                      ? <>Free scan used — <button className={styles.freeNoteLink} onClick={() => setShowUpgrade(true)}>upgrade for unlimited</button></>
                      : tier === 'premium'
                        ? <>✓ Unlimited · Premium active</>
                        : <>One free scan · No account needed</>}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className={styles.stats}>
              {[
                { n: '8',    accent: false, label: 'Dimensions scored'      },
                { n: '~30s', accent: false, label: 'From link to results'   },
                { n: '€2',   accent: true,  label: 'Full access, one-time'  },
                { n: '0',    accent: false, label: 'Sugarcoating'           },
              ].map(({ n, accent, label }) => (
                <div key={label} className={styles.statItem}>
                  <span className={`${styles.statNum} ${accent ? styles.statNumAccent : ''}`}>{n}</span>
                  <span className={styles.statLabel}>{label}</span>
                </div>
              ))}
            </div>

            {/* How it works */}
            <section className={styles.howSec}>
              <div>
                <p className={styles.secLabel}>How it works</p>
                <h2 className={styles.secTitle}>Simple enough that<br/>you'll actually use it.</h2>
              </div>
              <div className={styles.howGrid}>
                {HOW.map(s => (
                  <div key={s.n} className={styles.howCard}>
                    <div className={styles.howN}>{s.n}</div>
                    <p className={styles.howTitle}>{s.title}</p>
                    <p className={styles.howDesc}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Features */}
            <section className={styles.featSec}>
              <div>
                <p className={styles.secLabel}>What you get</p>
                <h2 className={styles.secTitle}>Feedback you can<br/>do something with.</h2>
              </div>
              <div className={styles.featGrid}>
                {FEATS.map(f => (
                  <div key={f.title} className={styles.featCard}>
                    <div className={styles.featEmoji}>{f.ico}</div>
                    <p className={styles.featTitle}>{f.title}</p>
                    <p className={styles.featDesc}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Pricing */}
            <section className={styles.priceSec}>
              <div>
                <p className={styles.secLabel}>Pricing</p>
                <h2 className={styles.secTitle}>No tricks,<br/>no "contact us".</h2>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65, marginTop: 10, maxWidth: 420 }}>
                  Try it free. If you want the full picture, Pro is €2 — one-time, no subscription.
                </p>
              </div>
              <div className={styles.priceGrid}>
                {(['free', 'pro', 'premium'] as const).map(pk => {
                  const p = PLANS[pk]; const feat = pk === 'pro'; const cur = tier === pk
                  return (
                    <div key={pk} className={`${styles.priceCard} ${feat ? styles.priceFeatured : ''}`}>
                      {feat && <div className={styles.priceBadge}>Most popular</div>}
                      <div>
                        <div className={styles.priceTier}>{p.label}</div>
                        <div style={{ marginTop: 8 }}>
                          <span className={styles.priceAmt}>{p.price}</span>
                          {p.period && <span className={styles.pricePer}> {p.period}</span>}
                        </div>
                      </div>
                      <div className={styles.priceDivider}/>
                      <ul className={styles.priceFeats}>
                        {p.features.map(f => (
                          <li key={f} className={styles.priceFeat}><Chk/>{f}</li>
                        ))}
                      </ul>
                      {cur
                        ? <div className={styles.priceCtaGhost}>Current plan</div>
                        : pk === 'free'
                          ? <button className={`${styles.priceCtaGhost} ${styles.priceCtaGhostClick}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Start free ↑</button>
                          : pk === 'pro'
                            ? <button className={styles.priceCtaGold} onClick={() => setShowUpgrade(true)}>Get Pro — €2</button>
                            : <button className={styles.priceCtaDark} onClick={() => setShowUpgrade(true)}>Get Premium</button>
                      }
                    </div>
                  )
                })}
              </div>
              <p className={styles.priceFooter}><Lock s={11}/> Stripe · Secure checkout · No subscription on Pro</p>
            </section>
          </div>
        )}

        {/* ── LOADING ── */}
        {state === 'loading' && (
          <div className={styles.loading}>
            <div className={styles.loadSpinner}/>
            <p className={styles.loadTitle}>Analyzing your CV…</p>
            <div className={styles.loadSteps}>
              {LOAD_STEPS.map((s, i) => (
                <div key={s} className={`${styles.loadStep} ${i === lstep ? styles.loadStepActive : ''}`} style={{ opacity: i <= lstep ? 1 : 0.22 }}>
                  <div className={`${styles.loadDot} ${i === lstep ? styles.loadDotActive : ''}`}/>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {state === 'result' && result && (
          <div className={styles.results}>
            <div className={styles.resultsNav}>
              <button className={styles.navBtn} onClick={reset}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                New analysis
              </button>
              <button className={styles.navBtn} onClick={share}>
                {copied
                  ? <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                  : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share score</>}
              </button>
            </div>

            {/* Score hero */}
            <div className={styles.scoreHero}>
              <ScoreRing score={result.total_score}/>
              <div className={styles.scoreMeta}>
                <span className={styles.ratingPill} style={{ color: RATING_COLORS[result.rating], borderColor: `${RATING_COLORS[result.rating]}25`, background: `${RATING_COLORS[result.rating]}0D` }}>
                  {RATING_LABELS[result.rating]}
                </span>
                <p className={styles.scoreSummary}>{result.summary}</p>
                {result.source && <span className={styles.sourceTag}>{result.source}</span>}
              </div>
            </div>

            {/* Breakdown */}
            <div className={styles.rSec}>
              <div className={styles.rSecHead}>
                <span className={styles.rSecLabel}>Score Breakdown</span>
                {result.scores_locked && <button className={styles.unlockBtn} onClick={() => setShowUpgrade(true)}><Lock s={11}/>Unlock — €2</button>}
              </div>
              <div className={styles.dimBars}>
                {SCORE_DIMENSIONS.map(({ key, label, max, desc }) => (
                  <DimBar key={key} label={label}
                    score={(result.scores as unknown as Record<string, number>)[key] ?? 0}
                    max={max} desc={desc}
                    locked={result.scores_locked}
                    onUnlock={() => setShowUpgrade(true)}/>
                ))}
              </div>
            </div>

            {/* Observations */}
            <div className={styles.rSec}>
              <div className={styles.rSecHead}>
                <span className={styles.rSecLabel}>Observations</span>
                {!isPro && result.observations.length > result.observations_locked_from && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgrade(true)}><Lock s={11}/>See all {result.observations.length}</button>
                )}
              </div>
              <div className={styles.obsGrid}>
                {result.observations.map((obs, i) => (
                  <ObsCard key={i} obs={obs} locked={i >= result.observations_locked_from} onUnlock={() => setShowUpgrade(true)}/>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className={styles.rSec}>
              <div className={styles.rSecHead}>
                <span className={styles.rSecLabel}>How to improve</span>
                {!isPro && result.improvements.length > result.improvements_locked_from && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgrade(true)}><Lock s={11}/>{result.improvements.length - result.improvements_locked_from} more locked</button>
                )}
              </div>
              <div className={styles.tipsBox}>
                {result.improvements.map((tip, i) => (
                  <TipCard key={i} tip={tip} index={i} locked={i >= result.improvements_locked_from} onUnlock={() => setShowUpgrade(true)}/>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className={styles.priority}>
              <div className={styles.priorityEye}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Do this first
              </div>
              <p className={styles.priorityText}>{result.top_priority}</p>
            </div>

            {/* Upgrade banner */}
            {!isPro && (
              <div className={styles.upBanner}>
                <div className={styles.upBannerL}>
                  <p className={styles.upBannerTitle}>There's more you haven't seen.</p>
                  <p className={styles.upBannerSub}>
                    Unlock 8 dimension scores, all {result.observations.length} observations, and {result.improvements.length} improvement tips with rewrites. €2, one-time.
                  </p>
                </div>
                <div className={styles.upBannerR}>
                  <button className={styles.upBannerCta} onClick={() => setShowUpgrade(true)}>Unlock for €2</button>
                  <button className={styles.upBannerSec} onClick={() => setShowUpgrade(true)}>Premium — €7.99/mo</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <span>© 2026 CVCheck</span>
        <div className={styles.footLinks}>
          <Link href="/privacy" className={styles.footLink}>Privacy</Link>
          <Link href="/terms"   className={styles.footLink}>Terms</Link>
          <button className={styles.footLink} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer', padding: 0 }} onClick={() => setShowUpgrade(true)}>Pricing</button>
        </div>
      </footer>
    </div>
  )
}
