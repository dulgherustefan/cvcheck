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
import { createSupabaseBrowser } from '@/lib/supabase'
import styles from './page.module.css'

type InputMode = 'url' | 'pdf'
type AppState  = 'idle' | 'loading' | 'result' | 'error'

const RATING_LABELS: Record<Rating, string> = {
  needs_work: 'Needs Work', below_average: 'Below Average', average: 'Average',
  good: 'Good', strong: 'Strong', excellent: 'Excellent',
}
const RATING_COLORS: Record<Rating, string> = {
  needs_work: '#DC2626', below_average: '#EA580C', average: '#CA8A04',
  good: '#65A30D', strong: '#16A34A', excellent: '#0891B2',
}
const IMPACT_COLORS: Record<ImprovementTip['impact'], string> = {
  high: '#DC2626', medium: '#CA8A04', low: '#6B7280',
}

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
      <div className={styles.dimBarHeader}>
        <div>
          <span className={styles.dimLabel} style={{ filter:'blur(4px)', userSelect:'none' }}>{label}</span>
          <span className={styles.dimDesc}  style={{ filter:'blur(3px)', userSelect:'none' }}>{desc}</span>
        </div>
        <span className={styles.lockIcon}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </span>
      </div>
      <div className={styles.barTrack}><div className={styles.barFillLocked} style={{ width:'60%' }}/></div>
    </div>
  )

  return (
    <div className={styles.dimBar}>
      <div className={styles.dimBarHeader}>
        <div>
          <span className={styles.dimLabel}>{label}</span>
          <span className={styles.dimDesc}>{desc}</span>
        </div>
        <span className={styles.dimScore} style={{ color }}>
          {score}<span className={styles.dimMax}>/{max}</span>
        </span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width:`${pct}%`, background:color, transition:'width 1s cubic-bezier(0.4,0,0.2,1)' }}/>
      </div>
    </div>
  )
}

