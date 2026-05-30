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

// ─── Particle Canvas — Ramp-style, cursor-reactive ───────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let W = 0, H = 0

    const mouse = { x: -9999, y: -9999, active: false }
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
    }
    const onMouseLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999 }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    const resize = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width  = W * window.devicePixelRatio
      canvas.height = H * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light'

    // 340 particles — much denser than before
    const COUNT = 340
    type P = {
      x: number; y: number
      vx: number; vy: number
      ox: number; oy: number
      r: number; opacity: number
      pulsePhase: number; pulseSpeed: number
    }
    const pts: P[] = Array.from({ length: COUNT }, () => {
      const vx = (Math.random() - 0.5) * 0.22
      const vy = (Math.random() - 0.5) * 0.22
      return {
        x: Math.random() * (W || window.innerWidth),
        y: Math.random() * (H || window.innerHeight),
        vx, vy, ox: vx, oy: vy,
        r: Math.random() * 1.4 + 0.3,
        opacity: Math.random() * 0.45 + 0.08,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.008 + Math.random() * 0.012,
      }
    })

    const CONNECT = 130
    const ATTRACT  = 160   // cursor attract radius
    const REPEL    = 80    // cursor repel inner radius
    const REPEL_F  = 0.018

    let frame = 0

    const draw = () => {
      frame++
      ctx.clearRect(0, 0, W, H)

      const dark = isDark()
      // base particle/line color
      const col      = dark ? 'rgba(200,198,240,' : 'rgba(60,55,140,'
      // accent color for hub lines
      const colAccent = dark ? 'rgba(160,154,232,' : 'rgba(83,74,183,'

      // ── update positions ──
      for (const p of pts) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist2 = dx * dx + dy * dy
        const dist  = Math.sqrt(dist2)

        if (dist < ATTRACT && dist > 0) {
          if (dist < REPEL) {
            // repel
            const force = (REPEL - dist) / REPEL
            p.vx += (dx / dist) * force * REPEL_F * 5
            p.vy += (dy / dist) * force * REPEL_F * 5
          } else {
            // gentle attract
            const force = ((ATTRACT - dist) / ATTRACT) * 0.0018
            p.vx -= (dx / dist) * force * dist
            p.vy -= (dy / dist) * force * dist
          }
        }

        // spring back to original velocity
        p.vx += (p.ox - p.vx) * 0.016
        p.vy += (p.oy - p.vy) * 0.016

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.6) { p.vx = (p.vx / speed) * 1.6; p.vy = (p.vy / speed) * 1.6 }

        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0

        p.pulsePhase += p.pulseSpeed
      }

      // ── connecting lines between all nearby particles ──
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const ddx = pts[i].x - pts[j].x
          const ddy = pts[i].y - pts[j].y
          const d = Math.sqrt(ddx * ddx + ddy * ddy)
          if (d < CONNECT) {
            const a = (1 - d / CONNECT) * 0.16
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `${col}${a})`
            ctx.lineWidth = 0.35
            ctx.stroke()
          }
        }
      }

      // ── cursor glow + hub lines ──
      if (mouse.active && mouse.x > -100) {
        // soft glow under cursor
        const glowR = 120
        const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, glowR)
        grd.addColorStop(0, dark ? 'rgba(127,119,221,0.10)' : 'rgba(83,74,183,0.08)')
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // hub lines to nearest 14 particles
        const sorted = [...pts]
          .map(p => ({ p, d: Math.hypot(p.x - mouse.x, p.y - mouse.y) }))
          .filter(e => e.d < 220)
          .sort((a, b) => a.d - b.d)
          .slice(0, 14)

        for (const { p, d } of sorted) {
          const a = (1 - d / 220) * 0.55
          ctx.beginPath()
          ctx.moveTo(mouse.x, mouse.y)
          ctx.lineTo(p.x, p.y)
          ctx.strokeStyle = `${colAccent}${a})`
          ctx.lineWidth = 0.6
          ctx.stroke()
        }

        // cursor dot with glow
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = dark ? 'rgba(160,154,232,0.7)' : 'rgba(83,74,183,0.6)'
        ctx.fill()

        // outer ring pulse
        const pulse = 0.4 + 0.3 * Math.sin(frame * 0.06)
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2)
        ctx.strokeStyle = dark ? `rgba(127,119,221,${pulse * 0.4})` : `rgba(83,74,183,${pulse * 0.35})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // ── draw dots ──
      for (const p of pts) {
        // slight opacity pulse per particle
        const op = p.opacity * (0.82 + 0.18 * Math.sin(p.pulsePhase))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `${col}${op})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.heroCanvas} style={{ pointerEvents: 'none' }}/>
}

