'use client'

import { useState, useRef, useCallback, useEffect, DragEvent } from 'react'
import type React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthModal } from '@/components/AuthModal'
import { UpgradeModal } from '@/components/UpgradeModal'
import { AccountModal } from '@/components/AccountModal'
import { useAuth } from '@/hooks/useAuth'
import { useTier } from '@/hooks/useTier'
import type {
  GatedAnalysisResult, Rating,
  RedFlagSeverity, BulletRewrite, PriorityAction, RedFlag,
  JobsResponse, JobMatch as JobMatchType,
} from '@/lib/types'
import {
  SCORE_DIMENSIONS, RATING_LABELS, RATING_COLORS,
  RED_FLAG_COLORS, RED_FLAG_LABELS,
  ATS_VERDICT_LABELS, ATS_VERDICT_COLORS, LEVEL_LABELS,
} from '@/lib/constants'
import { createSupabaseBrowser } from '@/lib/supabase'
import styles from './page.module.css'

type InputMode = 'url' | 'pdf'
type AppState  = 'idle' | 'loading' | 'result' | 'error'

// ─── useScrollReveal — wires up IntersectionObserver on a container ───────────
function useScrollReveal(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const children = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!children.length) return
    // set initial hidden state
    children.forEach(c => c.classList.add(styles.revealHidden))
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.revealDelay ?? '0'
          el.style.transitionDelay = `${delay}ms`
          el.classList.remove(styles.revealHidden)
          el.classList.add(styles.revealVisible)
          obs.unobserve(el)
        }
      })
    }, { threshold: 0.12, ...options })
    children.forEach(c => obs.observe(c))
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── useAnimatedBars — triggers bar fill animation when section enters view ───
function useAnimatedBars() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const fills = Array.from(container.querySelectorAll<HTMLElement>('[data-bar-pct]'))
    fills.forEach(el => { el.style.width = '0' })
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          fills.forEach((el, i) => {
            const pct = el.dataset.barPct ?? '0'
            setTimeout(() => { el.style.width = `${pct}%` }, i * 60)
          })
          obs.disconnect()
        }
      })
    }, { threshold: 0.2 })
    if (container) obs.observe(container)
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── useCountUp — animates a number from 0 to target ─────────────────────────
function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now() + delay
    const step = (now: number) => {
      if (now < start) { raf = requestAnimationFrame(step); return }
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, delay])
  return value
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
    const ATTRACT  = 160
    const REPEL    = 80
    const REPEL_F  = 0.018

    let frame = 0

    const draw = () => {
      frame++
      ctx.clearRect(0, 0, W, H)

      const dark = isDark()
      const col      = dark ? 'rgba(200,198,240,' : 'rgba(60,55,140,'
      const colAccent = dark ? 'rgba(160,154,232,' : 'rgba(83,74,183,'

      for (const p of pts) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist2 = dx * dx + dy * dy
        const dist  = Math.sqrt(dist2)

        if (dist < ATTRACT && dist > 0) {
          if (dist < REPEL) {
            const force = (REPEL - dist) / REPEL
            p.vx += (dx / dist) * force * REPEL_F * 5
            p.vy += (dy / dist) * force * REPEL_F * 5
          } else {
            const force = ((ATTRACT - dist) / ATTRACT) * 0.0018
            p.vx -= (dx / dist) * force * dist
            p.vy -= (dy / dist) * force * dist
          }
        }

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

      if (mouse.active && mouse.x > -100) {
        const glowR = 120
        const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, glowR)
        grd.addColorStop(0, dark ? 'rgba(127,119,221,0.10)' : 'rgba(83,74,183,0.08)')
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

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

        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = dark ? 'rgba(160,154,232,0.7)' : 'rgba(83,74,183,0.6)'
        ctx.fill()

        const pulse = 0.4 + 0.3 * Math.sin(frame * 0.06)
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2)
        ctx.strokeStyle = dark ? `rgba(127,119,221,${pulse * 0.4})` : `rgba(83,74,183,${pulse * 0.35})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      for (const p of pts) {
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
  const color = score >= 66 ? 'var(--score-high)' : score >= 40 ? 'var(--score-mid)' : 'var(--score-low)'

  // Animate ring fill from 0 → target
  const [animPct, setAnimPct] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setTimeout(() => setAnimPct(score), 80)
    })
    return () => cancelAnimationFrame(raf)
  }, [score])
  const dash = (animPct / 100) * circ

  // Animated counter
  const displayScore = useCountUp(score, 1100, 120)

  return (
    <div className={styles.scoreRing}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        {/* Track */}
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="5"/>
        {/* Background glow ring */}
        <circle cx="68" cy="68" r={r} fill="none"
          stroke={color} strokeWidth="5" opacity="0.08"
          strokeDasharray={`${circ} 0`} transform="rotate(-90 68 68)"/>
        {/* Animated fill */}
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 68 68)"
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}/>
      </svg>
      <div className={styles.scoreRingInner}>
        <span className={styles.scoreNumber} style={{ color }}>{displayScore}</span>
        <span className={styles.scoreMax}>/100</span>
      </div>
    </div>
  )
}

// ─── Lock overlay used in multiple components ─────────────────────────────────
function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

function UnlockBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600,
      color:'var(--text-tertiary)', background:'none', border:'0.5px solid var(--border)',
      borderRadius:4, padding:'4px 10px', cursor:'pointer', fontFamily:'var(--font-sans)',
      letterSpacing:'-0.01em', transition:'color 0.1s, border-color 0.1s',
    }}
    onMouseOver={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--border-strong)' }}
    onMouseOut={e  => { e.currentTarget.style.color='var(--text-tertiary)'; e.currentTarget.style.borderColor='var(--border)' }}>
      <LockIcon size={9}/> {label}
    </button>
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
        <span className={styles.lockIcon}><LockIcon/></span>
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
        {/* data-bar-pct triggers JS animation via useAnimatedBars */}
        <div className={styles.barFill}
          data-bar-pct={pct}
          style={{ background: color }}/>
      </div>
    </div>
  )
}

// ─── RedFlagCard ──────────────────────────────────────────────────────────────
function RedFlagCard({ flag, index, howToFixLocked, onUnlock }: {
  flag: { flag: string; severity: RedFlagSeverity; how_to_fix: string }
  index: number; howToFixLocked: boolean; onUnlock: () => void
}) {
  const color = RED_FLAG_COLORS[flag.severity]
  const label = RED_FLAG_LABELS[flag.severity]

  return (
    <div style={{
      padding:'14px 18px', borderRadius:6,
      background:`${color}05`,
      border:`0.5px solid ${color}25`,
      display:'flex', flexDirection:'column', gap:8,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <span style={{
          fontSize:9, fontWeight:700, textTransform:'uppercase' as const,
          letterSpacing:'0.09em', padding:'2px 7px', borderRadius:2,
          color, background:`${color}12`, border:`0.5px solid ${color}30`,
          flexShrink:0,
        }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
          {flag.flag}
        </span>
      </div>
      {howToFixLocked ? (
        <div onClick={onUnlock} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
          <span style={{ fontSize:12, color:'var(--text-secondary)', filter:'blur(4px)', userSelect:'none', flex:1, pointerEvents:'none' }}>
            Replace your email with a professional address and update all application materials to reflect the change consistently.
          </span>
          <span style={{ color:'var(--text-tertiary)', flexShrink:0 }}><LockIcon size={10}/></span>
        </div>
      ) : (
        <p style={{ fontSize:12.5, color:'var(--text-secondary)', margin:0, lineHeight:1.65 }}>
          <span style={{ fontWeight:600, color:'var(--text-primary)' }}>Fix: </span>
          {flag.how_to_fix}
        </p>
      )}
    </div>
  )
}

// ─── BulletRewriteCard ────────────────────────────────────────────────────────
function BulletRewriteCard({ rewrite }: { rewrite: BulletRewrite }) {
  return (
    <div style={{
      borderRadius:6, border:'0.5px solid var(--border)',
      overflow:'hidden', fontSize:12.5, lineHeight:1.65,
    }}>
      <div style={{ padding:'12px 16px', background:'rgba(220,38,38,0.04)', borderBottom:'0.5px solid var(--border)' }}>
        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--score-low)', marginBottom:6 }}>Before</div>
        <p style={{ margin:0, color:'var(--text-secondary)' }}>{rewrite.original}</p>
      </div>
      <div style={{ padding:'12px 16px', background:'rgba(22,163,74,0.04)', borderBottom:'0.5px solid var(--border)' }}>
        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--score-high)', marginBottom:6 }}>After</div>
        <p style={{ margin:0, color:'var(--text-primary)', fontWeight:500 }}>{rewrite.rewritten}</p>
      </div>
      <div style={{ padding:'10px 16px', background:'var(--bg-subtle)' }}>
        <p style={{ margin:0, fontSize:11.5, color:'var(--text-tertiary)' }}>
          <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Why: </span>
          {rewrite.why}
        </p>
      </div>
    </div>
  )
}

// ─── ActionCard ───────────────────────────────────────────────────────────────
function ActionCard({ action, index, detailsLocked, onUnlock }: {
  action: PriorityAction; index: number; detailsLocked: boolean; onUnlock: () => void
}) {
  return (
    <div style={{
      padding:'18px 20px', borderRadius:6,
      border:'0.5px solid var(--border)',
      background:'var(--bg-elevated)',
      display:'flex', flexDirection:'column', gap:10,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{
          fontSize:11, fontWeight:800, color:'var(--text-primary)',
          background:'var(--bg-subtle)', border:'0.5px solid var(--border)',
          borderRadius:4, padding:'2px 8px', flexShrink:0, letterSpacing:'-0.01em',
        }}>{String(index + 1).padStart(2, '0')}</span>
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontSize:13.5, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
            {action.action}
          </p>
          <p style={{ margin:'5px 0 0', fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
            {action.why_it_matters}
          </p>
        </div>
      </div>
      {detailsLocked ? (
        <div onClick={onUnlock} style={{
          padding:'10px 14px', borderRadius:5, border:'0.5px dashed var(--border)',
          background:'var(--bg-subtle)', cursor:'pointer', display:'flex',
          alignItems:'center', gap:8, transition:'background 0.1s',
        }}
        onMouseOver={e => (e.currentTarget.style.background='var(--bg-muted)')}
        onMouseOut={e  => (e.currentTarget.style.background='var(--bg-subtle)')}>
          <LockIcon size={10}/>
          <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>Unlock how-to + example — Pro</span>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ padding:'10px 14px', borderRadius:5, background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)' }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--accent)', marginBottom:5 }}>How</div>
            <p style={{ margin:0, fontSize:12.5, color:'var(--text-primary)', lineHeight:1.65 }}>{action.how}</p>
          </div>
          {action.example && (
            <div style={{ padding:'10px 14px', borderRadius:5, background:'var(--bg-subtle)', border:'0.5px solid var(--border)', fontFamily:'monospace', fontSize:12, color:'var(--text-secondary)', lineHeight:1.65 }}>
              {action.example}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AccountDropdown ──────────────────────────────────────────────────────────
const TIER_META: Record<string, { label:string; color:string }> = {
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
  user: { email?: string }; tier: string
  onOpenAccount: () => void; onOpenPlans: () => void; onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref    = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const meta    = TIER_META[tier] ?? TIER_META.free
  const initials = (user.email ?? 'U').slice(0, 2).toUpperCase()

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px 4px 5px', background:open?'var(--bg-subtle)':'transparent', border:'0.5px solid var(--border)', borderRadius:40, cursor:'pointer', transition:'all 0.1s', fontFamily:'var(--font-sans)' }}>
        <span style={{ width:25, height:25, borderRadius:'50%', background:'var(--text-primary)', color:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{initials}</span>
        <span style={{ maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12.5, fontWeight:500, color:'var(--text-secondary)', letterSpacing:'-0.01em' }}>{user.email?.split('@')[0]}</span>
        <svg width="10" height="10" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.15s', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:220, background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:7, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.14)', zIndex:1000, animation:'dropIn 0.12s ease' }}>
          <div style={{ padding:'13px 16px', borderBottom:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>{user.email}</div>
            <div style={{ fontSize:10.5, color:meta.color, fontWeight:600, marginTop:3, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>{meta.label} plan</div>
          </div>
          <div style={{ padding:'4px 0' }}>
            <button className="dd-row" onClick={() => { onOpenAccount(); setOpen(false) }} style={ddItem}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              My account
            </button>
            {/* History — available to ALL logged-in users */}
            <button className="dd-row" onClick={() => { router.push('/history'); setOpen(false) }} style={ddItem}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
              History
            </button>
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
  free: {
    label:'Free', color:'var(--text-tertiary)', price:'€0', period:'',
    features:[
      'Overall score /100 + rating',
      'First impression (7-second test)',
      'Impact stats — bullets with/without metrics',
      'Red flag count + severity',
      'ATS verdict',
      'Career trajectory + format verdict',
      'History saved (requires account)',
    ],
  },
  pro: {
    label:'Pro', color:'var(--text-primary)', price:'€1.99', period:'one-time',
    features:[
      'Everything in Free',
      'Bullet rewrites on your actual text',
      'How to fix every red flag',
      'Missing ATS keywords for your domain',
      'Career gaps & seniority analysis',
      'Top 3 priority actions with how-to + examples',
    ],
  },
  premium: {
    label:'Premium', color:'var(--score-high)', price:'€5.99', period:'/month',
    features:[
      'Everything in Pro',
      'Unlimited analyses',
    ],
  },
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
    <>
      <style>{`
        @keyframes _pmIn { from { opacity:0; transform:translateY(14px) scale(0.985); } to { opacity:1; transform:none; } }
        @keyframes _pmBg { from { opacity:0; } to { opacity:1; } }
        ._pm-close:hover { background: var(--bg-muted) !important; color: var(--text-primary) !important; }
        ._pm-btn:hover:not(:disabled) { opacity: 0.82 !important; }
        ._pm-card { transition: border-color 0.15s; }
      `}</style>
      <div
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px 16px', animation:'_pmBg 0.18s ease' }}
        onClick={e => e.target===e.currentTarget && onClose()}
      >
        <div style={{ background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:14, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 32px 100px rgba(0,0,0,0.28)', animation:'_pmIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>

          {/* Header */}
          <div style={{ padding:'24px 26px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div>
              <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:'0 0 4px', letterSpacing:'-0.04em' }}>Plans</h2>
              <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>Start free. Upgrade when you need the full picture.</p>
            </div>
            <button className="_pm-close" onClick={onClose} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-subtle)', border:'0.5px solid var(--border)', borderRadius:6, color:'var(--text-tertiary)', cursor:'pointer', transition:'all 0.15s', flexShrink:0, fontFamily:'var(--font-sans)' }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Cards */}
          <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
            {(['free','pro','premium'] as const).map(pk => {
              const p = PLAN_DEFS[pk]
              const isFeatured = pk === 'pro'
              const isCurrent  = tier === pk
              return (
                <div key={pk} className="_pm-card" style={{
                  border: isFeatured ? '1.5px solid var(--border-strong)' : '0.5px solid var(--border)',
                  borderRadius: 10,
                  background: isFeatured ? 'var(--bg-subtle)' : 'var(--bg)',
                  overflow: 'hidden',
                }}>
                  {/* Card header */}
                  <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                      <span style={{ fontSize:11, fontWeight:700, color: p.color, textTransform:'uppercase' as const, letterSpacing:'0.07em', flexShrink:0 }}>{p.label}</span>
                      {isFeatured && <span style={{ fontSize:8, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, background:'var(--text-primary)', color:'var(--bg)', padding:'2px 7px', borderRadius:20, flexShrink:0 }}>Popular</span>}
                      {isCurrent  && <span style={{ fontSize:8, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:'var(--text-tertiary)', border:'0.5px solid var(--border)', padding:'2px 7px', borderRadius:20, flexShrink:0 }}>Current</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:3, flexShrink:0 }}>
                      <span style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text-primary)', lineHeight:1 }}>{p.price}</span>
                      {p.period && <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{p.period}</span>}
                    </div>
                  </div>

                  {/* Features */}
                  <div style={{ padding:'12px 18px 14px', borderTop:'0.5px solid var(--border)' }}>
                    <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:6 }}>
                      {p.features.map(f => (
                        <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.45 }}>
                          <Chk/>{f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {!isCurrent && pk !== 'free' && (
                      <button className="_pm-btn" onClick={() => handleBuy(pk)} disabled={!!buying} style={{ width:'100%', marginTop:12, padding:'10px', fontSize:13, fontWeight:600, color:'var(--bg)', background:'var(--text-primary)', border:'none', borderRadius:6, cursor:buying?'not-allowed':'pointer', opacity:buying===pk?0.5:1, fontFamily:'var(--font-sans)', letterSpacing:'-0.01em', transition:'opacity 0.15s' }}>
                        {buying===pk ? 'Loading…' : pk==='pro' ? 'Get Pro — €1.99' : 'Get Premium — €5.99/mo'}
                      </button>
                    )}
                    {pk === 'free' && !isCurrent && (
                      <p style={{ fontSize:11.5, color:'var(--text-tertiary)', margin:'10px 0 0', textAlign:'center' as const }}>1 free scan included</p>
                    )}
                    {isCurrent && (
                      <p style={{ fontSize:11.5, color:'var(--text-tertiary)', margin:'10px 0 0', textAlign:'center' as const }}>Your current plan</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding:'12px 20px 18px', borderTop:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', gap:18, flexWrap:'wrap' as const }}>
            {[
              { icon:<svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, text:'Stripe · secure' },
              { icon:<svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, text:'Instant access' },
              { icon:<svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>, text:'Cancel anytime (Premium)' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-tertiary)' }}>{icon}{text}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}


// ─── JobMatchesSection ────────────────────────────────────────────────────────

function FitBadge({ label, score }: { label: string; score: number }) {
  const colors: Record<string, string> = {
    strong:  'var(--score-high)',
    good:    'var(--score-high)',
    partial: 'var(--score-mid)',
    stretch: 'var(--score-low)',
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' as const, color: colors[label] ?? 'var(--text-secondary)' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: colors[label] ?? 'var(--text-secondary)', flexShrink:0 }} />
      {score}% {label}
    </span>
  )
}

function JobCard({ job, fitLocked, onUnlock }: { job: JobMatchType; fitLocked: boolean; onUnlock: () => void }) {
  const { listing, fit } = job
  const salary = listing.salary_min
    ? `€${Math.round(listing.salary_min / 1000)}k${listing.salary_max ? `–${Math.round(listing.salary_max / 1000)}k` : '+'}`
    : null

  return (
    <div style={{ border:'0.5px solid var(--border)', borderRadius:8, padding:'18px 20px', background:'var(--bg2)', display:'flex', flexDirection:'column' as const, gap:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', lineHeight:1.3 }}>{listing.title}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
            {listing.company}{listing.location ? ` · ${listing.location}` : ''}{salary ? ` · ${salary}` : ''}
          </div>
        </div>
        {fitLocked ? (
          <button onClick={onUnlock} style={{ flexShrink:0, fontSize:11, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', borderRadius:4, padding:'3px 9px', cursor:'pointer', whiteSpace:'nowrap' as const, fontFamily:'var(--font-sans)' }}>
            See fit score ↑
          </button>
        ) : fit ? (
          <FitBadge label={fit.fit_label} score={fit.fit_score} />
        ) : null}
      </div>

      <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.55, margin:0, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical' as const, overflow:'hidden' }}>
        {listing.description}
      </p>

      {!fitLocked && fit && fit.gaps.length > 0 && (
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column' as const, gap:5 }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--text-tertiary)' }}>What you&apos;re missing</div>
          {fit.gaps.map((gap, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}>
              <span style={{ color:'var(--score-low)', flexShrink:0, marginTop:1 }}>✕</span>
              {gap}
            </div>
          ))}
        </div>
      )}

      <a href={listing.redirect_url} target="_blank" rel="noopener noreferrer" style={{ alignSelf:'flex-start', fontSize:12, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-muted)', border:'0.5px solid var(--border-strong)', borderRadius:4, padding:'5px 12px', textDecoration:'none', marginTop:2 }}>
        View job →
      </a>
    </div>
  )
}

function JobMatchesSection({ result, token, onUnlock }: {
  result: GatedAnalysisResult
  token: string | null
  onUnlock: () => void
}) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [data, setData]   = React.useState<JobsResponse | null>(null)
  const [errMsg, setErrMsg] = React.useState('')

  async function fetchJobs() {
    setState('loading')
    setErrMsg('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          detected_domain: result.detected_domain,
          detected_level:  result.detected_level,
          trajectory:      result.career_story.trajectory_detected,
          keywords:        result.ats.missing_keywords ?? [],
          country:         'gb',
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Unknown error') }
      setData(await res.json())
      setState('done')
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong')
      setState('error')
    }
  }

  return (
    <div style={{ marginTop:48 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'var(--text-tertiary)', marginBottom:6 }}>Job Matches</div>
        <h2 style={{ fontSize:'clamp(20px, 3vw, 26px)', fontWeight:700, color:'var(--text-primary)', margin:0, letterSpacing:'-0.5px' }}>Roles that fit your profile</h2>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:6, marginBottom:0 }}>
          Real listings matched to your domain, level, and skills.{data && !data.fit_locked && ' Sorted by fit score.'}
        </p>
      </div>

      {state === 'idle' && (
        <button onClick={fetchJobs} style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:14, fontWeight:600, color:'var(--bg)', background:'var(--text-primary)', border:'none', borderRadius:4, padding:'10px 20px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Find matching jobs <span>→</span>
        </button>
      )}

      {state === 'loading' && (
        <div style={{ fontSize:13, color:'var(--text-secondary)', padding:'12px 0' }}>Searching live listings…</div>
      )}

      {state === 'error' && (
        <div style={{ fontSize:13, color:'var(--score-low)', padding:'10px 14px', border:'0.5px solid var(--score-low)', borderRadius:6, maxWidth:400 }}>
          {errMsg}
          <button onClick={fetchJobs} style={{ marginLeft:12, fontSize:12, color:'var(--text-primary)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'var(--font-sans)' }}>Retry</button>
        </div>
      )}

      {state === 'done' && data && (
        <>
          {data.jobs.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text-secondary)' }}>No listings found right now. Try again later.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
              {data.jobs.map((job) => (
                <JobCard key={job.listing.id} job={job} fitLocked={data.fit_locked} onUnlock={onUnlock} />
              ))}
            </div>
          )}
          {data.fit_locked && (
            <div style={{ marginTop:16, padding:'14px 18px', background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' as const }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Unlock fit scores &amp; skill gaps</div>
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>See exactly how well you match each role and what&apos;s holding you back.</div>
              </div>
              <button onClick={onUnlock} style={{ fontSize:13, fontWeight:600, color:'var(--bg)', background:'var(--accent)', border:'none', borderRadius:4, padding:'8px 16px', cursor:'pointer', whiteSpace:'nowrap' as const, fontFamily:'var(--font-sans)' }}>
                Unlock — €1.99
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── ResultContent ────────────────────────────────────────────────────────────
function ResultContent({ result, isPro, user, savedToHistory, token, setShowUpgradeModal, setShowPlansModal, setShowAuthModal }: {
  result: GatedAnalysisResult
  isPro: boolean
  user: { email?: string } | null
  savedToHistory: boolean
  token: string | null
  setShowUpgradeModal: (v: boolean) => void
  setShowPlansModal: (v: boolean) => void
  setShowAuthModal: (v: boolean) => void
}) {
  const unlock = () => setShowUpgradeModal(true)
  const barsRef = useAnimatedBars()

  return (
    <>
      {/* ── Score hero ── */}
      <div className={styles.scoreHero}>
        <ScoreRing score={result.total_score}/>
        <div className={styles.scoreHeroMeta}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span className={styles.ratingBadge} style={{ color:RATING_COLORS[result.rating], borderColor:`${RATING_COLORS[result.rating]}30`, background:`${RATING_COLORS[result.rating]}08` }}>
              {RATING_LABELS[result.rating]}
            </span>
            {result.detected_domain && result.detected_domain !== 'Unknown' && (
              <span style={{ fontSize:10, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--text-tertiary)', padding:'2px 8px', border:'0.5px solid var(--border)', borderRadius:3 }}>
                {LEVEL_LABELS[result.detected_level]} · {result.detected_domain}
              </span>
            )}
          </div>
          <p className={styles.scoreSummary}>{result.summary}</p>
          {result.source && <p className={styles.sourceLabel}>{result.source}</p>}
        </div>
      </div>

      {/* ── First Impression ── */}
      <div className={styles.section} style={{ animationDelay: '0.12s' }}>
        <h2 className={styles.sectionTitle}>First Impression</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* 7-second test verdict */}
          <div style={{
            padding:'16px 20px', borderRadius:6,
            border:`0.5px solid ${result.first_impression.passes_7_second_test ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
            background:result.first_impression.passes_7_second_test ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)',
          }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:result.first_impression.passes_7_second_test ? 'var(--score-high)' : 'var(--score-low)', marginBottom:7 }}>
              {result.first_impression.passes_7_second_test ? '✓ Passes 7-second test' : '✗ Fails 7-second test'}
            </div>
            <p style={{ margin:0, fontSize:13, color:'var(--text-primary)', fontStyle:'italic', lineHeight:1.6 }}>
              "{result.first_impression.what_recruiter_sees}"
            </p>
            <p style={{ margin:'6px 0 0', fontSize:11.5, color:'var(--text-tertiary)' }}>
              — what a recruiter understands about you in 7 seconds
            </p>
          </div>
          {/* Title */}
          {result.first_impression.recommended_title !== result.first_impression.current_title && (
            <div style={{ display:'flex', alignItems:'center', gap:0, borderRadius:6, border:'0.5px solid var(--border)', overflow:'hidden', fontSize:12.5 }}>
              <div style={{ flex:1, padding:'12px 16px', background:'rgba(220,38,38,0.04)' }}>
                <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', color:'var(--score-low)', marginBottom:4 }}>Current title</div>
                <span style={{ color:'var(--text-secondary)' }}>{result.first_impression.current_title || '—'}</span>
              </div>
              <div style={{ width:1, background:'var(--border)', alignSelf:'stretch' }}/>
              <div style={{ flex:1, padding:'12px 16px', background:'rgba(22,163,74,0.04)' }}>
                <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', color:'var(--score-high)', marginBottom:4 }}>Recommended</div>
                <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{result.first_impression.recommended_title}</span>
              </div>
            </div>
          )}
          {/* Summary verdict */}
          {result.first_impression.summary_verdict !== 'strong' && (
            <div style={{ padding:'10px 14px', borderRadius:5, background:'var(--bg-subtle)', border:'0.5px solid var(--border)', fontSize:12, color:'var(--text-secondary)' }}>
              <span style={{ fontWeight:600, color:'var(--text-primary)' }}>Summary/Objective: </span>
              {{ missing:'Missing — add a 2-line summary targeted to your role', generic:'Too generic — replace with something role-specific', decent:'Decent — could be sharper', strong:'' }[result.first_impression.summary_verdict]}
            </div>
          )}
        </div>
      </div>

      {/* ── Score Breakdown ── */}
      <div className={styles.section} style={{ animationDelay: '0.18s' }}>
        <h2 className={styles.sectionTitle}>Score Breakdown</h2>
        <div className={styles.categoryBars} ref={barsRef}>
          {SCORE_DIMENSIONS.map(({ key, label, max, desc }) => (
            <DimensionBar key={key} label={label}
              score={(result.scores as unknown as Record<string, number>)[key] ?? 0}
              max={max} desc={desc}
              locked={false}
              onUnlock={unlock}/>
          ))}
        </div>
      </div>

      {/* ── Impact & Achievements ── */}
      <div className={styles.section} style={{ animationDelay: '0.24s' }}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Impact & Achievements</h2>
          {result.rewrites_locked && (
            <UnlockBtn label="Unlock rewrites — €1.99" onClick={unlock}/>
          )}
        </div>
        {/* Stats bar */}
        <div style={{ display:'flex', gap:0, borderRadius:6, border:'0.5px solid var(--border)', overflow:'hidden', marginBottom:10 }}>
          {[
            { label:'With metrics', value:result.impact.bullets_with_metrics, color:'var(--score-high)' },
            { label:'Without metrics', value:result.impact.bullets_without_metrics, color:'var(--score-low)' },
          ].map((s, i) => (
            <div key={i} style={{ flex:1, padding:'14px 18px', borderRight:i===0?'0.5px solid var(--border)':'none', background:'var(--bg-elevated)' }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, letterSpacing:'-1.5px', fontFamily:'var(--font-serif)' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex:2, padding:'14px 18px', background:'var(--bg-elevated)' }}>
            <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>Pattern detected</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{result.impact.dominant_pattern}</div>
          </div>
        </div>
        {/* Verb quality */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>Action verb quality:</span>
          <span style={{
            fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em',
            padding:'2px 8px', borderRadius:2,
            color: result.impact.action_verb_quality === 'strong' ? 'var(--score-high)' : result.impact.action_verb_quality === 'weak' ? 'var(--score-low)' : 'var(--score-mid)',
            background: result.impact.action_verb_quality === 'strong' ? 'rgba(22,163,74,0.08)' : result.impact.action_verb_quality === 'weak' ? 'rgba(220,38,38,0.08)' : 'rgba(202,138,4,0.08)',
          }}>{result.impact.action_verb_quality}</span>
        </div>
        {/* Rewrites */}
        {result.rewrites_locked ? (
          <div onClick={unlock} style={{
            padding:'16px 20px', borderRadius:6, border:'0.5px dashed var(--border)',
            background:'var(--bg-subtle)', cursor:'pointer', display:'flex',
            alignItems:'center', justifyContent:'space-between',
            transition:'background 0.1s',
          }}
          onMouseOver={e => (e.currentTarget.style.background='var(--bg-muted)')}
          onMouseOut={e  => (e.currentTarget.style.background='var(--bg-subtle)')}>
            <div>
              <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>
                {result.impact.rewrites.length || 2}–3 bullet rewrites available
              </div>
              <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                Your exact bullets rewritten with Action + Context + Quantified Result
              </div>
            </div>
            <LockIcon size={13}/>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {result.impact.rewrites.map((rw, i) => (
              <BulletRewriteCard key={i} rewrite={rw}/>
            ))}
          </div>
        )}
      </div>

      {/* ── ATS Compatibility ── */}
      <div className={styles.section} style={{ animationDelay: '0.30s' }}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>ATS Compatibility</h2>
          {result.keywords_locked && (
            <UnlockBtn label="See missing keywords — €1.99" onClick={unlock}/>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Verdict */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{
              fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em',
              padding:'4px 10px', borderRadius:3,
              color: ATS_VERDICT_COLORS[result.ats.verdict],
              background:`${ATS_VERDICT_COLORS[result.ats.verdict]}10`,
              border:`0.5px solid ${ATS_VERDICT_COLORS[result.ats.verdict]}30`,
            }}>{ATS_VERDICT_LABELS[result.ats.verdict]}</span>
            <span style={{ fontSize:12, color:'var(--text-secondary)' }}>
              Title searchable: <span style={{ fontWeight:600, color:result.ats.title_is_searchable?'var(--score-high)':'var(--score-low)' }}>
                {result.ats.title_is_searchable ? 'Yes' : 'No'}
              </span>
            </span>
          </div>
          {result.ats.notes && (
            <p style={{ margin:0, fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.65 }}>{result.ats.notes}</p>
          )}
          {/* Locked: keywords + formatting issues */}
          {result.keywords_locked ? (
            <div onClick={unlock} style={{
              padding:'12px 16px', borderRadius:5, border:'0.5px dashed var(--border)',
              background:'var(--bg-subtle)', cursor:'pointer', fontSize:12,
              color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:8,
            }}>
              <LockIcon size={10}/>
              Missing keywords for your domain + formatting issues — unlock with Pro
            </div>
          ) : (
            <>
              {result.ats.missing_keywords.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:7 }}>Missing keywords for your domain</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {result.ats.missing_keywords.map(kw => (
                      <span key={kw} style={{ fontSize:11.5, padding:'3px 10px', borderRadius:3, background:'rgba(220,38,38,0.06)', border:'0.5px solid rgba(220,38,38,0.2)', color:'var(--score-low)' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.ats.formatting_issues.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:7 }}>Formatting issues</div>
                  {result.ats.formatting_issues.map((issue, i) => (
                    <div key={i} style={{ fontSize:12.5, color:'var(--text-secondary)', padding:'6px 0', borderBottom:i<result.ats.formatting_issues.length-1?'0.5px solid var(--border)':'none' }}>
                      · {issue}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Red Flags ── */}
      {result.red_flags.length > 0 && (
        <div className={styles.section} style={{ animationDelay: '0.34s' }}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>Red Flags</h2>
            <div style={{ display:'flex', gap:6 }}>
              {(['dealbreaker','warning','minor'] as const).map(sev => {
                const count = result.red_flags.filter(f => f.severity === sev).length
                if (!count) return null
                return (
                  <span key={sev} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:3, color:RED_FLAG_COLORS[sev], background:`${RED_FLAG_COLORS[sev]}10`, border:`0.5px solid ${RED_FLAG_COLORS[sev]}30` }}>
                    {count} {sev}
                  </span>
                )
              })}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {result.red_flags.map((flag, i) => (
              <RedFlagCard key={i} flag={flag} index={i}
                howToFixLocked={result.how_to_fix_locked}
                onUnlock={unlock}/>
            ))}
          </div>
        </div>
      )}

      {/* ── Career Story ── */}
      <div className={styles.section} style={{ animationDelay: '0.38s' }}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Career Story</h2>
          {result.gaps_locked && (
            <UnlockBtn label="See full analysis — €1.99" onClick={unlock}/>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ padding:'14px 18px', borderRadius:6, background:'var(--bg-elevated)', border:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:5 }}>Trajectory detected</div>
            <p style={{ margin:0, fontSize:13, color:'var(--text-primary)', fontWeight:500 }}>{result.career_story.trajectory_detected}</p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, padding:'12px 14px', borderRadius:6, background:'var(--bg-elevated)', border:'0.5px solid var(--border)' }}>
              <div style={{ fontSize:10, color:'var(--text-tertiary)', marginBottom:4 }}>Progression clear</div>
              <span style={{ fontSize:13, fontWeight:700, color:result.career_story.progression_clear?'var(--score-high)':'var(--score-low)' }}>
                {result.career_story.progression_clear ? 'Yes' : 'No'}
              </span>
            </div>
            <div style={{ flex:1, padding:'12px 14px', borderRadius:6, background:'var(--bg-elevated)', border:'0.5px solid var(--border)' }}>
              <div style={{ fontSize:10, color:'var(--text-tertiary)', marginBottom:4 }}>Seniority match</div>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', textTransform:'capitalize' as const }}>
                {result.career_story.seniority_match.replace('_', ' ')}
              </span>
            </div>
          </div>
          {result.gaps_locked ? (
            <div onClick={unlock} style={{ padding:'12px 16px', borderRadius:5, border:'0.5px dashed var(--border)', background:'var(--bg-subtle)', cursor:'pointer', fontSize:12, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:8 }}>
              <LockIcon size={10}/>
              Gaps, transitions & seniority detail — unlock with Pro
            </div>
          ) : result.career_story.gaps_or_transitions ? (
            <div style={{ padding:'12px 16px', borderRadius:5, background:'rgba(202,138,4,0.05)', border:'0.5px solid rgba(202,138,4,0.25)', fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.65 }}>
              <span style={{ fontWeight:600, color:'var(--score-mid)' }}>Gaps / Transitions: </span>
              {result.career_story.gaps_or_transitions}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Top 3 Priority Actions ── */}
      <div className={styles.section} style={{ animationDelay: '0.44s' }}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Top 3 Actions</h2>
          {result.actions_locked && (
            <UnlockBtn label="Unlock how-to + examples — €1.99" onClick={unlock}/>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {result.top_3_actions.map((action, i) => (
            <ActionCard key={i} action={action} index={i}
              detailsLocked={result.actions_locked}
              onUnlock={unlock}/>
          ))}
        </div>
      </div>

      {/* ── Upgrade banner — only for free tier ── */}
      {!isPro && (
        <div className={styles.upgradeBanner}>
          <div className={styles.upgradeBannerContent}>
            <p className={styles.upgradeBannerTitle}>Unlock the full picture</p>
            <p className={styles.upgradeBannerSub}>
              Pro unlocks your bullet rewrites, how to fix every red flag, missing ATS keywords, career gap analysis, and full how-to steps for all 3 priority actions. €1.99, one-time.
            </p>
          </div>
          <div className={styles.upgradeBannerActions}>
            <button className={styles.upgradeBannerPro} onClick={() => setShowUpgradeModal(true)}>Unlock Pro — €1.99</button>
            <button className={styles.upgradeBannerPremium} onClick={() => setShowPlansModal(true)}>See all plans</button>
          </div>
        </div>
      )}

      {/* ── Job Matches ── */}
      <JobMatchesSection result={result} token={token} onUnlock={unlock} />

      {/* ── Sign-in nudge — logged out ── */}
      {!user && (
        <div style={{ textAlign:'center' as const, padding:'16px', fontSize:12, color:'var(--text-tertiary)' }}>
          <button onClick={() => setShowAuthModal(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline', padding:0 }}>
            Sign in
          </button> to save this analysis to your history — free for all accounts.
        </div>
      )}
    </>
  )
}

// ─── Static landing data ──────────────────────────────────────────────────────
const HOW_STEPS = [
  { n:'01', title:'Paste a link or drop your PDF', desc:'Portfolio URLs, LinkedIn profiles, personal sites, or a PDF. Takes 5 seconds to submit.' },
  { n:'02', title:'We read it like a recruiter would', desc:'CVCheck checks 7 things that actually determine whether your CV passes or fails — ATS, red flags, impact, story, and more.' },
  { n:'03', title:'You get a score and real feedback', desc:'Free gives you the score, first impression, impact stats, and red flag count. Pro unlocks rewrites, fixes, and priority actions — €1.99 one-time.' },
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
  { name:'First Impression',     desc:'What a recruiter understands in the first 7 seconds — title, summary, top section' },
  { name:'Impact & Achievements',desc:'Quantified results, strong action verbs, bullet quality across every role' },
  { name:'ATS Compatibility',    desc:'Keywords, searchable job title, parser-friendly formatting' },
  { name:'Red Flags',            desc:'Absence of dealbreakers, unexplained gaps, inconsistencies, and polish issues' },
  { name:'Career Story',         desc:'Clear trajectory, role progression, seniority match' },
  { name:'Format & Scannability',desc:'Length, density, section ordering, visual consistency' },
  { name:'Credibility',          desc:'Portfolio links, recognizable brands, certifications, proof points' },
]

const LOADING_STEPS = [
  'Reading your CV…',
  'Running the 7-second test…',
  'Checking ATS compatibility…',
  'Writing your rewrites & actions…',
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
  // UI-only counter — used to show "Used your free scan" message in freeNote.
  // Security enforcement is server-side via free_scans table, not this counter.
  const [analysisCount, setAnalysisCount] = useState(0)
  const [loadingStep,   setLoadingStep]   = useState(0)
  const [pendingSave,   setPendingSave]   = useState<GatedAnalysisResult | null>(null)
  const [savedToHistory, setSavedToHistory] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (appState !== 'loading') { setLoadingStep(0); return }
    // Advance through first 3 steps on a timer; last step stays active until response
    const timers = LOADING_STEPS.slice(0, -1).map((_,i) =>
      setTimeout(() => setLoadingStep(i + 1), (i + 1) * 5000)
    )
    return () => timers.forEach(clearTimeout)
  }, [appState])

  useEffect(() => {
    if (!user || !session || !pendingSave || savedToHistory) return
    const supabase = createSupabaseBrowser()
    supabase.from('roasts').insert({
      id:          pendingSave.analysis_id,
      user_id:     user.id,
      source:      pendingSave.source ?? null,
      total_score: pendingSave.total_score,
      rating:      pendingSave.rating,
      summary:     pendingSave.summary,
      scores:      pendingSave.scores,
      // New structured fields
      first_impression: pendingSave.first_impression,
      impact:           pendingSave.impact,
      ats:              pendingSave.ats,
      red_flags:        pendingSave.red_flags,
      career_story:     pendingSave.career_story,
      format:           pendingSave.format,
      credibility:      pendingSave.credibility,
      top_3_actions:    pendingSave.top_3_actions,
      detected_domain:  pendingSave.detected_domain,
      detected_level:   pendingSave.detected_level,
      tier:             pendingSave.tier,
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
    // Note: free scan limit is enforced server-side via free_scans table.
    // Client-side check was bypassable with page refresh — removed.

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
      // Server saves automatically for logged-in users (route.ts handles it).
      // pendingSave is only for anonymous users who sign in AFTER scanning.
      if (!user) {
        setPendingSave(data)
      } else {
        // Server already saved — just reflect that in UI
        setSavedToHistory(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setAppState('error')
    }
  }

  const reset     = () => { setAppState('idle'); setResult(null); setError(''); setUrl(''); setFile(null); setPendingSave(null); setSavedToHistory(false) }
  const copyShare = async () => {
    if (!result) return
    const shareText = `My CV scored ${result.total_score}/100 (${RATING_LABELS[result.rating]}) on CVCheck. Check yours free: https://cvcheck.app`
    await navigator.clipboard.writeText(shareText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const isPro = result?.tier === 'pro' || result?.tier === 'premium'
  const scrollToTop = () => window.scrollTo({ top:0, behavior:'smooth' })

  // Scroll-reveal for each landing section
  const howRef     = useScrollReveal() as React.RefObject<HTMLElement>
  const sampleRef  = useScrollReveal() as React.RefObject<HTMLElement>
  const dimsRef    = useScrollReveal() as React.RefObject<HTMLElement>
  const pricingRef = useScrollReveal() as React.RefObject<HTMLElement>
  const statsRef   = useScrollReveal() as React.RefObject<HTMLElement>
  // Animated bars for sample section
  const sampleBarsRef = useAnimatedBars()

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
                    ? <>Used your free scan · <button style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline' }} onClick={() => setShowUpgradeModal(true)}>Unlock Pro for €1.99</button> to analyze again</>
                    : '1 free analysis · No account required'
                  }
                </div>
              </div>
            </div>

            {/* ── Stats strip ── */}
            <div className={styles.statsStrip} ref={statsRef as React.RefObject<HTMLDivElement>}>
              {[
                { num:'8',    label:'dimensions scored per CV' },
                { num:'~30s', label:'average analysis time' },
                { num:'€1.99',   label:'one-time Pro — not a subscription' },
                { num:'0',    label:'vague "consider improving" feedback' },
              ].map((s, i) => (
                <div key={s.num} className={styles.statItem} data-reveal data-reveal-delay={i * 70}>
                  <span className={styles.statNum}>{s.num}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* ── How it works ── */}
            <section id="how" className={styles.howSection} ref={howRef as React.RefObject<HTMLElement>}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead} data-reveal data-reveal-delay="0">
                  <p className={styles.sEyebrow}>How it works</p>
                  <h2 className={styles.sTitle}>Three steps, thirty seconds.</h2>
                  <p className={styles.sSub}>No account needed for your first scan.</p>
                </div>
                <div className={styles.howSteps}>
                  {HOW_STEPS.map((s, i) => (
                    <div key={s.n} className={styles.howStep} data-reveal data-reveal-delay={i * 80}>
                      <span className={styles.howStepNum}>{s.n}</span>
                      <p className={styles.howStepTitle}>{s.title}</p>
                      <p className={styles.howStepDesc}>{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Sample result ── */}
            <section className={styles.sampleSection} ref={sampleRef as React.RefObject<HTMLElement>}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead} data-reveal data-reveal-delay="0">
                  <p className={styles.sEyebrow}>What you get</p>
                  <h2 className={styles.sTitle}>A real score, not a pep talk.</h2>
                  <p className={styles.sSub}>Free gives you the score and a preview. Pro unlocks the full picture — all 8 dimensions, observations, and fixes with rewritten examples.</p>
                </div>
                <div className={styles.sampleCard} data-reveal data-reveal-delay="80">
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
                  <div className={styles.sampleBars} ref={sampleBarsRef}>
                    {SAMPLE_DIMS.map(d => (
                      <div key={d.label} className={styles.sampleBar}>
                        <div className={styles.sampleBarHeader}>
                          <span className={styles.sampleBarLabel}>{d.label}</span>
                          <span className={styles.sampleBarScore}>{d.pct}%</span>
                        </div>
                        <div className={styles.sampleBarTrack}>
                          <div className={styles.sampleBarFill} data-bar-pct={d.pct}/>
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
            <section id="dims" className={styles.dimsSection} ref={dimsRef as React.RefObject<HTMLElement>}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead} data-reveal data-reveal-delay="0">
                  <p className={styles.sEyebrow}>What we score</p>
                  <h2 className={styles.sTitle}>7 dimensions, not just a vibe check.</h2>
                  <p className={styles.sSub}>Each weighted by how much recruiters actually care — not what's easiest to measure.</p>
                </div>
                <div className={styles.dimsGrid}>
                  {DIMS_LIST.map((d, i) => (
                    <div key={d.name} className={styles.dimCard} data-reveal data-reveal-delay={i * 55}>
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
            <section id="pricing" className={styles.pricingSection} ref={pricingRef as React.RefObject<HTMLElement>}>
              <div className={styles.sectionWrap}>
                <div className={styles.sHead} data-reveal data-reveal-delay="0">
                  <p className={styles.sEyebrow}>Pricing</p>
                  <h2 className={styles.sTitle}>No tricks, no "contact us for pricing."</h2>
                  <p className={styles.sSub}>One free scan to see your score. Pro unlocks the full breakdown for €1.99 — once. Premium for unlimited.</p>
                </div>
                <div className={styles.pricingCards} data-reveal data-reveal-delay="80">
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
                          <button className={styles.pricingCtaAccent} onClick={() => setShowUpgradeModal(true)}>Get Pro — €1.99</button>
                        ) : (
                          <button className={styles.pricingCtaDark} onClick={() => setShowUpgradeModal(true)}>Get Premium — €5.99/mo</button>
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

            {/* New result content */}
            <ResultContent
              result={result}
              isPro={isPro}
              user={user}
              savedToHistory={savedToHistory}
              token={session?.access_token ?? null}
              setShowUpgradeModal={setShowUpgradeModal}
              setShowPlansModal={setShowPlansModal}
              setShowAuthModal={setShowAuthModal}
            />

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