// ─── ObservationCard ──────────────────────────────────────────────────────────
function ObservationCard({ obs, index, locked, onUnlock }: {
  obs: Observation; index: number; locked: boolean; onUnlock: () => void
}) {
  const isStrength = obs.type === 'strength'
  const color  = isStrength ? 'var(--score-high)' : 'var(--score-low)'
  const bg     = isStrength ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)'
  const border = isStrength ? 'rgba(22,163,74,0.18)' : 'rgba(220,38,38,0.18)'

  if (locked) return (
    <div onClick={onUnlock} style={{
      padding:'14px 18px', borderRadius:'var(--radius-md)',
      background:'var(--bg-elevated)', border:'1px solid var(--border)',
      display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer',
    }}
    onMouseOver={e => (e.currentTarget.style.background='var(--accent-subtle)')}
    onMouseOut={e  => (e.currentTarget.style.background='var(--bg-elevated)')}>
      <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.05em', padding:'2px 8px', borderRadius:4, background:'var(--bg-muted)', color:'var(--text-tertiary)', flexShrink:0 }}>
        {String(index+1).padStart(2,'0')}
      </span>
      <p style={{ fontSize:13, color:'var(--text-secondary)', filter:'blur(5px)', userSelect:'none', flex:1, margin:0, lineHeight:1.6 }}>{obs.detail}</p>
      <div style={{ color:'var(--text-tertiary)', flexShrink:0, display:'flex', alignItems:'center' }}>
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      </div>
    </div>
  )

  return (
    <div style={{ padding:'16px 18px', borderRadius:'var(--radius-md)', background:bg, border:`1px solid ${border}`, display:'flex', flexDirection:'column', gap:8 }}>
      <div className={styles.obsCardHeader}>
        <span className={styles.obsTypeBadge} style={{ color, background:isStrength?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.1)' }}>
          {isStrength ? '✓ Strength' : '✗ Weakness'}
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

  if (locked) return (
    <div className={`${styles.tipCard} ${styles.tipCardLocked}`} onClick={onUnlock}>
      <div className={styles.tipHeader} style={{ cursor:'pointer' }}>
        <div className={styles.tipHeaderLeft}>
          <span className={styles.tipImpact} style={{ color:IMPACT_COLORS[tip.impact], background:`${IMPACT_COLORS[tip.impact]}14`, borderColor:`${IMPACT_COLORS[tip.impact]}28` }}>{tip.impact}</span>
          <span className={styles.tipArea} style={{ filter:'blur(4px)', userSelect:'none' }}>{tip.area}</span>
        </div>
        <div className={styles.lockBadge}>
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Unlock
        </div>
      </div>
      <div className={styles.tipBody} style={{ paddingTop:0 }}>
        <p style={{ filter:'blur(5px)', userSelect:'none', fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, margin:0 }}>{tip.problem}</p>
      </div>
    </div>
  )

  return (
    <div className={styles.tipCard}>
      <button className={styles.tipHeader} onClick={() => setOpen(!open)}>
        <div className={styles.tipHeaderLeft}>
          <span className={styles.tipImpact} style={{ color:IMPACT_COLORS[tip.impact], background:`${IMPACT_COLORS[tip.impact]}14`, borderColor:`${IMPACT_COLORS[tip.impact]}28` }}>{tip.impact}</span>
          <span className={styles.tipArea}>{tip.area}</span>
        </div>
        <svg className={`${styles.tipChevron} ${open ? styles.tipChevronOpen : ''}`} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className={styles.tipBody}>
          <p className={styles.tipIssue}>{tip.problem}</p>
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
const TIER_META: Record<string,{label:string;color:string}> = {
  free:    { label:'Free',    color:'var(--text-tertiary)' },
  pro:     { label:'Pro',     color:'var(--accent-text)'   },
  premium: { label:'Premium', color:'var(--score-high)'    },
}
const ddItem: React.CSSProperties = {
  display:'flex', alignItems:'center', gap:9, width:'100%',
  padding:'9px 16px', background:'transparent', border:'none',
  color:'var(--text-secondary)', fontSize:13, cursor:'pointer',
  textAlign:'left' as const, fontFamily:'var(--font-sans)', transition:'background 0.1s, color 0.1s',
}

function AccountDropdown({ user, tier, onOpenAccount, onOpenPlans, onSignOut }: {
  user: { email?:string }; tier:string
  onOpenAccount:()=>void; onOpenPlans:()=>void; onSignOut:()=>void
}) {
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const meta   = TIER_META[tier] ?? TIER_META.free
  const initials = (user.email ?? 'U').slice(0,2).toUpperCase()

  useEffect(() => {
    const h = (e:MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <style>{`@keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}.dd-row:hover{background:var(--bg-subtle)!important;color:var(--text-primary)!important}.dd-danger:hover{background:rgba(239,68,68,0.07)!important;color:#ef4444!important}`}</style>
      <button onClick={() => setOpen(v => !v)} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px 4px 4px', background:open?'var(--bg-subtle)':'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:40, cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-sans)' }}>
        <span style={{ width:26, height:26, borderRadius:'50%', background:'var(--accent-subtle)', color:'var(--accent-text)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{initials}</span>
        <span style={{ maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, fontWeight:500, color:'var(--text-secondary)' }}>{user.email?.split('@')[0]}</span>
        <svg width="11" height="11" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.2s', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:220, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)', zIndex:1000, animation:'dropIn 0.15s ease' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
            <div style={{ fontSize:11, color:meta.color, fontWeight:600, marginTop:3 }}>{meta.label} plan</div>
          </div>
          <div style={{ padding:'4px 0' }}>
            <button className="dd-row" onClick={() => { onOpenAccount(); setOpen(false) }} style={ddItem}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              My account
            </button>
            <button className="dd-row" onClick={() => { router.push('/history'); setOpen(false) }} style={ddItem}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
              History
            </button>
            <button className="dd-row" onClick={() => { onOpenPlans(); setOpen(false) }} style={ddItem}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Plans
            </button>
          </div>
          <div style={{ borderTop:'1px solid var(--border)', padding:'4px 0' }}>
            <button className="dd-danger" onClick={() => { onSignOut(); setOpen(false) }} style={{ ...ddItem, color:'#ef4444' }}>
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
const PLAN_DEFS = {
  free:    { label:'Free',    color:'var(--text-tertiary)', price:'€0',    period:'', features:['Overall score /100','Rating & summary','2 observations','1 improvement tip'] },
  pro:     { label:'Pro',     color:'var(--accent-text)',   price:'€2',    period:'one-time', features:['Overall score + 8 detailed dimensions','4 observations with context','3 improvement tips with rewrites','One-time — no subscription'] },
  premium: { label:'Premium', color:'var(--score-high)',    price:'€7.99', period:'/month',   features:['Everything in Pro','Unlimited analyses','Track progress over time','Priority support'] },
}

function PlansModal({ tier, userId, userEmail, onClose, onBuy }: {
  tier:string; userId?:string; userEmail?:string; onClose:()=>void; onBuy:()=>void
}) {
  const currentPlan = PLAN_DEFS[tier as keyof typeof PLAN_DEFS] ?? PLAN_DEFS.free
  const isFree    = tier === 'free'
  const isPremium = tier === 'premium'

  const [showLoginGate, setShowLoginGate] = useState(false)
  const [pendingPlan, setPendingPlan]   = useState<'pro'|'premium'|null>(null)
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login'|'register'>('login')
  const [authError, setAuthError]   = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [buying, setBuying] = useState<'pro'|'premium'|null>(null)
  const supabase = createSupabaseBrowser()

  const handleBuy = (plan:'pro'|'premium') => {
    if (!userId) { setPendingPlan(plan); setShowLoginGate(true); return }
    setBuying(plan); onBuy()
  }
  const handleGoogle = async () => {
    setGoogleLoading(true); setAuthError('')
    const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:`${window.location.origin}/auth/callback` } })
    if (error) { setAuthError(error.message); setGoogleLoading(false) }
  }
  const handleAuth = async (e:React.FormEvent) => {
    e.preventDefault(); setAuthError(''); setAuthLoading(true)
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
    } else {
      if (password.length < 8) { setAuthError('Password must be at least 8 characters.'); setAuthLoading(false); return }
      const { error } = await supabase.auth.signUp({ email, password, options:{ emailRedirectTo:`${window.location.origin}/auth/callback` } })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
    }
    setAuthLoading(false); setShowLoginGate(false); onBuy()
  }

  const Chk = () => <svg width="13" height="13" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>

  const inputStyle:React.CSSProperties = { padding:'11px 14px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:14, outline:'none', fontFamily:'var(--font-sans)', width:'100%' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:24 }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth: showLoginGate ? 420 : (isFree ? 700 : 440), background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', boxShadow:'0 40px 100px rgba(0,0,0,0.35)', overflow:'hidden', maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'22px 24px', borderBottom:'1px solid var(--border)' }}>
          <div>
            {!showLoginGate ? (
              <><h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0, letterSpacing:'-0.02em' }}>Plans</h2><p style={{ fontSize:13, color:'var(--text-secondary)', margin:'4px 0 0' }}>Active: <span style={{ fontWeight:700, color:currentPlan.color }}>{currentPlan.label}</span></p></>
            ) : (
              <><p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase' as const, color:'var(--accent-text)', margin:'0 0 4px' }}>{pendingPlan==='pro'?'Pro — €2 one-time':'Premium — €7.99/month'}</p><h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Sign in to continue</h2></>
            )}
          </div>
          <button onClick={showLoginGate ? () => setShowLoginGate(false) : onClose} style={{ background:'none', border:'1px solid var(--border)', width:32, height:32, borderRadius:'var(--radius-md)', cursor:'pointer', color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-sans)' }}>
            {showLoginGate ? <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg> : <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
          </button>
        </div>

        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
          {showLoginGate && (
            <>
              <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, margin:0 }}>Create a free account to purchase and access your analysis anytime.</p>
              <button onClick={handleGoogle} disabled={googleLoading||authLoading} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'12px 16px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.251 17.64 11.945 17.64 9.2z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                {googleLoading ? 'Connecting…' : 'Continue with Google'}
              </button>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ flex:1, height:1, background:'var(--border)' }}/><span style={{ fontSize:12, color:'var(--text-tertiary)' }}>or</span><div style={{ flex:1, height:1, background:'var(--border)' }}/></div>
              <div style={{ display:'flex', background:'var(--bg-subtle)', borderRadius:'var(--radius-md)', padding:3, gap:2 }}>
                {(['login','register'] as const).map(m => (
                  <button key={m} onClick={() => { setAuthMode(m); setAuthError('') }} style={{ flex:1, padding:'7px 12px', fontSize:13, fontWeight:500, background:authMode===m?'var(--bg-elevated)':'transparent', border:authMode===m?'1px solid var(--border)':'none', borderRadius:'calc(var(--radius-md) - 2px)', color:authMode===m?'var(--text-primary)':'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                    {m==='login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
              <form onSubmit={handleAuth} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Email</label>
                  <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required style={inputStyle} onFocus={e=>{e.target.style.borderColor='var(--accent)';e.target.style.boxShadow='0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)'}} onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none'}}/>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Password</label>
                  <input type="password" placeholder={authMode==='register'?'Min. 8 characters':'Your password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={authMode==='register'?'new-password':'current-password'} required style={inputStyle} onFocus={e=>{e.target.style.borderColor='var(--accent)'}} onBlur={e=>{e.target.style.borderColor='var(--border)'}}/>
                </div>
                {authError && <p style={{ fontSize:13, color:'#ef4444', margin:0, padding:'10px 12px', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:'var(--radius-sm)' }}>{authError}</p>}
                <button type="submit" disabled={authLoading||googleLoading} style={{ padding:'12px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-md)', color:'#fff', fontSize:14, fontWeight:600, cursor:authLoading?'not-allowed':'pointer', opacity:authLoading?0.6:1, fontFamily:'var(--font-sans)' }}>
                  {authLoading ? 'Processing…' : authMode==='login' ? 'Sign in & continue' : 'Create account & continue'}
                </button>
              </form>
            </>
          )}

          {!showLoginGate && (
            <>
              {isFree && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {(['free','pro','premium'] as const).map(pk => {
                    const p = PLAN_DEFS[pk]
                    return (
                      <div key={pk} style={{ padding:20, borderRadius:'var(--radius-lg)', border:`${pk==='pro'?'1.5px':'1px'} solid ${pk==='pro'?'var(--accent)':'var(--border)'}`, background:pk==='pro'?'color-mix(in srgb, var(--accent) 4%, var(--bg-elevated))':'var(--bg-elevated)', display:'flex', flexDirection:'column', gap:14, position:'relative' }}>
                        {pk==='pro' && <div style={{ position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)', background:'var(--accent)', color:'#fff', fontSize:9, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' as const }}>Best value</div>}
                        <div>
                          <span style={{ fontSize:11, fontWeight:800, color:p.color, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>{p.label}</span>
                          <div style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.03em', marginTop:6 }}>{p.price}{p.period&&<span style={{ fontSize:12, fontWeight:400, color:'var(--text-tertiary)' }}> {p.period}</span>}</div>
                        </div>
                        <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:7, flex:1 }}>
                          {p.features.map(f => <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}><Chk/>{f}</li>)}
                        </ul>
                        {pk==='free' ? (
                          <div style={{ padding:'9px', textAlign:'center' as const, fontSize:12, color:'var(--text-tertiary)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)' }}>Current plan</div>
                        ) : (
                          <button onClick={() => handleBuy(pk as 'pro'|'premium')} style={{ padding:'11px', border:'none', borderRadius:'var(--radius-md)', background:pk==='premium'?'var(--text-primary)':'var(--accent)', color:pk==='premium'?'var(--bg)':'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                            {buying===pk ? '…' : `Get ${p.label}`}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {tier==='pro' && (
                <div style={{ padding:22, borderRadius:'var(--radius-lg)', border:'1.5px solid var(--accent)', background:'color-mix(in srgb, var(--accent) 3%, var(--bg-elevated))', display:'flex', flexDirection:'column', gap:14 }}>
                  <div><span style={{ fontSize:11, fontWeight:800, color:'var(--score-high)', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Premium</span><div style={{ fontSize:26, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.03em', marginTop:6 }}>€7.99 <span style={{ fontSize:13, fontWeight:400, color:'var(--text-tertiary)' }}>/month</span></div></div>
                  <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:8 }}>{PLAN_DEFS.premium.features.map(f => <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'var(--text-secondary)' }}><Chk/>{f}</li>)}</ul>
                  <button onClick={() => handleBuy('premium')} style={{ padding:'12px', border:'none', borderRadius:'var(--radius-md)', background:'var(--text-primary)', color:'var(--bg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Upgrade to Premium</button>
                </div>
              )}
              {isPremium && (
                <div style={{ padding:22, borderRadius:'var(--radius-lg)', border:'1.5px solid var(--score-high)', background:'rgba(22,163,74,0.04)', display:'flex', flexDirection:'column', gap:12 }}>
                  <p style={{ fontSize:14, color:'var(--text-secondary)', margin:0, lineHeight:1.65 }}>You have full access to all CVCheck features. Thank you for being Premium!</p>
                  <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:8 }}>{PLAN_DEFS.premium.features.map(f => <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'var(--text-secondary)' }}><Chk/>{f}</li>)}</ul>
                </div>
              )}
              <p style={{ textAlign:'center' as const, fontSize:12, color:'var(--text-tertiary)', margin:0, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure checkout via Stripe · Cancel anytime
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Static landing sections ──────────────────────────────────────────────────
const HOW_STEPS = [
  { n:'01', title:'Paste a link or drop your PDF', desc:'Works with portfolio URLs, LinkedIn profiles, personal sites, or a PDF. Takes 5 seconds to submit.' },
  { n:'02', title:'We read it the way a recruiter would', desc:'CVCheck looks at 8 things recruiters actually care about — positioning, proof, structure, language, and more.' },
  { n:'03', title:'You get a score and real feedback', desc:'Not "consider improving your experience section." Actual specific changes, with rewritten examples you can use right away.' },
]
const FEATURES = [
  { icon:'📊', title:'A score that means something', desc:'A single number out of 100, broken down across 8 weighted dimensions. You\'ll know exactly where you stand and why.' },
  { icon:'🔍', title:'8 dimensions, not just a vibe check', desc:'First impression, positioning, experience proof, skills relevance, credibility, structure, language, and contact clarity — each scored separately.' },
  { icon:'💬', title:'Feedback that\'s actually direct', desc:'Strengths labeled as strengths, weaknesses labeled as weaknesses. No "this is a great start" when it isn\'t.' },
  { icon:'✏️', title:'Tips you can act on today', desc:'Every improvement comes with a specific rewrite. Copy it, tweak it, paste it in. Done.' },
]
const LOADING_STEPS = [
  'Reading your content…',
  'Evaluating structure & clarity…',
  'Scoring 8 dimensions…',
  'Writing your recommendations…',
]

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const { tier } = useTier(user?.id)

  const [showAuthModal,    setShowAuthModal]    = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showPlansModal,   setShowPlansModal]   = useState(false)

  const [mode, setMode]           = useState<InputMode>('url')
  const [url,  setUrl]            = useState('')
  const [file, setFile]           = useState<File | null>(null)
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
    const timers = LOADING_STEPS.map((_,i) => setTimeout(() => setLoadingStep(i), i * 4000))
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
        res = await fetch('/api/roast', { method:'POST', body:form, headers: session?.access_token ? { Authorization:`Bearer ${session.access_token}` } : {} })
      } else {
        res = await fetch('/api/roast', { method:'POST', headers:{ 'Content-Type':'application/json', ...(session?.access_token ? { Authorization:`Bearer ${session.access_token}` } : {}) }, body:JSON.stringify({ url:url.trim() }) })
      }
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.error === 'free_limit_reached') { setShowUpgradeModal(true); setAppState('idle'); return }
        throw new Error(data.error || 'Analysis failed')
      }
      setResult(data); setAppState('result'); setAnalysisCount(c => c+1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setAppState('error')
    }
  }

  const reset     = () => { setAppState('idle'); setResult(null); setError(''); setUrl(''); setFile(null) }
  const copyShare = async () => {
    if (!result) return
    await navigator.clipboard.writeText(`My CV score: ${result.total_score}/100 (${RATING_LABELS[result.rating]})\n${result.summary}\n\ncvcheck.app`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const isPro = result?.tier === 'pro' || result?.tier === 'premium'

  const scrollToTop = () => window.scrollTo({ top:0, behavior:'smooth' })

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <span className={styles.logoText}>CVCheck</span>
          </div>
          <div className={styles.headerRight}>
            {!authLoading && (user ? (
              <AccountDropdown user={user} tier={tier} onOpenAccount={() => setShowAccountModal(true)} onOpenPlans={() => setShowPlansModal(true)} onSignOut={() => signOut()}/>
            ) : (
              <div className={styles.headerAuthBtns}>
                <button className={styles.signInBtn} onClick={() => setShowAuthModal(true)}>Sign in</button>
                <button className={styles.upgradeHeaderBtn} onClick={() => setShowUpgradeModal(true)}>Get Pro — €2</button>
              </div>
            ))}
            <ThemeToggle/>
          </div>
        </div>
      </header>

      {/* ── Modals ── */}
      {showAuthModal    && <AuthModal onClose={() => setShowAuthModal(false)}/>}
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} roastId={result?.analysis_id} userId={user?.id} userEmail={user?.email}/>}
      {showAccountModal && user && <AccountModal onClose={() => setShowAccountModal(false)} userId={user.id} userEmail={user.email??''} onUpgrade={() => { setShowAccountModal(false); setShowPlansModal(true) }} onSignOut={() => { setShowAccountModal(false); signOut() }}/>}
      {showPlansModal   && <PlansModal tier={tier} userId={user?.id} userEmail={user?.email} onClose={() => setShowPlansModal(false)} onBuy={() => { setShowPlansModal(false); setShowUpgradeModal(true) }}/>}

      <main className={styles.main}>

        {/* ── IDLE / ERROR ── */}
        {(appState === 'idle' || appState === 'error') && (
          <div className={styles.hero}>
            <div className={styles.heroTop}>

              {/* Eyebrow */}
              <div className={styles.heroEyebrow}>
                <span className={styles.heroEyebrowDot}/>
                AI feedback on CVs &amp; portfolios
              </div>

              {/* Headline */}
              <h1 className={styles.heroTitle}>
                Find out why your CV<br/>
                <span className={styles.heroTitleItalic}>isn't getting replies.</span>
              </h1>

              {/* Sub */}
              <p className={styles.heroSubtitle}>
                Paste a link or upload your CV. You'll get a score, a breakdown of what's working and what isn't, and specific suggestions to fix it — in about 30 seconds.
              </p>

              {/* Trust bar */}
              <div className={styles.heroTrustBar}>
                {[
                  'No account required',
                  'CV, portfolio or LinkedIn',
                  'Takes 30 seconds',
                  'One free scan',
                ].map((t,i,arr) => (
                  <span key={t} style={{ display:'contents' }}>
                    <span className={styles.heroTrustItem}>
                      <svg className={styles.heroTrustCheck} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.8" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      {t}
                    </span>
                    {i < arr.length-1 && <span className={styles.heroTrustSep}/>}
                  </span>
                ))}
              </div>

              {/* Input card */}
              <div className={styles.inputCard}>
                <div className={styles.modeTabs}>
                  {(['url','pdf'] as const).map(m => (
                    <button key={m} className={`${styles.modeTab} ${mode===m?styles.modeTabActive:''}`} onClick={() => setMode(m)}>
                      {m==='url'
                        ? <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Link / URL</>
                        : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF upload</>
                      }
                    </button>
                  ))}
                </div>

                {mode === 'url' && (
                  <div className={styles.urlInputWrapper}>
                    <svg className={styles.urlIcon} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                    <input type="url" className={styles.urlField}
                      placeholder="yourportfolio.com · linkedin.com/in/yourname"
                      value={url} onChange={e => setUrl(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && submit()}
                      autoComplete="off" spellCheck={false}/>
                  </div>
                )}

                {mode === 'pdf' && (
                  <div className={`${styles.dropzone} ${isDragging?styles.dropzoneActive:''} ${file?styles.dropzoneHasFile:''}`}
                    onDrop={handleDrop}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onClick={() => !file && fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={e => { const f=e.target.files?.[0]; if (f?.type==='application/pdf') setFile(f) }} style={{ display:'none' }}/>
                    {file ? (
                      <div className={styles.filePreview}>
                        <div className={styles.fileIcon}><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <div className={styles.fileMeta}><span className={styles.fileName}>{file.name}</span><span className={styles.fileSize}>{(file.size/1024).toFixed(0)} KB · PDF ready</span></div>
                        <button className={styles.fileRemove} onClick={e => { e.stopPropagation(); setFile(null) }}><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                      </div>
                    ) : (
                      <div className={styles.dropzonePrompt}>
                        <div className={styles.dropzoneIconWrap}><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                        <span className={styles.dropzoneText}>Drop your CV here</span>
                        <span className={styles.dropzoneHint}>or click to browse · PDF · max 10 MB</span>
                      </div>
                    )}
                  </div>
                )}

                {appState === 'error' && (
                  <div className={styles.errorBanner}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error}
                  </div>
                )}

                <button className={styles.submitBtn} onClick={submit} disabled={mode==='url' ? !url.trim() : !file}>
                  Analyze my CV
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>

                <p className={styles.freeNote}>
                  {tier==='free' && analysisCount>=1
                    ? <><span>Free scan used —</span> <button className={styles.freeNoteLink} onClick={() => setShowUpgradeModal(true)}>upgrade for unlimited</button></>
                    : tier==='premium' ? <>✓ Unlimited analyses · Premium active</>
                    : <>1 free scan · No account needed</>}
                </p>
              </div>
            </div>

            {/* ── Social proof numbers ── */}
            <div className={styles.socialProofBar}>
              {[
                { n:'8',      label:'Things scored in detail'   },
                { n:'~30s',   label:'From link to results'      },
                { n:'€2',     label:'For full access, one-time' },
                { n:'0',      label:'Sugarcoating' },
              ].map(item => (
                <div key={item.label} className={styles.socialProofItem}>
                  <span className={styles.socialProofNumber}>{item.n}</span>
                  <span className={styles.socialProofLabel}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* ── How it works ── */}
            <section className={styles.howSection}>
              <div>
                <p className={styles.sectionLabel}>How it works</p>
                <h2 className={styles.sectionHeading}>Simple enough that you'll actually use it</h2>
              </div>
              <div className={styles.howSteps}>
                {HOW_STEPS.map(s => (
                  <div key={s.n} className={styles.howStep}>
                    <div className={styles.howStepNum}>{s.n}</div>
                    <p className={styles.howStepTitle}>{s.title}</p>
                    <p className={styles.howStepDesc}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Features ── */}
            <section className={styles.featuresSection}>
              <div>
                <p className={styles.sectionLabel}>What you get</p>
                <h2 className={styles.sectionHeading}>Feedback you can do something with</h2>
              </div>
              <div className={styles.featuresGrid}>
                {FEATURES.map(f => (
                  <div key={f.title} className={styles.featureCard}>
                    <div className={styles.featureIcon}><span style={{ fontSize:20 }}>{f.icon}</span></div>
                    <p className={styles.featureTitle}>{f.title}</p>
                    <p className={styles.featureDesc}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Pricing ── */}
            <section className={styles.pricingSection}>
              <div>
                <p className={styles.sectionLabel}>Pricing</p>
                <h2 className={styles.sectionHeading}>No tricks, no "contact us for pricing"</h2>
                <p style={{ fontSize:15, color:'var(--text-secondary)', lineHeight:1.6, marginTop:8, maxWidth:440 }}>
                  Try it free. If the score makes you want to see the rest, Pro is €2. That's it.
                </p>
              </div>
              <div className={styles.pricingCards}>
                {(['free','pro','premium'] as const).map(pk => {
                  const p = PLAN_DEFS[pk]
                  const isFeatured = pk === 'pro'
                  const isCurrent  = tier === pk
                  return (
                    <div key={pk} className={`${styles.pricingCard} ${isFeatured?styles.pricingCardFeatured:''}`}>
                      {isFeatured && <div className={styles.pricingBadge}>Most popular</div>}
                      <div>
                        <p className={styles.pricingCardName}>{p.label}</p>
                        <div style={{ display:'flex', alignItems:'baseline', gap:4, marginTop:6 }}>
                          <span className={styles.pricingCardPrice}>{p.price}</span>
                          {p.period && <span className={styles.pricingCardPeriod}>{p.period}</span>}
                        </div>
                      </div>
                      <ul className={styles.pricingFeatureList}>
                        {p.features.map(f => (
                          <li key={f} className={styles.pricingFeatureItem}>
                            <svg width="13" height="13" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div className={styles.pricingCtaGhost}>Current plan</div>
                      ) : pk==='free' ? (
                        <button className={styles.pricingCtaGhost} style={{ cursor:'pointer', transition:'all 0.15s' }} onClick={scrollToTop}>Start free ↑</button>
                      ) : pk==='pro' ? (
                        <button className={styles.pricingCtaAccent} onClick={() => setShowUpgradeModal(true)}>Get Pro — €2</button>
                      ) : (
                        <button className={styles.pricingCtaDark} onClick={() => setShowUpgradeModal(true)}>Get Premium</button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className={styles.pricingGuarantee}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure checkout via Stripe · No subscription on Pro
              </p>
            </section>
          </div>
        )}

        {/* ── LOADING ── */}
        {appState === 'loading' && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}/>
            <p className={styles.loadingText}>Analyzing your CV…</p>
            <div className={styles.loadingSteps}>
              {LOADING_STEPS.map((step,i) => (
                <div key={step} className={styles.loadingStep} style={{ opacity:i<=loadingStep?1:0.28, color:i===loadingStep?'var(--text-secondary)':'var(--text-tertiary)', animationDelay:`${i*0.08}s` }}>
                  <div className={styles.loadingDot} style={{ opacity:i===loadingStep?1:0.3, animation:i===loadingStep?'pulse 1.4s ease-in-out infinite':'none' }}/>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {appState === 'result' && result && (
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <button className={styles.backBtn} onClick={reset}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                New analysis
              </button>
              <button className={styles.shareBtn} onClick={copyShare}>
                {copied
                  ? <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                  : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share score</>}
              </button>
            </div>

            {/* Score hero */}
            <div className={styles.scoreHero}>
              <ScoreRing score={result.total_score}/>
              <div className={styles.scoreHeroMeta}>
                <span className={styles.ratingBadge} style={{ color:RATING_COLORS[result.rating], borderColor:`${RATING_COLORS[result.rating]}28`, background:`${RATING_COLORS[result.rating]}10` }}>
                  {RATING_LABELS[result.rating]}
                </span>
                <p className={styles.scoreSummary}>{result.summary}</p>
                {result.source && <p className={styles.sourceLabel}>{result.source}</p>}
              </div>
            </div>

            {/* Score breakdown */}
            <div className={styles.section}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>Score Breakdown</h2>
                {result.scores_locked && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgradeModal(true)}>
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Unlock — €2
                  </button>
                )}
              </div>
              <div className={styles.categoryBars}>
                {SCORE_DIMENSIONS.map(({ key, label, max, desc }) => (
                  <DimensionBar key={key} label={label}
                    score={(result.scores as unknown as Record<string,number>)[key] ?? 0}
                    max={max} desc={desc}
                    locked={result.scores_locked}
                    onUnlock={() => setShowUpgradeModal(true)}/>
                ))}
              </div>
            </div>

            {/* Observations */}
            <div className={styles.section}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>Observations</h2>
                {!isPro && result.observations.length > result.observations_locked_from && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgradeModal(true)}>
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    See all {result.observations.length}
                  </button>
                )}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {result.observations.map((obs,i) => (
                  <ObservationCard key={i} obs={obs} index={i}
                    locked={i >= result.observations_locked_from}
                    onUnlock={() => setShowUpgradeModal(true)}/>
                ))}
              </div>
            </div>

            {/* Improvements */}
            <div className={styles.section}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>How to improve</h2>
                {!isPro && result.improvements.length > result.improvements_locked_from && (
                  <button className={styles.unlockBtn} onClick={() => setShowUpgradeModal(true)}>
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Unlock {result.improvements.length - result.improvements_locked_from} more
                  </button>
                )}
              </div>
              <div className={styles.tips}>
                {result.improvements.map((tip,i) => (
                  <TipCard key={i} tip={tip} index={i}
                    locked={i >= result.improvements_locked_from}
                    onUnlock={() => setShowUpgradeModal(true)}/>
                ))}
              </div>
            </div>

            {/* Top priority */}
            <div className={styles.priorityCard}>
              <div className={styles.priorityCardHeader}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Do this first
              </div>
              <p className={styles.priorityText}>{result.top_priority}</p>
            </div>

            {/* Upgrade banner */}
            {!isPro && (
              <div className={styles.upgradeBanner}>
                <div className={styles.upgradeBannerContent}>
                  <p className={styles.upgradeBannerTitle}>There's more here you haven't seen</p>
                  <p className={styles.upgradeBannerSub}>
                    The free version shows the headline. Pro unlocks all {result.observations.length} observations, {result.improvements.length} improvement tips with rewrites, and the full breakdown across 8 dimensions. €2, one-time.
                  </p>
                </div>
                <div className={styles.upgradeBannerActions}>
                  <button className={styles.upgradeBannerPro} onClick={() => setShowUpgradeModal(true)}>Unlock — €2 one-time</button>
                  <button className={styles.upgradeBannerPremium} onClick={() => setShowUpgradeModal(true)}>Premium — €7.99/mo</button>
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
          <Link href="/terms" className={styles.footerLink}>Terms</Link>
          <button className={styles.footerLink} style={{ background:'none', border:'none', fontFamily:'var(--font-sans)', fontSize:12, cursor:'pointer', padding:0 }} onClick={() => setShowUpgradeModal(true)}>Pricing</button>
        </div>
      </footer>
    </div>
  )
}