// ─── ScoreRing ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 54, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 66 ? 'var(--score-high)' : score >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  return (
    <div className={styles.scoreRing}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="5"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5"
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
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
  const bg     = isStrength ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'
  const border = isStrength ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.14)'

  if (locked) return (
    <div onClick={onUnlock} style={{
      padding:'14px 18px', borderRadius:6,
      background:'var(--bg-elevated)',
      border:'0.5px solid var(--border)',
      display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer',
      transition:'background 0.1s',
    }}
    onMouseOver={e => (e.currentTarget.style.background='var(--bg-subtle)')}
    onMouseOut={e  => (e.currentTarget.style.background='var(--bg-elevated)')}>
      <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', padding:'2px 7px', borderRadius:2, background:'var(--bg-muted)', color:'var(--text-tertiary)', flexShrink:0 }}>
        {String(index+1).padStart(2,'0')}
      </span>
      <p style={{ fontSize:12.5, color:'var(--text-secondary)', filter:'blur(5px)', userSelect:'none', flex:1, margin:0, lineHeight:1.65 }}>{obs.detail}</p>
      <div style={{ color:'var(--text-tertiary)', flexShrink:0, display:'flex', alignItems:'center' }}>
        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      </div>
    </div>
  )

  return (
    <div style={{ padding:'16px 18px', borderRadius:6, background:bg, border:`0.5px solid ${border}`, display:'flex', flexDirection:'column', gap:8 }}>
      <div className={styles.obsCardHeader}>
        <span className={styles.obsTypeBadge} style={{ color, background:isStrength?'rgba(22,163,74,0.07)':'rgba(220,38,38,0.07)', border:`0.5px solid ${border}` }}>
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
          <span className={styles.tipImpact} style={{ color:IMPACT_COLORS[tip.impact], background:`${IMPACT_COLORS[tip.impact]}10`, borderColor:`${IMPACT_COLORS[tip.impact]}30` }}>{tip.impact}</span>
          <span className={styles.tipArea} style={{ filter:'blur(4px)', userSelect:'none' }}>{tip.area}</span>
        </div>
        <div className={styles.lockBadge}>
          <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Unlock
        </div>
      </div>
      <div className={styles.tipBody} style={{ paddingTop:0 }}>
        <p style={{ filter:'blur(5px)', userSelect:'none', fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.65, margin:0 }}>{tip.problem}</p>
      </div>
    </div>
  )

  return (
    <div className={styles.tipCard}>
      <button className={styles.tipHeader} onClick={() => setOpen(!open)}>
        <div className={styles.tipHeaderLeft}>
          <span className={styles.tipImpact} style={{ color:IMPACT_COLORS[tip.impact], background:`${IMPACT_COLORS[tip.impact]}10`, borderColor:`${IMPACT_COLORS[tip.impact]}30` }}>{tip.impact}</span>
          <span className={styles.tipArea}>{tip.area}</span>
        </div>
        <svg className={`${styles.tipChevron} ${open ? styles.tipChevronOpen : ''}`} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
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
  pro:     { label:'Pro',     color:'var(--text-primary)'  },
  premium: { label:'Premium', color:'var(--score-high)'    },
}
const ddItem: React.CSSProperties = {
  display:'flex', alignItems:'center', gap:9, width:'100%',
  padding:'9px 16px', background:'transparent', border:'none',
  color:'var(--text-secondary)', fontSize:12.5, cursor:'pointer',
  textAlign:'left' as const, fontFamily:'var(--font-sans)', transition:'background 0.1s, color 0.1s',
  letterSpacing:'-0.01em',
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
      <button onClick={() => setOpen(v => !v)} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px 4px 5px', background:open?'var(--bg-subtle)':'transparent', border:'0.5px solid var(--border)', borderRadius:40, cursor:'pointer', transition:'all 0.1s', fontFamily:'var(--font-sans)' }}>
        <span style={{ width:25, height:25, borderRadius:'50%', background:'var(--text-primary)', color:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{initials}</span>
        <span style={{ maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12.5, fontWeight:500, color:'var(--text-secondary)', letterSpacing:'-0.01em' }}>{user.email?.split('@')[0]}</span>
        <svg width="10" height="10" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.15s', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:216, background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:7, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.14)', zIndex:1000, animation:'dropIn 0.12s ease' }}>
          <div style={{ padding:'13px 16px', borderBottom:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>{user.email}</div>
            <div style={{ fontSize:10.5, color:meta.color, fontWeight:600, marginTop:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{meta.label} plan</div>
          </div>
          <div style={{ padding:'4px 0' }}>
            <button className="dd-row" onClick={() => { onOpenAccount(); setOpen(false) }} style={ddItem}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              My account
            </button>
            {(tier === 'premium') && (
              <button className="dd-row" onClick={() => { router.push('/history'); setOpen(false) }} style={ddItem}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                History
              </button>
            )}
            {(tier === 'free' || tier === 'pro') && (
              <button className="dd-row" onClick={() => { onOpenPlans(); setOpen(false) }} style={{ ...ddItem, color:'var(--text-tertiary)' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                History <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginLeft:4, color:'var(--accent)', opacity:0.8 }}>Premium</span>
              </button>
            )}
            <button className="dd-row" onClick={() => { onOpenPlans(); setOpen(false) }} style={ddItem}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Plans
            </button>
          </div>
          <div style={{ borderTop:'0.5px solid var(--border)', padding:'4px 0' }}>
            <button className="dd-danger" onClick={() => { onSignOut(); setOpen(false) }} style={{ ...ddItem, color:'#ef4444' }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PlansModal ───────────────────────────────────────────────────────────────
const PLAN_DEFS = {
  free:    { label:'Free',    color:'var(--text-tertiary)', price:'€0',    period:'',         features:['1 analysis total','Overall score /100','Rating & summary','2 observations','1 improvement tip (no rewrite)'] },
  pro:     { label:'Pro',     color:'var(--text-primary)',  price:'€2',    period:'one-time', features:['1 analysis (full breakdown)','Score across all 8 dimensions','4 observations with context','3 improvement tips with rewrites','One-time — no subscription'] },
  premium: { label:'Premium', color:'var(--score-high)',   price:'€7.99', period:'/month',   features:['Unlimited analyses','Everything in Pro — every time','History & progress tracking','Priority support'] },
}

function Chk() {
  return <svg width="12" height="12" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>
}

function PlansModal({ tier, userId, userEmail, onClose, onBuy }: {
  tier: string; userId?: string; userEmail?: string
  onClose: () => void; onBuy: () => void
}) {
  const [buying, setBuying] = useState<string|null>(null)

  const handleBuy = async (plan: 'pro'|'premium') => {
    if (!userId) { onBuy(); return }
    setBuying(plan)
    try {
      const res = await fetch('/api/stripe/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ plan, userId, email:userEmail }) })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch { setBuying(null) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={e => e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:10, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', padding:30, display:'flex', flexDirection:'column', gap:22, boxShadow:'0 24px 80px rgba(0,0,0,0.22)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:'var(--text-primary)', margin:'0 0 4px', letterSpacing:'-0.04em' }}>Choose a plan</h2>
            <p style={{ fontSize:12.5, color:'var(--text-secondary)', margin:0 }}>Start free, unlock more when you need it.</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)', padding:4, fontFamily:'var(--font-sans)' }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:0, border:'0.5px solid var(--border)', borderRadius:7, overflow:'hidden' }}>
          {(['free','pro','premium'] as const).map(pk => {
            const p = PLAN_DEFS[pk]
            const isFeatured = pk === 'pro'
            const isCurrent  = tier === pk
            return (
              <div key={pk} style={{ padding:'18px 22px', background:isFeatured?'var(--bg-subtle)':'transparent', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', gap:20, justifyContent:'space-between', outline:isFeatured?'1px solid var(--text-primary)':'none', outlineOffset:-1 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:7 }}>
                    <span style={{ fontSize:9.5, fontWeight:700, color:p.color, textTransform:'uppercase' as const, letterSpacing:'0.1em' }}>{p.label}</span>
                    <span style={{ fontSize:21, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-1.5px', fontFamily:'var(--font-serif)' }}>{p.price}</span>
                    {p.period && <span style={{ fontSize:11.5, color:'var(--text-tertiary)' }}>{p.period}</span>}
                  </div>
                  <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:4, margin:0, padding:0 }}>
                    {p.features.map(f => <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}><Chk/>{f}</li>)}
                  </ul>
                </div>
                    <div style={{ flexShrink:0 }}>
                      {isCurrent ? (
                        <span style={{ fontSize:11.5, color:'var(--text-tertiary)', padding:'7px 14px', border:'0.5px solid var(--border)', borderRadius:4, display:'block' }}>Current plan</span>
                      ) : pk==='free' ? (
                        <span style={{ fontSize:11.5, color:'var(--text-tertiary)', padding:'7px 14px', display:'block' }}>1 free scan</span>
                      ) : (
                        <button onClick={() => handleBuy(pk)} disabled={!!buying} style={{ padding:'8px 18px', fontSize:12.5, fontWeight:600, color:'var(--bg)', background:'var(--text-primary)', border:'none', borderRadius:4, cursor:'pointer', opacity:buying===pk?0.5:1, fontFamily:'var(--font-sans)', whiteSpace:'nowrap' as const, transition:'opacity 0.1s', letterSpacing:'-0.01em' }}>
                          {buying===pk ? 'Loading…' : pk==='pro' ? 'Get Pro — €2' : 'Get Premium — €7.99/mo'}
                        </button>
                      )}
                    </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize:11, color:'var(--text-tertiary)', textAlign:'center' as const, margin:0 }}>Secure checkout via Stripe · No subscription on Pro</p>
      </div>
    </div>
  )
}

// ─── Static landing data ──────────────────────────────────────────────────────
const HOW_STEPS = [
  { n:'01', title:'Paste a link or drop your PDF', desc:'Works with portfolio URLs, LinkedIn profiles, personal sites, or a PDF. Takes 5 seconds to submit.' },
  { n:'02', title:'We read it the way a recruiter would', desc:'CVCheck looks at 8 things recruiters actually care about — positioning, proof, structure, language, and more.' },
  { n:'03', title:'You get a score and real feedback', desc:'Free gives you the overall score and rating. Pro unlocks all 8 dimensions, observations, and improvement tips with rewritten examples — for €2, one-time.' },
]

const SAMPLE_DIMS = [
  { label:'First impression', pct:90 },
  { label:'Positioning',       pct:75 },
  { label:'Experience proof',  pct:60 },
  { label:'Skills relevance',  pct:80 },
  { label:'Credibility',       pct:55 },
  { label:'Structure',         pct:85 },
  { label:'Language',          pct:70 },
  { label:'Contact clarity',   pct:95 },
]

const SAMPLE_OBS = [
  { type:'strength', text:'Strong action verbs throughout — "Led", "Increased", "Delivered" signal ownership immediately.' },
  { type:'strength', text:'LinkedIn and portfolio clearly linked in the header.' },
  { type:'weakness', text:'Experience section lists responsibilities, not outcomes — no numbers anywhere in 5 years of work.' },
  { type:'weakness', text:'"Team player with great communication" appears twice. Filler phrases hurt credibility.' },
]

const DIMS_LIST = [
  { name:'First impression',    desc:'What a recruiter sees in the first 6 seconds of scanning' },
  { name:'Positioning',         desc:'Does it immediately communicate who you are and why you matter?' },
  { name:'Experience proof',    desc:'Results and impact, not just a list of responsibilities' },
  { name:'Skills relevance',    desc:'Are the right skills prominent for the roles you\'re targeting?' },
  { name:'Credibility signals', desc:'Education, recognitions, publications, social proof' },
  { name:'Structure',           desc:'Scannable layout, visual hierarchy, section ordering' },
  { name:'Language',            desc:'Clarity, action verbs, appropriate tone, no filler phrases' },
  { name:'Contact clarity',     desc:'Can a recruiter reach you without hunting for contact info?' },
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

  const [mode, setMode]             = useState<InputMode>('url')
  const [url,  setUrl]              = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [appState,   setAppState]   = useState<AppState>('idle')
  const [result,     setResult]     = useState<GatedAnalysisResult | null>(null)
  const [error,      setError]      = useState('')
  const [copied,     setCopied]     = useState(false)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [loadingStep,   setLoadingStep]   = useState(0)
  const [pendingSave,   setPendingSave]   = useState<GatedAnalysisResult | null>(null)
  const [savedToHistory, setSavedToHistory] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (appState !== 'loading') { setLoadingStep(0); return }
    const timers = LOADING_STEPS.map((_,i) => setTimeout(() => setLoadingStep(i), i * 4000))
    return () => timers.forEach(clearTimeout)
  }, [appState])

  useEffect(() => {
    if (!user || !session || !pendingSave || savedToHistory) return
    const supabase = createSupabaseBrowser()
    supabase.from('roasts').insert({
      id: pendingSave.analysis_id,
      user_id: user.id,
      source: pendingSave.source ?? null,
      total_score: pendingSave.total_score,
      rating: pendingSave.rating,
      summary: pendingSave.summary,
      scores: pendingSave.scores,
      observations: pendingSave.observations,
      improvements: pendingSave.improvements,
      top_priority: pendingSave.top_priority,
      tier: pendingSave.tier,
    }).then(({ error }) => {
      if (!error) { setSavedToHistory(true); setPendingSave(null) }
      else console.error('[history] Failed to save pending analysis:', error)
    })
  }, [user, session, pendingSave, savedToHistory])

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
        if (res.status === 429) {
          const mins = data.retryAfter ? Math.ceil(data.retryAfter / 60) : 60
          setError(`Too many analyses. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`)
          setAppState('error'); return
        }
        throw new Error(data.error || 'Analysis failed')
      }
      setResult(data); setAppState('result'); setAnalysisCount(c => c+1)
      if (!user) setPendingSave(data)
      else setSavedToHistory(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setAppState('error')
    }
  }

  const reset     = () => { setAppState('idle'); setResult(null); setError(''); setUrl(''); setFile(null); setPendingSave(null); setSavedToHistory(false) }
  const copyShare = async () => {
    if (!result) return
    const shareUrl = `https://cvcheck.app/?ref=share`
    const shareText = `My CV scored ${result.total_score}/100 (${RATING_LABELS[result.rating]}) on CVCheck — check yours: ${shareUrl}`
    await navigator.clipboard.writeText(shareText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const isPro = result?.tier === 'pro' || result?.tier === 'premium'
  const scrollToTop = () => window.scrollTo({ top:0, behavior:'smooth' })

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>

          {/* Logo */}
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <svg width="12" height="12" fill="none" stroke="var(--bg)" strokeWidth="2.4" viewBox="0 0 24 24">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <span className={styles.logoText}>CVCheck</span>
          </div>

          {/* Nav */}
          <nav className={styles.navCenter}>
            <button className={styles.navLink} onClick={() => document.getElementById('how')?.scrollIntoView({behavior:'smooth'})}>How it works</button>
            <button className={styles.navLink} onClick={() => document.getElementById('dims')?.scrollIntoView({behavior:'smooth'})}>What we score</button>
            <button className={styles.navLink} onClick={() => document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})}>Pricing</button>
          </nav>

          {/* Auth */}
          <div className={styles.headerRight}>
            {!authLoading && (user ? (
              <AccountDropdown user={user} tier={tier}
                onOpenAccount={() => setShowAccountModal(true)}
                onOpenPlans={() => setShowPlansModal(true)}
                onSignOut={() => signOut()}/>
            ) : (
              <div className={styles.headerAuthBtns}>
                <button className={styles.signInBtn} onClick={() => setShowAuthModal(true)}>Sign in</button>
                <button className={styles.upgradeHeaderBtn} onClick={() => setShowUpgradeModal(true)}>Try free</button>
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

        {/* ══════════════════════ IDLE / ERROR ══════════════════════ */}
        {(appState === 'idle' || appState === 'error') && (
          <div className={styles.hero}>

            {/* Particle canvas */}
            <ParticleCanvas/>
            <div className={styles.heroGradient}/>
            <div className={styles.heroGradientBottom}/>

            {/* ── Hero centre ── */}
            <div className={styles.heroInner}>

              <div className={styles.heroBadge}>
                <span className={styles.heroBadgeDot}/>
                AI feedback · CVs &amp; portfolios
              </div>

              <h1 className={styles.heroTitle}>
                Find out why your CV{' '}
                <em className={styles.heroTitleItalic}>isn't getting replies.</em>
              </h1>

              <p className={styles.heroSubtitle}>
                Paste a link or upload your CV. Get a score, rating, and real feedback — free for your first scan.
              </p>

              {/* Upload box */}
              <div className={styles.uploadBox}>
                <div className={styles.uploadBoxInner}>

                  {/* Tabs */}
                  <div className={styles.modeTabs}>
                    {(['url','pdf'] as const).map(m => (
                      <button key={m} className={`${styles.modeTab} ${mode===m?styles.modeTabActive:''}`} onClick={() => setMode(m)}>
                        {m==='url'
                          ? <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Link / URL</>
                          : <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF upload</>
                        }
                      </button>
                    ))}
                  </div>

                  {/* URL input */}
                  {mode === 'url' && (
                    <div className={styles.urlRow}>
                      <input type="url" className={styles.urlField}
                        placeholder="yourportfolio.com · linkedin.com/in/yourname"
                        value={url} onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => e.key==='Enter' && submit()}
                        autoComplete="off" spellCheck={false}/>
                      <button className={styles.submitBtn} onClick={submit} disabled={!url.trim()}>
                        Analyze
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </button>
                    </div>
                  )}

                  {/* PDF dropzone */}
                  {mode === 'pdf' && (
                    <>
                      <div className={`${styles.dropzone} ${isDragging?styles.dropzoneActive:''} ${file?styles.dropzoneHasFile:''}`}
                        onDrop={handleDrop}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onClick={() => !file && fileInputRef.current?.click()}>
                        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf"
                          onChange={e => { const f=e.target.files?.[0]; if (f?.type==='application/pdf') setFile(f) }}
                          style={{ display:'none' }}/>
                        {file ? (
                          <div className={styles.filePreview}>
                            <div className={styles.fileIcon}>
                              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div className={styles.fileMeta}>
                              <span className={styles.fileName}>{file.name}</span>
                              <span className={styles.fileSize}>{(file.size/1024).toFixed(0)} KB · PDF ready</span>
                            </div>
                            <button className={styles.fileRemove} onClick={e => { e.stopPropagation(); setFile(null) }}>
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ) : (
                          <div className={styles.dropzonePrompt}>
                            <div className={styles.dropzoneIconWrap}>
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            </div>
                            <span className={styles.dropzoneText}>Drop your CV here</span>
                            <span className={styles.dropzoneHint}>or click to browse · PDF · max 10 MB</span>
                          </div>
                        )}
                      </div>
                      <button className={styles.submitBtn} onClick={submit} disabled={!file} style={{ width:'100%' }}>
                        Analyze my CV
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </button>
                    </>
                  )}

                  {/* Error */}
                  {appState === 'error' && error && (
                    <div className={styles.errorBox}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {error}
                    </div>
                  )}

                </div>
                <div className={styles.freeNote}>
                  {tier === 'free' && analysisCount >= 1
                    ? <>Used your free scan · <button style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline' }} onClick={() => setShowUpgradeModal(true)}>Unlock Pro for €2</button> to analyze again</>
                    : '1 free analysis · No account required'
                  }
                </div>
              </div>
            </div>

            {/* ── Stats strip ── */}
            <div className={styles.statsStrip}>
              {[
                { num:'8',    label:'dimensions scored per CV' },
                { num:'~30s', label:'average analysis time' },
                { num:'€2',   label:'one-time Pro — not a subscription' },
                { num:'0',    label:'vague "consider improving" feedback' },
              ].map(s => (
                <div key={s.num} className={styles.statItem}>
                  <span className={styles.statNum}>{s.num}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* ── How it works ── */}
            <section id="how" className={styles.howSection}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead}>
                  <p className={styles.sEyebrow}>How it works</p>
                  <h2 className={styles.sTitle}>Three steps, thirty seconds.</h2>
                  <p className={styles.sSub}>No account needed for your first scan.</p>
                </div>
                <div className={styles.howSteps}>
                  {HOW_STEPS.map(s => (
                    <div key={s.n} className={styles.howStep}>
                      <span className={styles.howStepNum}>{s.n}</span>
                      <p className={styles.howStepTitle}>{s.title}</p>
                      <p className={styles.howStepDesc}>{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Sample result ── */}
            <section className={styles.sampleSection}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead}>
                  <p className={styles.sEyebrow}>What you get</p>
                  <h2 className={styles.sTitle}>A real score, not a pep talk.</h2>
                  <p className={styles.sSub}>Free gives you the score and a preview. Pro unlocks the full picture — all 8 dimensions, observations, and fixes with rewritten examples.</p>
                </div>
                <div className={styles.sampleCard}>
                  <div className={styles.sampleTop}>
                    <div className={styles.sampleRing}>
                      <svg width="92" height="92" viewBox="0 0 92 92">
                        <circle cx="46" cy="46" r="38" fill="none" stroke="var(--bg-muted)" strokeWidth="4.5"/>
                        <circle cx="46" cy="46" r="38" fill="none" stroke="var(--score-high)" strokeWidth="4.5"
                          strokeLinecap="round" strokeDasharray="172 239" transform="rotate(-90 46 46)"/>
                      </svg>
                      <div className={styles.sampleScore}>
                        <span className={styles.sampleScoreNum}>72</span>
                        <span className={styles.sampleScoreMax}>/100</span>
                      </div>
                    </div>
                    <div className={styles.sampleMeta}>
                      <span className={styles.sampleBadge}>Good</span>
                      <p className={styles.sampleSummary}>Solid structure and clear contact info. The experience section reads like a job description rather than a track record — adding numbers would move this from Good to Strong quickly.</p>
                    </div>
                  </div>
                  <div className={styles.sampleBars}>
                    {SAMPLE_DIMS.map(d => (
                      <div key={d.label} className={styles.sampleBar}>
                        <div className={styles.sampleBarHeader}>
                          <span className={styles.sampleBarLabel}>{d.label}</span>
                          <span className={styles.sampleBarScore}>{d.pct}%</span>
                        </div>
                        <div className={styles.sampleBarTrack}>
                          <div className={styles.sampleBarFill} style={{ width:`${d.pct}%` }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.sampleObs}>
                    {SAMPLE_OBS.map((o,i) => (
                      <div key={i} className={styles.sampleObsCard} style={{
                        borderTop: i >= 2 ? '0.5px solid var(--border)' : 'none',
                        borderRight: i % 2 === 0 ? '0.5px solid var(--border)' : 'none',
                      }}>
                        <span className={styles.sampleObsType} style={{ color: o.type==='strength' ? 'var(--score-high)' : 'var(--score-low)' }}>
                          {o.type==='strength' ? '✓ Strength' : '✗ Weakness'}
                        </span>
                        <p className={styles.sampleObsText}>{o.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── 8 Dimensions ── */}
            <section id="dims" className={styles.dimsSection}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead}>
                  <p className={styles.sEyebrow}>What we score</p>
                  <h2 className={styles.sTitle}>8 dimensions, not just a vibe check.</h2>
                  <p className={styles.sSub}>Each weighted by how much recruiters actually care — not what's easiest to measure.</p>
                </div>
                <div className={styles.dimsGrid}>
                  {DIMS_LIST.map((d, i) => (
                    <div key={d.name} className={styles.dimCard}>
                      <div className={styles.dimIcon}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:9.5, fontWeight:600, color:'var(--text-tertiary)', letterSpacing:'0.06em' }}>
                          {String(i+1).padStart(2,'0')}
                        </span>
                      </div>
                      <p className={styles.dimName}>{d.name}</p>
                      <p className={styles.dimDesc}>{d.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Pricing ── */}
            <section id="pricing" className={styles.pricingSection}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead}>
                  <p className={styles.sEyebrow}>Pricing</p>
                  <h2 className={styles.sTitle}>No tricks, no "contact us for pricing."</h2>
                  <p className={styles.sSub}>One free scan to see your score. Pro unlocks the full breakdown for €2 — once. Premium for unlimited.</p>
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
                          <div style={{ display:'flex', alignItems:'baseline', gap:6, marginTop:10 }}>
                            <span className={styles.pricingCardPrice}>{p.price}</span>
                            {p.period && <span className={styles.pricingCardPeriod}>{p.period}</span>}
                          </div>
                        </div>
                        <ul className={styles.pricingFeatureList}>
                          {p.features.map(f => (
                            <li key={f} className={styles.pricingFeatureItem}>
                              <svg width="11" height="11" fill="none" stroke="var(--text-primary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:2, opacity:0.35 }}><polyline points="20 6 9 17 4 12"/></svg>
                              {f}
                            </li>
                          ))}
                        </ul>
                        {isCurrent ? (
                          <div className={styles.pricingCtaGhost} style={{ textAlign:'center' as const }}>Current plan</div>
                        ) : pk==='free' ? (
                          <button className={styles.pricingCtaGhost} onClick={scrollToTop}>Try free — 1 scan ↑</button>
                        ) : pk==='pro' ? (
                          <button className={styles.pricingCtaAccent} onClick={() => setShowUpgradeModal(true)}>Get Pro — €2</button>
                        ) : (
                          <button className={styles.pricingCtaDark} onClick={() => setShowUpgradeModal(true)}>Get Premium — €7.99/mo</button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className={styles.pricingGuarantee}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Secure checkout via Stripe · No subscription on Pro · 1 scan always free
                </p>
              </div>
            </section>

          </div>
        )}

        {/* ══════════════════════ LOADING ══════════════════════ */}
        {appState === 'loading' && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}/>
            <p className={styles.loadingText}>Analyzing your CV…</p>
            <div className={styles.loadingSteps}>
              {LOADING_STEPS.map((step,i) => (
                <div key={step} className={styles.loadingStep}
                  style={{ opacity:i<=loadingStep?1:0.22, color:i===loadingStep?'var(--text-secondary)':'var(--text-tertiary)' }}>
                  <div className={styles.loadingDot}
                    style={{ opacity:i===loadingStep?1:0.22, animation:i===loadingStep?'pulse 1.4s ease-in-out infinite':'none' }}/>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════ RESULTS ══════════════════════ */}
        {appState === 'result' && result && (
          <div className={styles.results}>

            {/* Header row */}
            <div className={styles.resultsHeader}>
              <button className={styles.backBtn} onClick={reset}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                New analysis
              </button>
              {!user && (
                <button onClick={() => setShowAuthModal(true)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'0.5px solid var(--border)', borderRadius:4, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)', transition:'all 0.1s', letterSpacing:'-0.01em' }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                  Sign in to save
                </button>
              )}
              {user && savedToHistory && (
                <span style={{ fontSize:11.5, color:'var(--score-high)', display:'flex', alignItems:'center', gap:5 }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Saved to history
                </span>
              )}
              <button className={styles.shareBtn} onClick={copyShare}>
                {copied
                  ? <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                  : <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share score</>}
              </button>
            </div>

            {/* Score hero */}
            <div className={styles.scoreHero}>
              <ScoreRing score={result.total_score}/>
              <div className={styles.scoreHeroMeta}>
                <span className={styles.ratingBadge} style={{ color:RATING_COLORS[result.rating], borderColor:`${RATING_COLORS[result.rating]}30`, background:`${RATING_COLORS[result.rating]}08` }}>
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
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Unlock all 8 — €2
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
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    See all {result.observations.length}
                  </button>
                )}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
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
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
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
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
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
                    Free shows the headline score. Pro unlocks all {result.observations.length} observations, {result.improvements.length} improvement tips with rewritten examples, and the full 8-dimension breakdown — €2, one-time, no subscription.
                  </p>
                </div>
                <div className={styles.upgradeBannerActions}>
                  <button className={styles.upgradeBannerPro} onClick={() => setShowUpgradeModal(true)}>Unlock Pro — €2</button>
                  <button className={styles.upgradeBannerPremium} onClick={() => setShowPlansModal(true)}>See all plans</button>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <div className={styles.logoMark} style={{ width:22, height:22, borderRadius:4 }}>
            <svg width="10" height="10" fill="none" stroke="var(--bg)" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <span>CVCheck © 2026</span>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/privacy" className={styles.footerLink}>Privacy</Link>
          <Link href="/terms" className={styles.footerLink}>Terms</Link>
          <button className={styles.footerLink} style={{ background:'none', border:'none', fontFamily:'var(--font-sans)', fontSize:12, cursor:'pointer', padding:0 }} onClick={() => setShowUpgradeModal(true)}>Pricing</button>
        </div>
      </footer>

    </div>
  )
}
