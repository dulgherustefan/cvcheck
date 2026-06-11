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

type InputMode = 'url' | 'pdf'
type AppState  = 'idle' | 'loading' | 'result' | 'error'

// ─── Scroll-reveal: applied once on mount, re-run when appState changes ───
function useScrollReveal(appState: AppState) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const el = entry.target as HTMLElement
        const delay = Number(el.dataset.revealDelay ?? 0)
        setTimeout(() => {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
        }, delay)
        obs.unobserve(el)
      })
    }, { threshold: 0.12 })
    els.forEach(el => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(28px)'
      el.style.transition = 'opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1)'
      obs.observe(el)
    })
    return () => obs.disconnect()
  }, [appState])
}

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now() + delay
    const step = (now: number) => {
      if (now < start) { raf = requestAnimationFrame(step); return }
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, delay])
  return value
}

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

function ScoreRing({ score }: { score: number }) {
  const r = 54, circ = 2 * Math.PI * r
  const color = score >= 66 ? 'var(--score-high)' : score >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  const [animPct, setAnimPct] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => { setTimeout(() => setAnimPct(score), 80) })
    return () => cancelAnimationFrame(raf)
  }, [score])
  const dash = (animPct / 100) * circ
  const displayScore = useCountUp(score, 1100, 120)
  return (
    <div style={{ position:'relative', width:136, height:136, flexShrink:0 }}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="5"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5" opacity="0.08" strokeDasharray={`${circ} 0`} transform="rotate(-90 68 68)"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 68 68)" style={{ transition:'stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1)' }}/>
      </svg>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' as const }}>
        <span style={{ fontSize:28, fontWeight:800, color, display:'block', letterSpacing:'-1px', lineHeight:1 }}>{displayScore}</span>
        <span style={{ fontSize:12, color:'var(--text-tertiary)', fontWeight:500 }}>/100</span>
      </div>
    </div>
  )
}

function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

function UnlockBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--text-tertiary)', background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
      <LockIcon size={9}/> {label}
    </button>
  )
}

function DimensionBar({ label, score, max, desc, locked, onUnlock }: { label:string; score:number; max:number; desc:string; locked?:boolean; onUnlock?:()=>void }) {
  const pct = (score / max) * 100
  const color = pct >= 66 ? 'var(--score-high)' : pct >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  return (
    <div style={{ display:'flex', flexDirection:'column' as const, gap:6, padding:'12px 0', borderBottom:'1px solid var(--border)', cursor:locked?'pointer':'default' }} onClick={locked?onUnlock:undefined}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <span style={{ fontSize:13, fontWeight:600, color:locked?'transparent':'var(--text-primary)', textShadow:locked?'0 0 8px var(--text-secondary)':'none', userSelect:locked?'none' as const:'auto' as const }}>{label}</span>
          <span style={{ fontSize:11, color:'var(--text-tertiary)', marginLeft:8 }}>{desc}</span>
        </div>
        {locked ? <LockIcon/> : <span style={{ fontSize:13, fontWeight:700, color }}>{score}<span style={{ fontSize:11, color:'var(--text-tertiary)' }}>/{max}</span></span>}
      </div>
      <div style={{ height:4, background:'var(--bg-muted)', borderRadius:2 }}>
        <div data-bar-pct={locked?60:pct} style={{ height:4, borderRadius:2, background:locked?'var(--border)':color, transition:'width 0.8s cubic-bezier(0.22,1,0.36,1)' }}/>
      </div>
    </div>
  )
}

function RedFlagCard({ flag, howToFixLocked, onUnlock }: { flag:{flag:string;severity:RedFlagSeverity;how_to_fix:string}; howToFixLocked:boolean; onUnlock:()=>void }) {
  const color = RED_FLAG_COLORS[flag.severity]
  const label = RED_FLAG_LABELS[flag.severity]
  return (
    <div style={{ padding:'12px 16px', borderRadius:8, background:`${color}05`, border:`1px solid ${color}25`, display:'flex', flexDirection:'column' as const, gap:6 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', padding:'2px 7px', borderRadius:4, color, background:`${color}12`, border:`1px solid ${color}30`, flexShrink:0, marginTop:1 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.4 }}>{flag.flag}</span>
      </div>
      {howToFixLocked ? (
        <div onClick={onUnlock} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', paddingLeft:2 }}>
          <span style={{ fontSize:12, color:'var(--text-secondary)', filter:'blur(4px)', userSelect:'none' as const, flex:1, pointerEvents:'none' }}>Add a one-line note explaining the gap.</span>
          <span style={{ color:'var(--text-tertiary)', flexShrink:0 }}><LockIcon size={10}/></span>
        </div>
      ) : flag.how_to_fix ? (
        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, lineHeight:1.55, paddingLeft:2 }}>
          <span style={{ fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase' as const, fontSize:9, letterSpacing:'0.08em' }}>Fix · </span>{flag.how_to_fix}
        </p>
      ) : null}
    </div>
  )
}

function BulletRewriteCard({ rewrite }: { rewrite: BulletRewrite }) {
  return (
    <div style={{ borderRadius:8, border:'1px solid var(--border)', overflow:'hidden', fontSize:12.5 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
        <div style={{ padding:'10px 14px', background:'rgba(220,38,38,0.04)', borderRight:'1px solid var(--border)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--score-low)', marginBottom:5 }}>Before</div>
          <p style={{ margin:0, color:'var(--text-secondary)', lineHeight:1.55 }}>{rewrite.original}</p>
        </div>
        <div style={{ padding:'10px 14px', background:'rgba(22,163,74,0.04)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--score-high)', marginBottom:5 }}>After</div>
          <p style={{ margin:0, color:'var(--text-primary)', fontWeight:500, lineHeight:1.55 }}>{rewrite.rewritten}</p>
        </div>
      </div>
      <div style={{ padding:'8px 14px', background:'var(--bg-subtle)', borderTop:'1px solid var(--border)' }}>
        <p style={{ margin:0, fontSize:11.5, color:'var(--text-tertiary)', lineHeight:1.5 }}><span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Why: </span>{rewrite.why}</p>
      </div>
    </div>
  )
}

function ActionCard({ action, index, detailsLocked, onUnlock }: { action:PriorityAction; index:number; detailsLocked:boolean; onUnlock:()=>void }) {
  return (
    <div style={{ padding:'16px 18px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-elevated)', display:'flex', flexDirection:'column' as const, gap:8 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <span style={{ fontSize:10, fontWeight:800, color:'var(--text-tertiary)', flexShrink:0, marginTop:1, letterSpacing:'0.04em', fontFamily:'var(--font-mono)' }}>{String(index+1).padStart(2,'0')}</span>
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontSize:13.5, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.35 }}>{action.action}</p>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{action.why_it_matters}</p>
        </div>
      </div>
      {detailsLocked ? (
        <div onClick={onUnlock} style={{ padding:'8px 12px', borderRadius:6, border:'1px dashed var(--border)', background:'var(--bg-subtle)', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
          <LockIcon size={10}/><span style={{ fontSize:12, color:'var(--text-tertiary)' }}>Unlock steps + example — Pro</span>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6, paddingLeft:20 }}>
          {action.how && <p style={{ margin:0, fontSize:12.5, color:'var(--text-primary)', lineHeight:1.6, borderLeft:'2px solid var(--accent-border)', paddingLeft:10 }}>{action.how}</p>}
          {action.example && <p style={{ margin:0, fontSize:12, color:'var(--text-tertiary)', lineHeight:1.55, fontStyle:'italic' }}>{action.example}</p>}
        </div>
      )}
    </div>
  )
}

function LockedPreview({ count, label, sublabel, onUnlock }: { count?:number|string; label:string; sublabel:string; onUnlock:()=>void }) {
  return (
    <div onClick={onUnlock} style={{ padding:'14px 18px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-subtle)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {count !== undefined && <span style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-1px', lineHeight:1 }}>{count}</span>}
        <div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{label}</div>
          <div style={{ fontSize:11.5, color:'var(--text-tertiary)' }}>{sublabel}</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, fontSize:11.5, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'1px solid var(--accent-border)', borderRadius:6, padding:'4px 10px', whiteSpace:'nowrap' as const }}>
        Unlock — €1.99 <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  )
}

const FIT_COLORS: Record<string,string> = { strong:'var(--score-high)', good:'#65A30D', partial:'var(--score-mid)', stretch:'var(--score-low)' }
function FitBadge({ label, score }: { label:string; score:number }) {
  const color = FIT_COLORS[label] ?? 'var(--text-secondary)'
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' as const, color, background:`${color}15`, border:`1px solid ${color}40`, borderRadius:4, padding:'2px 8px' }}>{score}% · {label}</span>
}

function JobCard({ job, fitLocked, onUnlock, token, initialStatus, onSaveChange }: { job:JobMatchType; fitLocked:boolean; onUnlock:()=>void; token:string|null; initialStatus?:'none'|'saved'|'applied'; onSaveChange?:(id:string,status:'none'|'saved'|'applied')=>void }) {
  const { listing, fit } = job
  const [saved, setSaved] = useState<'none'|'saved'|'applied'>(initialStatus ?? 'none')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const salary = listing.salary_min && listing.salary_min >= 1000
    ? `${Math.round(listing.salary_min/1000)}k${listing.salary_max?`–${Math.round(listing.salary_max/1000)}k`:'+'}` : null

  useEffect(() => {
    if (token) return
    try {
      const raw = localStorage.getItem(`job-${listing.id}`)
      if (!raw) return
      let status: string|null = null
      try { const p = JSON.parse(raw); if (p?.expiresAt && Date.now()>p.expiresAt) { localStorage.removeItem(`job-${listing.id}`); return }; status=p?.status??null } catch { status=raw }
      if (status==='saved'||status==='applied') setSaved(status)
    } catch {}
  }, [listing.id, token])

  async function handleSave(action: 'saved'|'applied') {
    const isOff = saved === action
    const next: 'none'|'saved'|'applied' = isOff ? 'none' : action
    setSaved(next); onSaveChange?.(listing.id, next)
    if (!token) {
      try { next==='none' ? localStorage.removeItem(`job-${listing.id}`) : localStorage.setItem(`job-${listing.id}`, JSON.stringify({ status:next, expiresAt:Date.now()+7*24*60*60*1000 })) } catch {}
      return
    }
    setSaving(true)
    try {
      const verb = isOff ? (action==='applied'?'unapply':'unsave') : (action==='applied'?'apply':'save')
      await fetch('/api/jobs/save',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:verb,listing})})
    } catch { setSaved(saved) } finally { setSaving(false) }
  }

  return (
    <div style={{ border:`1px solid ${fit?.fit_label==='strong'?'rgba(22,163,74,0.3)':'var(--border)'}`, borderRadius:10, padding:'18px 20px', background:'var(--bg-elevated)', display:'flex', flexDirection:'column' as const, gap:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3 }}>{listing.title}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3, display:'flex', gap:6, flexWrap:'wrap' as const, alignItems:'center' }}>
            <span>{listing.company}</span>
            {listing.location&&<><span style={{color:'var(--border-strong)'}}>·</span><span>{listing.location}</span></>}
            {salary&&<><span style={{color:'var(--border-strong)'}}>·</span><span style={{color:'var(--text-primary)',fontWeight:600}}>{salary}</span></>}
          </div>
        </div>
        {fit&&<FitBadge label={fit.fit_label} score={fit.fit_score}/>}
      </div>
      <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6, margin:0, display:'-webkit-box' as const, WebkitLineClamp:expanded?undefined:3, WebkitBoxOrient:'vertical' as const, overflow:expanded?'visible':'hidden' }}>{listing.description}</p>
      {listing.description.length>200&&<button onClick={()=>setExpanded(e=>!e)} style={{ alignSelf:'flex-start', fontSize:11, color:'var(--text-tertiary)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font-sans)' }}>{expanded?'Show less':'Show more'}</button>}
      {fit&&fit.strengths&&fit.strengths.length>0&&(
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column' as const, gap:5 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--score-high)' }}>Why you're a good fit</div>
          {fit.strengths.map((s,i)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}><span style={{color:'var(--score-high)',flexShrink:0}}>✓</span>{s}</div>)}
        </div>
      )}
      {fit&&fit.gaps&&fit.gaps.length>0&&(
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column' as const, gap:5 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--text-tertiary)' }}>What you're missing</div>
          {fit.gaps.map((gap,i)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}><span style={{color:'var(--score-low)',flexShrink:0}}>✕</span>{gap}</div>)}
        </div>
      )}
      {fitLocked&&fit&&(
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
          <button onClick={onUnlock} style={{ fontSize:12, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'1px solid var(--accent-border)', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Unlock skill gaps & full analysis</button>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
        <a href={listing.redirect_url} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:'center' as const, fontSize:12, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-muted)', border:'1px solid var(--border-strong)', borderRadius:6, padding:'6px 12px', textDecoration:'none' }}>View job →</a>
        <button onClick={()=>!saving&&handleSave('saved')} style={{ fontSize:13, padding:'5px 10px', borderRadius:6, border:`1px solid ${saved==='saved'?'var(--accent)':'var(--border)'}`, background:saved==='saved'?'var(--accent-subtle)':'var(--bg-muted)', color:saved==='saved'?'var(--accent)':'var(--text-tertiary)', cursor:saving?'wait':'pointer', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>{saved==='saved'?'★':'☆'}</button>
        <button onClick={()=>!saving&&handleSave('applied')} style={{ fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:6, border:`1px solid ${saved==='applied'?'var(--score-high)':'var(--border)'}`, background:saved==='applied'?'rgba(22,163,74,0.08)':'var(--bg-muted)', color:saved==='applied'?'var(--score-high)':'var(--text-tertiary)', cursor:saving?'wait':'pointer', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>{saved==='applied'?'✓ Applied':'Applied?'}</button>
      </div>
    </div>
  )
}

type FilterType = 'all'|'strong'|'good'|'partial'|'stretch'

function JobMatchesSection({ result, token, isPremium, onUnlock }: { result:GatedAnalysisResult; token:string|null; isPremium:boolean; onUnlock:()=>void }) {
  const [jobs, setJobs] = useState<JobMatchType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [alertStatus, setAlertStatus] = useState<'idle'|'loading'|'on'|'off'>('idle')
  const [savedStatuses, setSavedStatuses] = useState<Record<string,'none'|'saved'|'applied'>>({})

  useEffect(() => {
    if (!result.analysis_id) return
    const cacheKey = `jobs-cache-${result.analysis_id}`
    const savedKey  = `jobs-saved-${result.analysis_id}`
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Date.now() - (parsed.cachedAt ?? 0) < 24*60*60*1000) {
          setJobs(parsed.data.jobs ?? [])
          try { const s = sessionStorage.getItem(savedKey); if (s) setSavedStatuses(JSON.parse(s)) } catch {}
          return
        }
      }
    } catch {}
    setLoading(true)
    const headers: Record<string,string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    fetch(`/api/jobs?analysis_id=${result.analysis_id}`, { headers })
      .then(r=>r.json())
      .then((data: JobsResponse) => {
        setJobs(data.jobs ?? [])
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ data, cachedAt:Date.now() })) } catch {}
      })
      .catch(() => setError('Could not load job matches.'))
      .finally(() => setLoading(false))
  }, [result.analysis_id, token])

  useEffect(() => {
    if (!token) return
    fetch('/api/jobs/alert', { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(d=>setAlertStatus(d.subscribed?'on':'off')).catch(()=>{})
  }, [token])

  const handleSaveChange = (id:string, status:'none'|'saved'|'applied') => {
    setSavedStatuses(prev => {
      const next = {...prev, [id]:status}
      try { sessionStorage.setItem(`jobs-saved-${result.analysis_id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const toggleAlert = async () => {
    if (!token) return
    setAlertStatus('loading')
    const action = alertStatus==='on' ? 'unsubscribe' : 'subscribe'
    const body: Record<string,unknown> = { action }
    if (action==='subscribe') body['cvMeta'] = { detected_domain:result.detected_domain, detected_level:result.detected_level, keywords:result.ats?.missing_keywords??[] }
    try {
      const res = await fetch('/api/jobs/alert',{ method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify(body) })
      const d = await res.json()
      setAlertStatus(d.subscribed ? 'on' : 'off')
    } catch { setAlertStatus(alertStatus==='on'?'on':'off') }
  }

  const fitLocked = !isPremium
  const visible   = fitLocked ? jobs.slice(0,2) : jobs
  const filtered  = filter==='all' ? visible : visible.filter(j=>j.fit?.fit_label===filter)
  const counts: Record<string,number> = { strong:0, good:0, partial:0, stretch:0 }
  visible.forEach(j=>{ if (j.fit?.fit_label) counts[j.fit.fit_label]=(counts[j.fit.fit_label]??0)+1 })

  if (loading) return <div style={{ padding:32, textAlign:'center' as const, color:'var(--text-tertiary)', fontSize:13 }}>Finding matched jobs…</div>
  if (error)   return <div style={{ padding:20, color:'var(--score-low)', fontSize:13 }}>{error}</div>
  if (!jobs.length) return null

  return (
    <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', padding:'20px 24px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap' as const, gap:10 }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', margin:0 }}>Matched Jobs</h2>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' as const }}>
          {(['all','strong','good','partial'] as FilterType[]).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6, background:filter===f?'var(--accent)':'var(--bg-muted)', color:filter===f?'#fff':'var(--text-tertiary)', border:filter===f?'none':'1px solid var(--border)', cursor:'pointer', fontFamily:'var(--font-sans)', textTransform:'capitalize' as const }}>
              {f==='all'?`All (${visible.length})`:counts[f]?`${f} (${counts[f]})`:f}
            </button>
          ))}
          {token&&alertStatus!=='idle'&&(
            <button onClick={toggleAlert} disabled={alertStatus==='loading'} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6, background:alertStatus==='on'?'var(--accent-subtle)':'var(--bg-muted)', color:alertStatus==='on'?'var(--accent)':'var(--text-tertiary)', border:`1px solid ${alertStatus==='on'?'var(--accent-border)':'var(--border)'}`, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              {alertStatus==='on'?'✓ Alerts on':'Get alerts'}
            </button>
          )}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
        {filtered.map(j=>(
          <JobCard key={j.listing.id} job={j} fitLocked={fitLocked} onUnlock={onUnlock} token={token} initialStatus={savedStatuses[j.listing.id]} onSaveChange={handleSaveChange}/>
        ))}
      </div>
      {fitLocked&&jobs.length>2&&(
        <div onClick={onUnlock} style={{ marginTop:12, padding:'16px 20px', borderRadius:10, border:'1px dashed var(--border)', background:'var(--bg-subtle)', cursor:'pointer', textAlign:'center' as const }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>{jobs.length-2} more jobs locked</div>
          <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>Upgrade to Premium to see all matches with fit scores</div>
        </div>
      )}
    </div>
  )
}

function ResultContent({ result, isPro, user, token, setShowUpgradeModal, setShowPlansModal, setShowAuthModal }: {
  result:GatedAnalysisResult; isPro:boolean; user:{email?:string}|null; token:string|null;
  setShowUpgradeModal:(v:boolean)=>void; setShowPlansModal:(v:boolean)=>void; setShowAuthModal:(v:boolean)=>void
}) {
  const unlock = () => setShowUpgradeModal(true)
  const barsRef = useAnimatedBars()
  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'0 20px', display:'flex', flexDirection:'column' as const, gap:20 }}>
      {/* Score hero */}
      <div style={{ display:'flex', alignItems:'center', gap:28, padding:'28px 32px', background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', boxShadow:'var(--shadow-md)' }}>
        <ScoreRing score={result.total_score}/>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' as const, marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', padding:'3px 10px', borderRadius:4, color:RATING_COLORS[result.rating], background:`${RATING_COLORS[result.rating]}08`, border:`1px solid ${RATING_COLORS[result.rating]}30` }}>{RATING_LABELS[result.rating]}</span>
            {result.detected_domain&&result.detected_domain!=='Unknown'&&<span style={{ fontSize:10, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--text-tertiary)', padding:'2px 8px', border:'1px solid var(--border)', borderRadius:4 }}>{LEVEL_LABELS[result.detected_level]} · {result.detected_domain}</span>}
          </div>
          <p style={{ margin:0, fontSize:14, color:'var(--text-secondary)', lineHeight:1.65 }}>{result.summary}</p>
        </div>
      </div>

      {/* First Impression */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', padding:'20px 24px' }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:14, letterSpacing:'-0.02em' }}>First Impression</h2>
        <div style={{ padding:'14px 18px', borderRadius:8, border:`1px solid ${result.first_impression.passes_7_second_test?'rgba(22,163,74,0.25)':'rgba(220,38,38,0.25)'}`, background:result.first_impression.passes_7_second_test?'rgba(22,163,74,0.04)':'rgba(220,38,38,0.04)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:result.first_impression.passes_7_second_test?'var(--score-high)':'var(--score-low)', marginBottom:7 }}>{result.first_impression.passes_7_second_test?'✓ Passes 7-second test':'✗ Fails 7-second test'}</div>
          <p style={{ margin:0, fontSize:13, color:'var(--text-primary)', fontStyle:'italic', lineHeight:1.6 }}>"{result.first_impression.what_recruiter_sees}"</p>
          <p style={{ margin:'6px 0 0', fontSize:11.5, color:'var(--text-tertiary)' }}>— what a recruiter understands about you in 7 seconds</p>
        </div>
      </div>

      {/* Score Breakdown */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', padding:'20px 24px' }} ref={barsRef}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4, letterSpacing:'-0.02em' }}>Score Breakdown</h2>
        {SCORE_DIMENSIONS.map(({key,label,max,desc})=>(
          <DimensionBar key={key} label={label} score={(result.scores as unknown as Record<string,number>)[key]??0} max={max} desc={desc} locked={false} onUnlock={unlock}/>
        ))}
      </div>

      {/* Impact */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Impact & Achievements</h2>
          {result.rewrites_locked&&<UnlockBtn label="Unlock rewrites — €1.99" onClick={unlock}/>}
        </div>
        <div style={{ display:'flex', gap:0, borderRadius:8, border:'1px solid var(--border)', overflow:'hidden', marginBottom:10 }}>
          {[{label:'With metrics',value:result.impact.bullets_with_metrics,color:'var(--score-high)'},{label:'Without metrics',value:result.impact.bullets_without_metrics,color:'var(--score-low)'}].map((s,i)=>(
            <div key={i} style={{ flex:1, padding:'14px 18px', borderRight:i===0?'1px solid var(--border)':'none' }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, letterSpacing:'-1.5px' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex:2, padding:'14px 18px' }}>
            <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>Pattern</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{result.impact.dominant_pattern}</div>
          </div>
        </div>
        {result.rewrites_locked
          ? <LockedPreview count={Math.min(result.impact.bullets_without_metrics||2,3)} label="bullet rewrites ready" sublabel="Your weakest bullets rewritten with Action + Result + Numbers" onUnlock={unlock}/>
          : <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>{result.impact.rewrites.map((rw,i)=><BulletRewriteCard key={i} rewrite={rw}/>)}</div>
        }
      </div>

      {/* ATS */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>ATS Compatibility</h2>
          {result.keywords_locked&&<UnlockBtn label="See missing keywords — €1.99" onClick={unlock}/>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', padding:'4px 10px', borderRadius:4, color:ATS_VERDICT_COLORS[result.ats.verdict], background:`${ATS_VERDICT_COLORS[result.ats.verdict]}10`, border:`1px solid ${ATS_VERDICT_COLORS[result.ats.verdict]}30` }}>{ATS_VERDICT_LABELS[result.ats.verdict]}</span>
          <span style={{ fontSize:12, color:'var(--text-secondary)' }}>Title searchable: <span style={{ fontWeight:600, color:result.ats.title_is_searchable?'var(--score-high)':'var(--score-low)' }}>{result.ats.title_is_searchable?'Yes':'No'}</span></span>
        </div>
        {result.keywords_locked
          ? <LockedPreview count="5" label="missing ATS keywords for your domain" sublabel="The exact terms recruiters search that aren't in your CV" onUnlock={unlock}/>
          : result.ats.missing_keywords.length>0&&(
            <div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:7 }}>Missing keywords</div>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:5 }}>
                {result.ats.missing_keywords.map(kw=><span key={kw} style={{ fontSize:11.5, padding:'3px 10px', borderRadius:4, background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', color:'var(--score-low)' }}>{kw}</span>)}
              </div>
            </div>
          )
        }
      </div>

      {/* Red Flags */}
      {result.red_flags.length>0&&(
        <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', padding:'20px 24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Red Flags</h2>
            {result.how_to_fix_locked&&<UnlockBtn label="Unlock fixes — €1.99" onClick={unlock}/>}
          </div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
            {result.red_flags.map((flag,i)=><RedFlagCard key={i} flag={flag} howToFixLocked={result.how_to_fix_locked} onUnlock={unlock}/>)}
          </div>
        </div>
      )}

      {/* Top 3 Actions */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Top 3 Actions</h2>
          {result.actions_locked&&<UnlockBtn label="Unlock how-to + examples — €1.99" onClick={unlock}/>}
        </div>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
          {result.top_3_actions.map((action,i)=><ActionCard key={i} action={action} index={i} detailsLocked={result.actions_locked} onUnlock={unlock}/>)}
        </div>
      </div>

      {/* Upgrade banner */}
      {!isPro&&(
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:12, padding:36, display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, flexWrap:'wrap' as const, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg, var(--accent), rgba(22,199,154,0.3))', pointerEvents:'none' }}/>
          <div>
            <p style={{ fontSize:16.5, fontWeight:700, color:'var(--text-primary)', margin:'0 0 6px', letterSpacing:'-0.04em' }}>You're missing the part that actually helps.</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.65, margin:0, maxWidth:360 }}>Pro shows your bullet rewrites, how to fix every red flag, ATS keywords, and 3 priority actions. €1.99, once.</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:8, flexShrink:0 }}>
            <button onClick={()=>setShowUpgradeModal(true)} style={{ padding:'11px 22px', fontSize:13.5, fontWeight:600, color:'#fff', background:'var(--accent)', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Unlock Pro — €1.99</button>
            <button onClick={()=>setShowPlansModal(true)} style={{ padding:'11px 22px', fontSize:13.5, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'1px solid var(--border-strong)', borderRadius:8, cursor:'pointer', fontFamily:'var(--font-sans)' }}>See all plans</button>
          </div>
        </div>
      )}

      <JobMatchesSection result={result} token={token} isPremium={result.tier==='premium'||result.tier==='pro'} onUnlock={()=>setShowPlansModal(true)}/>
      {!user&&<div style={{ textAlign:'center' as const, padding:16, fontSize:12, color:'var(--text-tertiary)' }}><button onClick={()=>setShowAuthModal(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline', padding:0 }}>Sign in</button> to save this to your history — free for all accounts.</div>}
    </div>
  )
}

// ─── Plans modal ───────────────────────────────────────────────
const PLAN_DEFS = {
  free:    { label:'Free',    price:'€0',    period:'forever free', features:['Overall score /100 + rating','First impression (7-second test)','Impact stats — bullets with/without metrics','Red flag count + severity','ATS verdict','Career trajectory + format verdict','History saved (requires account)'] },
  pro:     { label:'Pro',     price:'€1.99', period:'one-time',     features:['Everything in Free','Bullet rewrites on your actual text','How to fix every red flag','Missing ATS keywords for your domain','Career gaps & seniority analysis','Top 3 priority actions with how-to + examples'] },
  premium: { label:'Premium', price:'€5.99', period:'/month',       features:['Everything in Pro','Unlimited analyses','Job matching — live listings matched to your profile'] },
}

function PlansModal({ tier, userId, userEmail, onClose, onBuy }: { tier:string; userId?:string; userEmail?:string; onClose:()=>void; onBuy:()=>void }) {
  const [buying, setBuying] = useState<string|null>(null)
  const handleBuy = async (plan:'pro'|'premium') => {
    if (!userId) { onBuy(); return }
    setBuying(plan)
    try {
      const res = await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,userId,email:userEmail})})
      const { url } = await res.json()
      if (url) window.location.href=url
    } catch { setBuying(null) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px 16px' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 32px 100px rgba(0,0,0,0.20)' }}>
        <div style={{ padding:'24px 26px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:'0 0 4px', letterSpacing:'-0.04em' }}>Plans</h2>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>See your score free. Pay €1.99 once to fix it.</p>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-subtle)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-tertiary)', cursor:'pointer' }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column' as const, gap:8 }}>
          {(['free','pro','premium'] as const).map(pk=>{
            const p=PLAN_DEFS[pk]; const isCurrent=tier===pk
            return (
              <div key={pk} style={{ border:pk==='pro'?'1.5px solid var(--border-strong)':'1px solid var(--border)', borderRadius:12, background:pk==='pro'?'var(--bg-subtle)':'var(--bg)', overflow:'hidden', position:'relative' as const }}>
                {pk==='pro'&&<div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'var(--accent)' }}/>}
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:pk==='pro'?'var(--accent)':pk==='premium'?'var(--score-high)':'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.07em' }}>{p.label}</span>
                    {pk==='pro'&&<span style={{ fontSize:8, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, background:'var(--accent)', color:'#fff', padding:'2px 7px', borderRadius:20 }}>Popular</span>}
                    {isCurrent&&<span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase' as const, color:'var(--text-tertiary)', border:'1px solid var(--border)', padding:'2px 7px', borderRadius:20 }}>Current</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                    <span style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', lineHeight:1 }}>{p.price}</span>
                    {p.period&&<span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{p.period}</span>}
                  </div>
                </div>
                <div style={{ padding:'12px 18px 14px', borderTop:'1px solid var(--border)' }}>
                  <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column' as const, gap:6 }}>
                    {p.features.map(f=><li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.45 }}>
                      <svg width="12" height="12" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>{f}
                    </li>)}
                  </ul>
                  {!isCurrent&&pk!=='free'&&<button onClick={()=>handleBuy(pk)} disabled={!!buying} style={{ width:'100%', marginTop:12, padding:10, fontSize:13, fontWeight:600, color:'#fff', background:'var(--accent)', border:'none', borderRadius:8, cursor:buying?'not-allowed':'pointer', fontFamily:'var(--font-sans)' }}>
                    {buying===pk?'Loading…':pk==='pro'?'Get Pro — €1.99':'Get Premium — €5.99/mo'}
                  </button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Account dropdown ──────────────────────────────────────────
const TIER_META:Record<string,{label:string;color:string}> = {
  free:    {label:'Free',    color:'var(--text-tertiary)'},
  pro:     {label:'Pro',     color:'var(--accent)'},
  premium: {label:'Premium', color:'var(--score-high)'},
}
const ddItem:React.CSSProperties = { display:'flex', alignItems:'center', gap:9, width:'100%', padding:'9px 16px', background:'transparent', border:'none', color:'var(--text-secondary)', fontSize:12.5, cursor:'pointer', textAlign:'left', fontFamily:'var(--font-sans)' }

function AccountDropdown({ user, tier, onOpenAccount, onOpenPlans, onSignOut }: { user:{email?:string}; tier:string; onOpenAccount:()=>void; onOpenPlans:()=>void; onSignOut:()=>void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const meta = TIER_META[tier]??TIER_META.free
  const initials = (user.email??'U').slice(0,2).toUpperCase()
  useEffect(() => {
    const h=(e:MouseEvent)=>{ if (ref.current&&!ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  }, [])
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px 4px 5px', background:open?'var(--bg-subtle)':'transparent', border:'1px solid var(--border)', borderRadius:40, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
        <span style={{ width:25, height:25, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{initials}</span>
        <span style={{ maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, fontSize:12.5, fontWeight:500, color:'var(--text-secondary)' }}>{user.email?.split('@')[0]}</span>
        <svg width="10" height="10" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&(
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:220, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.10)', zIndex:1000, animation:'dropIn 0.18s cubic-bezier(0.22,1,0.36,1)' }}>
          <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{user.email}</div>
            <div style={{ fontSize:10.5, color:meta.color, fontWeight:600, marginTop:3, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>{meta.label} plan</div>
          </div>
          <div style={{ padding:'4px 0' }}>
            <button className="dd-row" onClick={()=>{onOpenAccount();setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>My account</button>
            <button className="dd-row" onClick={()=>{router.push('/history');setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>History</button>
            <button className="dd-row" onClick={()=>{router.push('/history?tab=saved');setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Saved jobs</button>
            <button className="dd-row" onClick={()=>{onOpenPlans();setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Plans</button>
          </div>
          <div style={{ borderTop:'1px solid var(--border)', padding:'4px 0' }}>
            <button className="dd-danger" onClick={()=>{onSignOut();setOpen(false)}} style={{...ddItem,color:'#ef4444'}}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Loading steps ─────────────────────────────────────────────
const LOADING_STEPS = ['Reading your CV…','Running the 7-second test…','Checking ATS compatibility…','Writing your rewrites & actions…']

// ─── SVG logo ──────────────────────────────────────────────────
function TealLogo() {
  return (
    <svg viewBox="0 0 28 28" fill="none" width="26" height="26">
      <rect width="28" height="28" rx="6" fill="#16C79A"/>
      <path d="M7 14.5L11.5 19L21 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Nav link hover helper ─────────────────────────────────────
function NavBtn({ label, onClick }: { label:string; onClick:()=>void }) {
  return (
    <button onClick={onClick}
      style={{ padding:'6px 16px', fontSize:14, fontWeight:500, color:'var(--text-secondary)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)', transition:'color 0.15s', borderRadius:6 }}
      onMouseEnter={e=>(e.currentTarget.style.color='var(--text-primary)')}
      onMouseLeave={e=>(e.currentTarget.style.color='var(--text-secondary)')}
    >{label}</button>
  )
}

// ─── Accent button hover helper ────────────────────────────────
function AccentBtn({ children, onClick, style: extraStyle }: { children:React.ReactNode; onClick:()=>void; style?:React.CSSProperties }) {
  return (
    <button onClick={onClick}
      style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, padding:'13px 28px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)', transition:'background 0.15s, transform 0.15s, box-shadow 0.15s', ...extraStyle }}
      onMouseEnter={e=>{ const b=e.currentTarget; b.style.background='var(--accent-hover)'; b.style.transform='translateY(-1px)'; b.style.boxShadow='0 4px 18px rgba(22,199,154,0.3)' }}
      onMouseLeave={e=>{ const b=e.currentTarget; b.style.background='var(--accent)'; b.style.transform='none'; b.style.boxShadow='none' }}
    >{children}</button>
  )
}

// ─── MockupChrome wrapper ──────────────────────────────────────
function MockupChrome({ children }: { children:React.ReactNode }) {
  return (
    <div style={{ background:'var(--bg-elevated)', borderRadius:16, border:'1px solid var(--border)', boxShadow:'0 4px 24px rgba(15,23,42,0.06), 0 24px 80px rgba(15,23,42,0.10)', overflow:'hidden', marginTop:56, textAlign:'left' as const }}>
      <div style={{ padding:'12px 18px', background:'var(--bg-subtle)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ display:'flex', gap:5 }}>
          {['#EF4444','#F59E0B','#22C55E'].map(c=><div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}
        </div>
        <div style={{ flex:1, height:22, background:'var(--bg-muted)', borderRadius:4, maxWidth:280, margin:'0 auto' }}/>
      </div>
      {children}
    </div>
  )
}

// ─── Section eyebrow badge ─────────────────────────────────────
function Eyebrow({ label }: { label:string }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--accent-subtle)', border:'1px solid var(--accent-border)', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:700, color:'var(--accent-text)', letterSpacing:'0.03em', textTransform:'uppercase' as const, marginBottom:20 }}>{label}</div>
  )
}

// ─── Main export ───────────────────────────────────────────────
export default function Home() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const { tier } = useTier(user?.id)
  const router = useRouter()

  const [showAuthModal,    setShowAuthModal]    = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showPlansModal,   setShowPlansModal]   = useState(false)
  const [mode,             setMode]             = useState<InputMode>('url')
  const [url,              setUrl]              = useState('')
  const [file,             setFile]             = useState<File|null>(null)
  const [isDragging,       setIsDragging]       = useState(false)
  const [appState,         setAppState]         = useState<AppState>('idle')
  const [result,           setResult]           = useState<GatedAnalysisResult|null>(null)
  const [error,            setError]            = useState('')
  const [copied,           setCopied]           = useState(false)
  const [shareLoading,     setShareLoading]     = useState(false)
  const [shareUrl,         setShareUrl]         = useState<string|null>(null)
  const [analysisCount,    setAnalysisCount]    = useState(0)
  const [loadingStep,      setLoadingStep]      = useState(0)
  const [pendingSave,      setPendingSave]      = useState<GatedAnalysisResult|null>(null)
  const [savedToHistory,   setSavedToHistory]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useScrollReveal(appState)

  useEffect(() => {
    if (appState!=='loading'){setLoadingStep(0);return}
    const timers=LOADING_STEPS.slice(0,-1).map((_,i)=>setTimeout(()=>setLoadingStep(i+1),(i+1)*5000))
    return ()=>timers.forEach(clearTimeout)
  }, [appState])

  useEffect(() => {
    if (!user||!session||!pendingSave||savedToHistory) return
    const supabase=createSupabaseBrowser()
    supabase.from('roasts').insert({
      id:pendingSave.analysis_id, user_id:user.id, source:pendingSave.source??null,
      total_score:pendingSave.total_score, rating:pendingSave.rating, summary:pendingSave.summary,
      scores:pendingSave.scores, first_impression:pendingSave.first_impression, impact:pendingSave.impact,
      ats:pendingSave.ats, red_flags:pendingSave.red_flags, career_story:pendingSave.career_story,
      format:pendingSave.format, credibility:pendingSave.credibility, top_3_actions:pendingSave.top_3_actions,
      detected_domain:pendingSave.detected_domain, detected_level:pendingSave.detected_level, tier:pendingSave.tier,
    }).then(({error})=>{ if (!error){setSavedToHistory(true);setPendingSave(null)} })
  }, [user, session, pendingSave, savedToHistory])

  function handleSignOut() {
    try { const keys:string[]=[]; for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k&&(k.startsWith('jobs-cache-')||k.startsWith('jobs-saved-')))keys.push(k)}; keys.forEach(k=>sessionStorage.removeItem(k)) } catch {}
    signOut()
  }

  const handleDrop = useCallback((e:DragEvent<HTMLDivElement>)=>{ e.preventDefault();setIsDragging(false);const f=e.dataTransfer.files[0];if(f?.type==='application/pdf')setFile(f) },[])

  const submit = async () => {
    if (mode==='url'&&!url.trim()) return
    if (mode==='pdf'&&!file) return
    setAppState('loading'); setError(''); setResult(null)
    try {
      let res:Response
      if (mode==='pdf'&&file) {
        const form=new FormData(); form.append('file',file)
        res=await fetch('/api/roast',{method:'POST',body:form,headers:session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{}})
      } else {
        res=await fetch('/api/roast',{method:'POST',headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({url:url.trim()})})
      }
      const data=await res.json()
      if (!res.ok) {
        if (res.status===403&&data.error==='free_limit_reached'){setShowUpgradeModal(true);setAppState('idle');return}
        if (res.status===429){const mins=data.retryAfter?Math.ceil(data.retryAfter/60):60;setError(`Too many analyses. Try again in ${mins} minute${mins!==1?'s':''}.`);setAppState('error');return}
        throw new Error(data.error||'Analysis failed')
      }
      setResult(data); setAppState('result'); setAnalysisCount(c=>c+1)
      if (!user) setPendingSave(data); else setSavedToHistory(true)
    } catch(err) { setError(err instanceof Error?err.message:'Something went wrong'); setAppState('error') }
  }

  const reset = () => { setAppState('idle');setResult(null);setError('');setUrl('');setFile(null);setPendingSave(null);setSavedToHistory(false);setShareUrl(null) }

  const copyShare = async () => {
    if (!result) return
    if (shareUrl) { await navigator.clipboard.writeText(shareUrl);setCopied(true);setTimeout(()=>setCopied(false),2500);return }
    setShareLoading(true)
    try {
      const res=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roast_id:result.analysis_id})})
      if (!res.ok) throw new Error()
      const { token } = await res.json()
      const u=`${window.location.origin}/share/${token}`; setShareUrl(u)
      await navigator.clipboard.writeText(u);setCopied(true);setTimeout(()=>setCopied(false),2500)
    } catch {
      const fallback=`My CV scored ${result.total_score}/100 on CVCheck. Check yours free: https://cvcheck.app`
      await navigator.clipboard.writeText(fallback);setCopied(true);setTimeout(()=>setCopied(false),2000)
    } finally { setShareLoading(false) }
  }

  const isPro = result?.tier==='pro'||result?.tier==='premium'
  const scrollToUpload = () => document.getElementById('upload')?.scrollIntoView({behavior:'smooth'})

  const isLanding = appState==='idle'||appState==='error'

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' as const, background:'var(--bg)', fontFamily:'var(--font-sans)' }}>

      {/* Global keyframes injected inline */}
      <style>{`
        @keyframes headerSlideDown { from { opacity:0; transform:translateY(-100%); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
        @keyframes dropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulseDot { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(22,199,154,0.5); } 50% { opacity:0.6; box-shadow:0 0 0 4px rgba(22,199,154,0); } }
      `}</style>

      {showAuthModal    && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
      {showUpgradeModal && <UpgradeModal onClose={()=>setShowUpgradeModal(false)} roastId={result?.analysis_id} userId={user?.id} userEmail={user?.email}/>}
      {showAccountModal && user && <AccountModal onClose={()=>setShowAccountModal(false)} userId={user.id} userEmail={user.email??''} onUpgrade={()=>{setShowAccountModal(false);setShowPlansModal(true)}} onSignOut={()=>{setShowAccountModal(false);handleSignOut()}}/>}
      {showPlansModal   && <PlansModal tier={tier} userId={user?.id} userEmail={user?.email} onClose={()=>setShowPlansModal(false)} onBuy={()=>{setShowPlansModal(false);setShowUpgradeModal(true)}}/>}

      {/* ── NAV ── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,0.92)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', animation:'headerSlideDown 0.45s cubic-bezier(0.22,1,0.36,1) both' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 48px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, userSelect:'none', animation:'fadeUp 0.5s 0.05s cubic-bezier(0.22,1,0.36,1) both' }}>
            <TealLogo/><span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.3px' }}>CVCheck</span>
          </div>
          <ul style={{ display:'flex', alignItems:'center', gap:0, listStyle:'none', position:'absolute', left:'50%', transform:'translateX(-50%)' }}>
            {[['CV Analysis','#analysis'],['Job Matching','#jobs'],['Job Alerts','#alerts'],['Pricing','#pricing']].map(([label,href],i)=>(
              <li key={href} style={{ animation:`fadeUp 0.5s ${0.1+i*0.06}s cubic-bezier(0.22,1,0.36,1) both` }}>
                <NavBtn label={label} onClick={()=>document.querySelector(href)?.scrollIntoView({behavior:'smooth'})}/>
              </li>
            ))}
          </ul>
          <div style={{ display:'flex', alignItems:'center', gap:8, animation:'fadeUp 0.5s 0.15s cubic-bezier(0.22,1,0.36,1) both' }}>
            {!authLoading&&(user ? (
              <AccountDropdown user={user} tier={tier} onOpenAccount={()=>setShowAccountModal(true)} onOpenPlans={()=>setShowPlansModal(true)} onSignOut={handleSignOut}/>
            ) : (
              <>
                <button onClick={()=>setShowAuthModal(true)} style={{ fontSize:14, fontWeight:500, color:'var(--text-secondary)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)', padding:'8px 14px', borderRadius:8, transition:'color 0.15s' }} onMouseEnter={e=>(e.currentTarget.style.color='var(--text-primary)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-secondary)')}>Sign in</button>
                <button onClick={scrollToUpload} style={{ fontSize:14, fontWeight:600, color:'#fff', background:'var(--accent)', border:'none', borderRadius:8, padding:'9px 20px', cursor:'pointer', fontFamily:'var(--font-sans)', transition:'background 0.15s, transform 0.15s, box-shadow 0.15s' }} onMouseEnter={e=>{ const b=e.currentTarget; b.style.background='var(--accent-hover)'; b.style.transform='translateY(-1px)'; b.style.boxShadow='0 4px 16px rgba(22,199,154,0.3)' }} onMouseLeave={e=>{ const b=e.currentTarget; b.style.background='var(--accent)'; b.style.transform='none'; b.style.boxShadow='none' }}>Check My CV — Free</button>
              </>
            ))}
            <ThemeToggle/>
          </div>
        </div>
      </nav>

      <main style={{ flex:1, paddingTop:64 }}>

        {/* ── HERO ── */}
        <section style={{ position:'relative', overflow:'hidden', background:'var(--bg)' }}>
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, backgroundImage:'linear-gradient(rgba(22,199,154,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(22,199,154,0.04) 1px,transparent 1px)', backgroundSize:'40px 40px' }}/>
          <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', background:'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(22,199,154,0.10) 0%, transparent 65%)' }}/>
          <div id="upload" style={{ position:'relative', zIndex:2, maxWidth:720, margin:'0 auto', padding:'100px 24px 96px', textAlign:'center' as const, display:'flex', flexDirection:'column' as const, alignItems:'center' }}>
            {/* Badge */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', border:'1px solid var(--accent-border)', background:'var(--accent-subtle)', fontSize:12, color:'var(--accent-text)', fontWeight:600, borderRadius:20, marginBottom:32, animation:'fadeUp 0.55s 0.05s cubic-bezier(0.22,1,0.36,1) both' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', display:'inline-block', animation:'pulseDot 2.8s ease-in-out infinite' }}/>
              AI-powered CV Analysis
            </div>
            {/* Title */}
            <h1 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(40px,5.5vw,72px)', lineHeight:1.05, letterSpacing:'-2px', color:'var(--text-primary)', margin:'0 0 24px', fontWeight:800, animation:'fadeUp 0.55s 0.13s cubic-bezier(0.22,1,0.36,1) both' }}>
              Your CV, Brutally Honest.<br/><span style={{ color:'var(--accent)' }}>Land More Interviews.</span>
            </h1>
            <p style={{ fontSize:18, color:'var(--text-secondary)', lineHeight:1.65, maxWidth:460, margin:'0 auto 48px', fontWeight:400, animation:'fadeUp 0.55s 0.21s cubic-bezier(0.22,1,0.36,1) both' }}>
              Upload your CV and get a full AI diagnosis — score, red flags, ATS gaps, and rewritten bullets — in under 30 seconds.
            </p>

            {/* Upload card */}
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:560, overflow:'hidden', boxShadow:'0 0 0 1px rgba(22,199,154,0.06), 0 4px 24px rgba(15,23,42,0.08), 0 24px 64px rgba(15,23,42,0.08)', animation:'fadeUp 0.55s 0.29s cubic-bezier(0.22,1,0.36,1) both' }}>
              {/* Tabs */}
              <div style={{ padding:'14px 16px 0', display:'flex', gap:0, borderBottom:'1px solid var(--border)' }}>
                {(['url','pdf'] as const).map(m=>(
                  <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:'10px 8px 12px', fontSize:13, fontWeight:600, color:mode===m?'var(--text-primary)':'var(--text-tertiary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)', borderBottom:mode===m?'2px solid var(--accent)':'2px solid transparent', marginBottom:'-1px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'color 0.15s' }}>
                    {m==='url'
                      ? <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Link / URL</>
                      : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Upload PDF</>
                    }
                  </button>
                ))}
              </div>
              <div style={{ padding:'16px 18px 14px', display:'flex', flexDirection:'column' as const, gap:12 }}>
                {mode==='url'&&(
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="url" placeholder="yourportfolio.com · linkedin.com/in/yourname" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}
                      style={{ flex:1, padding:'11px 14px', fontSize:14, border:'1px solid var(--border)', borderRadius:10, background:'var(--bg-subtle)', color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', transition:'border-color 0.15s, box-shadow 0.15s' }}
                      onFocus={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.boxShadow='0 0 0 3px var(--accent-subtle)' }}
                      onBlur={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none' }}
                      autoComplete="off" spellCheck={false}
                    />
                    <button onClick={submit} disabled={!url.trim()||appState==='loading'} style={{ padding:'11px 20px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:!url.trim()||appState==='loading'?'not-allowed':'pointer', fontFamily:'var(--font-sans)', opacity:!url.trim()||appState==='loading'?0.4:1, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' as const, transition:'background 0.15s' }}>
                      Analyze <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                  </div>
                )}
                {mode==='pdf'&&(
                  <>
                    <div onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onClick={()=>!file&&fileInputRef.current?.click()}
                      style={{ border:`1.5px dashed ${isDragging?'var(--accent)':file?'var(--score-high)':'var(--border)'}`, borderRadius:10, padding:'28px 20px', textAlign:'center' as const, cursor:file?'default':'pointer', background:isDragging?'var(--accent-subtle)':file?'rgba(22,163,74,0.04)':'var(--bg-subtle)', transition:'border-color 0.15s, background 0.15s' }}>
                      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f?.type==='application/pdf')setFile(f)}} style={{ display:'none' }}/>
                      {file ? (
                        <div style={{ display:'flex', alignItems:'center', gap:12, justifyContent:'center' }}>
                          <svg width="20" height="20" fill="none" stroke="var(--score-high)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <div style={{ textAlign:'left' as const }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{file.name}</div>
                            <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{(file.size/1024).toFixed(0)} KB · PDF ready</div>
                          </div>
                          <button onClick={e=>{e.stopPropagation();setFile(null)}} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)', padding:4 }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <svg width="28" height="28" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom:8 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', marginBottom:4 }}>Drop your CV here</div>
                          <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>or click to browse · PDF · max 5 MB</div>
                        </>
                      )}
                    </div>
                    <button onClick={submit} disabled={!file||appState==='loading'} style={{ width:'100%', padding:'13px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:file&&appState!=='loading'?'pointer':'not-allowed', fontFamily:'var(--font-sans)', opacity:!file||appState==='loading'?0.38:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, transition:'background 0.15s' }}>
                      Analyze my CV <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                  </>
                )}
                {(appState==='error'||appState==='idle')&&error&&(
                  <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', fontSize:12.5, color:'var(--score-low)', display:'flex', gap:8, alignItems:'flex-start' }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}
                  </div>
                )}
              </div>
              <div style={{ padding:'10px 18px 14px', fontSize:12, color:'var(--text-tertiary)', textAlign:'center' as const, borderTop:'1px solid var(--border)' }}>
                {tier==='free'&&analysisCount>=1
                  ? <>Used your free scan · <button style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline' }} onClick={()=>setShowUpgradeModal(true)}>Unlock Pro for €1.99</button> to analyze again</>
                  : '1 free scan · no account, no card required'}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:'flex', justifyContent:'center', gap:56, flexWrap:'wrap' as const, marginTop:56, paddingTop:40, borderTop:'1px solid var(--border)', width:'100%', animation:'fadeUp 0.55s 0.45s cubic-bezier(0.22,1,0.36,1) both' }}>
              {[{num:'7',label:'dimensions scored'},{num:'~30s',label:'from upload to score'},{num:'€1.99',label:'Pro · one-time'},{num:'0',label:'"consider improving" in your feedback'}].map(s=>(
                <div key={s.num} style={{ textAlign:'center' as const }}>
                  <div style={{ fontSize:40, fontWeight:800, color:'var(--accent)', letterSpacing:'-2px', lineHeight:1 }}>{s.num}</div>
                  <div style={{ fontSize:13, color:'var(--text-tertiary)', marginTop:6 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LOADING OVERLAY ── */}
        {appState==='loading'&&(
          <div style={{ position:'fixed', inset:0, background:'rgba(255,255,255,0.94)', backdropFilter:'blur(14px)', display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', zIndex:300, gap:20 }}>
            <div style={{ width:36, height:36, border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
            <p style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)' }}>Analyzing your CV…</p>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:8, alignItems:'center' }}>
              {LOADING_STEPS.map((step,i)=>(
                <div key={step} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:i===loadingStep?'var(--text-secondary)':'var(--text-tertiary)', opacity:i<=loadingStep?1:0.25, transition:'opacity 0.3s' }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:i===loadingStep?'var(--accent)':'var(--border)', transition:'background 0.3s' }}/>{step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {appState==='result'&&result&&(
          <section style={{ background:'var(--bg)', padding:'32px 0 60px' }}>
            <div style={{ maxWidth:800, margin:'0 auto 20px', padding:'0 20px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' as const }}>
              <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>New analysis
              </button>
              {user&&savedToHistory&&(
                <button onClick={()=>router.push('/history')} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--score-high)', background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:6, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Saved · View history
                </button>
              )}
              {!user&&<button onClick={()=>setShowAuthModal(true)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'1px solid var(--border)', borderRadius:6, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Sign in to save</button>}
              <button onClick={copyShare} disabled={shareLoading} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'1px solid var(--border)', borderRadius:6, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)', opacity:shareLoading?0.6:1 }}>
                {copied?<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Link copied!</>:shareLoading?<>Generating…</>:<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share score</>}
              </button>
            </div>
            <ResultContent result={result} isPro={isPro} user={user} token={session?.access_token??null} setShowUpgradeModal={setShowUpgradeModal} setShowPlansModal={setShowPlansModal} setShowAuthModal={setShowAuthModal}/>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════
            LANDING — idle / error only
        ═══════════════════════════════════════════════════ */}
        {isLanding&&(<>

          {/* ── CV Analysis ── */}
          <section id="analysis" style={{ background:'var(--bg-subtle)', padding:'96px 0 80px', borderTop:'1px solid var(--border)' }}>
            <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 48px', textAlign:'center' as const }} data-reveal>
              <Eyebrow label="AI CV Analysis"/>
              <h2 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, color:'var(--text-primary)', lineHeight:1.1, letterSpacing:'-1.5px', maxWidth:640, margin:'0 auto 16px' }}>Every recruiter bias, every ATS gap — exposed.</h2>
              <p style={{ fontSize:17, color:'var(--text-secondary)', lineHeight:1.65, maxWidth:520, margin:'0 auto 32px' }}>CVCheck reads your CV the way a recruiter does in 7 seconds, then goes deeper — flagging weak verbs, missing keywords, and credibility gaps across 7 dimensions.</p>
              <AccentBtn onClick={scrollToUpload} style={{ marginBottom:56 }}>Analyze My CV — Free ↑</AccentBtn>
              <MockupChrome>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                  <div style={{ padding:'28px 24px', borderRight:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:24, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
                      <div style={{ position:'relative' as const, width:88, height:88, flexShrink:0 }}>
                        <svg width="88" height="88" viewBox="0 0 88 88"><circle cx="44" cy="44" r="36" fill="none" stroke="var(--bg-muted)" strokeWidth="5"/><circle cx="44" cy="44" r="36" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="164 226" transform="rotate(-90 44 44)"/></svg>
                        <div style={{ position:'absolute' as const, top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' as const }}>
                          <div style={{ fontSize:22, fontWeight:800, color:'var(--accent)', lineHeight:1 }}>73</div>
                          <div style={{ fontSize:9, color:'var(--text-tertiary)' }}>/100</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--score-mid)', textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:4 }}>Good</div>
                        <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.5 }}>Strong foundation — 3 critical gaps holding you back.</div>
                      </div>
                    </div>
                    {[{label:'First Impression',pct:73},{label:'Impact & Achievements',pct:68},{label:'ATS Compatibility',pct:70},{label:'Red Flags',pct:70},{label:'Career Story',pct:60}].map(d=>(
                      <div key={d.label} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-secondary)', marginBottom:3 }}><span>{d.label}</span><span style={{ color:'var(--accent)', fontWeight:700 }}>{d.pct}%</span></div>
                        <div style={{ height:4, background:'var(--bg-muted)', borderRadius:2 }}><div style={{ height:4, background:'var(--accent)', borderRadius:2, width:`${d.pct}%` }}/></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:'28px 24px', display:'flex', flexDirection:'column' as const, gap:16 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:10 }}>Bullet Rewrite</div>
                      <div style={{ borderRadius:10, border:'1px solid var(--border)', overflow:'hidden', fontSize:12 }}>
                        <div style={{ padding:'10px 14px', background:'rgba(220,38,38,0.04)', borderBottom:'1px solid var(--border)' }}>
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--score-low)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:4 }}>Before</div>
                          <p style={{ margin:0, color:'var(--text-secondary)', lineHeight:1.5 }}>Worked on improving the onboarding experience for new users.</p>
                        </div>
                        <div style={{ padding:'10px 14px', background:'rgba(22,163,74,0.04)' }}>
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--score-high)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:4 }}>After</div>
                          <p style={{ margin:0, color:'var(--text-primary)', fontWeight:500, lineHeight:1.5 }}>Redesigned onboarding for 12k users, cutting drop-off 34% in 3 months.</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:8 }}>ATS Keywords</div>
                      <div style={{ display:'flex', flexWrap:'wrap' as const, gap:5 }}>
                        {['Figma ✓','UX Research ✓','Prototyping ✓'].map(k=><span key={k} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, background:'var(--accent-subtle)', border:'1px solid var(--accent-border)', color:'var(--accent-text)', fontWeight:600 }}>{k}</span>)}
                        {['Design Systems ✗','A/B Testing ✗'].map(k=><span key={k} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', color:'var(--score-low)', fontWeight:600 }}>{k}</span>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:7 }}>Red Flags</div>
                      {[{sev:'high',text:'Bullets lack measurable outcomes'},{sev:'medium',text:'No professional summary section'}].map(f=>(
                        <div key={f.text} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:7, fontSize:12, color:'var(--text-secondary)' }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:f.sev==='high'?'var(--score-low)':'var(--score-mid)', flexShrink:0, marginTop:4 }}/>{f.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </MockupChrome>
            </div>
          </section>

          {/* ── Job Matching ── */}
          <section id="jobs" style={{ background:'var(--bg)', padding:'96px 0 80px', borderTop:'1px solid var(--border)' }}>
            <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 48px', textAlign:'center' as const }} data-reveal data-reveal-delay="80">
              <Eyebrow label="Job Matching"/>
              <h2 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, color:'var(--text-primary)', lineHeight:1.1, letterSpacing:'-1.5px', maxWidth:600, margin:'0 auto 16px' }}>Jobs that actually fit — with a score to prove it.</h2>
              <p style={{ fontSize:17, color:'var(--text-secondary)', lineHeight:1.65, maxWidth:520, margin:'0 auto 32px' }}>CVCheck automatically matches you with relevant roles from Adzuna and Remotive. See a full fit score, strengths, and gaps for every job.</p>
              <AccentBtn onClick={scrollToUpload} style={{ marginBottom:56 }}>See My Matched Jobs ↑</AccentBtn>
              <MockupChrome>
                <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr' }}>
                  <div style={{ borderRight:'1px solid var(--border)' }}>
                    <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', gap:6 }}>
                      {['All (7)','Strong (3)','Good (2)','Partial (2)'].map((f,i)=>(
                        <span key={f} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6, background:i===0?'var(--accent)':'var(--bg-muted)', color:i===0?'#fff':'var(--text-tertiary)', border:i===0?'none':'1px solid var(--border)' }}>{f}</span>
                      ))}
                    </div>
                    {[{init:'FG',title:'Sr. Product Designer',co:'Figma',loc:'Remote EU',sal:'€80k–110k',fit:87},{init:'ZL',title:'UX Design Lead',co:'Zalando',loc:'Berlin, DE',sal:'€70k–90k',fit:74},{init:'MZ',title:'Design Lead',co:'Monzo',loc:'London, UK',sal:'€85k–105k',fit:91}].map((j,i)=>(
                      <div key={j.title} style={{ padding:'16px 18px', borderBottom:'1px solid var(--border)', background:i===0?'var(--accent-subtle)':'transparent', display:'flex', alignItems:'flex-start', gap:12 }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:i===0?'var(--accent)':'var(--bg-muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:i===0?'#fff':'var(--text-tertiary)', flexShrink:0 }}>{j.init}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2 }}>{j.title}</div>
                          <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{j.co} · {j.loc}</div>
                          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{j.sal}</div>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background:j.fit>=80?'rgba(22,163,74,0.1)':'rgba(202,138,4,0.1)', color:j.fit>=80?'var(--score-high)':'var(--score-mid)', flexShrink:0 }}>{j.fit}%</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:'24px 20px' }}>
                    <div style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Sr. Product Designer</div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:10 }}>Figma · Remote EU · €80k–110k</div>
                      <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(22,163,74,0.1)', border:'1px solid rgba(22,163,74,0.3)', borderRadius:6, padding:'3px 9px', fontSize:11, fontWeight:700, color:'var(--score-high)' }}>87% · Strong Match</div>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--score-high)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:7 }}>✓ Strengths</div>
                      {['Strong portfolio & Figma proficiency','User research background matches'].map(s=><div key={s} style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4, display:'flex', gap:6 }}><span style={{ color:'var(--score-high)', flexShrink:0 }}>✓</span>{s}</div>)}
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:7 }}>Gaps</div>
                      {['Design Systems exp. needed','A/B Testing not mentioned'].map(s=><div key={s} style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4, display:'flex', gap:6 }}><span style={{ color:'var(--score-low)', flexShrink:0 }}>✕</span>{s}</div>)}
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:7 }}>Skill Match</div>
                      {[{label:'Figma',pct:92},{label:'Design Systems',pct:38},{label:'User Research',pct:80}].map(s=>(
                        <div key={s.label} style={{ marginBottom:7 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-secondary)', marginBottom:2 }}><span>{s.label}</span><span style={{ color:s.pct<50?'var(--score-low)':'var(--score-high)', fontWeight:600 }}>{s.pct}%</span></div>
                          <div style={{ height:4, background:'var(--bg-muted)', borderRadius:2 }}><div style={{ height:4, borderRadius:2, background:s.pct<50?'var(--score-low)':'var(--accent)', width:`${s.pct}%` }}/></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </MockupChrome>
            </div>
          </section>

          {/* ── Job Alerts ── */}
          <section id="alerts" style={{ background:'var(--text-primary)', padding:'96px 0 80px' }}>
            <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 48px', textAlign:'center' as const }} data-reveal data-reveal-delay="80">
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(22,199,154,0.15)', border:'1px solid rgba(22,199,154,0.3)', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:700, color:'var(--accent)', letterSpacing:'0.03em', textTransform:'uppercase' as const, marginBottom:20 }}>Job Alerts</div>
              <h2 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, color:'#fff', lineHeight:1.1, letterSpacing:'-1.5px', maxWidth:580, margin:'0 auto 16px' }}>New matched jobs in your inbox every Monday.</h2>
              <p style={{ fontSize:17, color:'rgba(255,255,255,0.6)', lineHeight:1.65, maxWidth:480, margin:'0 auto 32px' }}>Subscribe once and get weekly job alerts tailored to your CV — with fit scores so you only open the ones worth your time.</p>
              <button onClick={scrollToUpload} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, padding:'13px 28px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)', marginBottom:56 }}>Enable Job Alerts ↑</button>
              <div style={{ maxWidth:520, margin:'0 auto', background:'var(--bg-elevated)', borderRadius:16, border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 24px 80px rgba(0,0,0,0.3)', overflow:'hidden', textAlign:'left' as const }}>
                <div style={{ padding:'12px 18px', background:'var(--bg-subtle)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ display:'flex', gap:5 }}>{['#EF4444','#F59E0B','#22C55E'].map(c=><div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}</div>
                  <div style={{ flex:1, height:22, background:'var(--bg-muted)', borderRadius:4, maxWidth:240, margin:'0 auto' }}/>
                </div>
                <div style={{ padding:24 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>CVCheck Weekly Digest</div>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>Monday, 09:00 · 3 new matches</div>
                    </div>
                  </div>
                  {[{title:'Sr. Product Designer',co:'Figma',salary:'€80k–110k',fit:87},{title:'UX Design Lead',co:'Zalando',salary:'€70k–90k',fit:74}].map(j=>(
                    <div key={j.title} style={{ background:'var(--bg-subtle)', borderRadius:10, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2 }}>{j.title} — {j.co}</div>
                        <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{j.salary} · Remote</div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:6, background:'var(--accent)', color:'#fff', flexShrink:0 }}>{j.fit}% fit</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:8, marginTop:16 }}>
                    <button style={{ flex:1, padding:'9px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>View All Jobs →</button>
                    <button style={{ padding:'9px 14px', background:'transparent', color:'var(--text-tertiary)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Unsubscribe</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── How it Works ── */}
          <section style={{ background:'var(--bg-subtle)', padding:'96px 0', borderTop:'1px solid var(--border)' }}>
            <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 48px', textAlign:'center' as const }} data-reveal>
              <Eyebrow label="How it works"/>
              <h2 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, color:'var(--text-primary)', lineHeight:1.1, letterSpacing:'-1.5px', maxWidth:560, margin:'0 auto 56px' }}>Done before your coffee gets cold.</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:'var(--border)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
                {[
                  {n:'01',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,title:'Upload Your CV',desc:'Drop a PDF or paste a URL. No account needed to start.'},
                  {n:'02',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>,title:'Get Your Score',desc:'AI scores 7 dimensions and flags every red flag in seconds.'},
                  {n:'03',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,title:'Fix & Rewrite',desc:'Get AI-rewritten bullets, missing keywords, and how-to fixes.'},
                  {n:'04',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>,title:'Apply Smarter',desc:'Match to jobs with a fit score. Get weekly alerts. Land interviews.'},
                ].map(s=>(
                  <div key={s.n} style={{ background:'var(--bg-elevated)', padding:'32px 24px', textAlign:'left' as const }}>
                    <span style={{ fontSize:11, fontWeight:800, color:'var(--accent)', letterSpacing:'0.08em', textTransform:'uppercase' as const, marginBottom:16, display:'block' }}>STEP {s.n}</span>
                    <div style={{ width:44, height:44, borderRadius:10, background:'var(--accent-subtle)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>{s.icon}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:8, letterSpacing:'-0.02em' }}>{s.title}</div>
                    <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Domains ── */}
          <section style={{ background:'var(--bg)', padding:'80px 0', borderTop:'1px solid var(--border)' }}>
            <div style={{ maxWidth:960, margin:'0 auto', padding:'0 48px', textAlign:'center' as const }} data-reveal>
              <h2 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(24px,3vw,36px)', fontWeight:800, color:'var(--text-primary)', letterSpacing:'-1px', marginBottom:12 }}>Works for every domain and level.</h2>
              <p style={{ fontSize:15, color:'var(--text-secondary)', marginBottom:36 }}>CVCheck detects your field and seniority automatically.</p>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8, justifyContent:'center' }}>
                {['Product Design','Engineering','Product Management','Marketing','Data Science','UX Research','Frontend Dev','Backend Dev','DevOps','Sales','Finance','Operations','Content','HR','Consulting','Startup Founder'].map(d=>(
                  <span key={d} style={{ fontSize:13, fontWeight:500, padding:'7px 16px', borderRadius:20, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'var(--text-secondary)', transition:'border-color 0.15s, color 0.15s', cursor:'default' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent-text)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)'}}
                  >{d}</span>
                ))}
              </div>
            </div>
          </section>

          {/* ── Pricing ── */}
          <section id="pricing" style={{ background:'var(--bg-subtle)', padding:'96px 0', borderTop:'1px solid var(--border)' }}>
            <div style={{ maxWidth:960, margin:'0 auto', padding:'0 48px', textAlign:'center' as const }} data-reveal>
              <Eyebrow label="Pricing"/>
              <h2 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, color:'var(--text-primary)', lineHeight:1.1, letterSpacing:'-1.5px', maxWidth:520, margin:'0 auto 12px' }}>No tricks. No "contact us."</h2>
              <p style={{ fontSize:17, color:'var(--text-secondary)', lineHeight:1.65, maxWidth:420, margin:'0 auto 56px' }}>Start free. Pay once for Pro. Subscribe for unlimited.</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:'var(--border)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', textAlign:'left' as const }}>
                {([
                  {key:'free',    label:'Free',    price:'€0',    period:'forever free', badge:null,           features:['Overall score /100 + rating','First impression analysis','Red flag count + severity','ATS verdict','Career trajectory','2 job matches visible','History (with account)'],cta:'Get Started Free',ctaVariant:'outline' as const,ctaFn:scrollToUpload},
                  {key:'pro',     label:'Pro',     price:'€1.99', period:'one-time',     badge:'Most Popular', features:['Everything in Free','AI bullet rewrites on your text','How-to-fix for every red flag','Missing ATS keywords','Career gap analysis','Top 3 actions with how-to + examples'],cta:'Get Pro — €1.99',ctaVariant:'solid' as const,ctaFn:()=>setShowUpgradeModal(true)},
                  {key:'premium', label:'Premium', price:'€5.99', period:'/month',       badge:null,           features:['Everything in Pro','Unlimited analyses','All matched jobs visible','Fit score 0–100 per job','Strengths & gaps per job','Weekly job alert emails'],cta:'Start Premium',ctaVariant:'outline' as const,ctaFn:()=>setShowUpgradeModal(true)},
                ] as const).map(p=>(
                  <div key={p.key} style={{ background:'var(--bg-elevated)', padding:'36px 28px', position:'relative' as const }}>
                    {p.badge&&<><div style={{ position:'absolute', top:-13, left:'50%', transform:'translateX(-50%)', background:'var(--accent)', color:'#fff', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.05em', whiteSpace:'nowrap' as const }}>{p.badge}</div><div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'var(--accent)' }}/></>}
                    <div style={{ fontSize:12, fontWeight:700, color:p.badge?'var(--accent-text)':'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:12 }}>{p.label}</div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
                      <span style={{ fontFamily:'var(--font-sans)', fontSize:44, fontWeight:800, color:'var(--text-primary)', lineHeight:1, letterSpacing:'-2px' }}>{p.price}</span>
                      <span style={{ fontSize:14, color:'var(--text-tertiary)' }}>{p.period}</span>
                    </div>
                    <ul style={{ listStyle:'none', margin:'24px 0 32px', padding:0, display:'flex', flexDirection:'column' as const, gap:10 }}>
                      {p.features.map(f=><li key={f} style={{ display:'flex', alignItems:'flex-start', gap:9, fontSize:13.5, color:'var(--text-secondary)' }}><svg width="13" height="13" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:2 }}><polyline points="20 6 9 17 4 12"/></svg>{f}</li>)}
                    </ul>
                    <button onClick={p.ctaFn} style={{ width:'100%', padding:'13px', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)', background:p.ctaVariant==='solid'?'var(--accent)':'transparent', color:p.ctaVariant==='solid'?'#fff':'var(--accent)', border:p.ctaVariant==='solid'?'none':'1.5px solid var(--accent)', transition:'background 0.15s, transform 0.15s, box-shadow 0.15s' }}
                      onMouseEnter={e=>{ if(p.ctaVariant==='solid'){const b=e.currentTarget;b.style.background='var(--accent-hover)';b.style.transform='translateY(-1px)';b.style.boxShadow='0 4px 16px rgba(22,199,154,0.28)'}else{e.currentTarget.style.background='var(--accent-subtle)'} }}
                      onMouseLeave={e=>{ const b=e.currentTarget; b.style.background=p.ctaVariant==='solid'?'var(--accent)':'transparent'; b.style.transform='none'; b.style.boxShadow='none' }}
                    >{tier===p.key?'Current plan':p.cta}</button>
                  </div>
                ))}
              </div>
              <p style={{ marginTop:24, fontSize:12, color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure checkout via Stripe · No subscription on Pro · 1 scan always free
              </p>
            </div>
          </section>

          {/* ── Testimonial ── */}
          <section style={{ background:'var(--bg)', padding:'96px 0', textAlign:'center' as const, borderTop:'1px solid var(--border)' }}>
            <div style={{ maxWidth:680, margin:'0 auto', padding:'0 48px' }} data-reveal>
              <h2 style={{ fontFamily:'var(--font-sans)', fontSize:'clamp(24px,3vw,36px)', fontWeight:800, color:'var(--text-primary)', letterSpacing:'-1px', marginBottom:40 }}>The most honest feedback your CV will ever get.</h2>
              <div style={{ background:'var(--bg-elevated)', borderRadius:16, border:'1px solid var(--border)', padding:'40px 44px', boxShadow:'var(--shadow-lg)' }}>
                <div style={{ display:'flex', justifyContent:'center', gap:4, marginBottom:14 }}>
                  {[...Array(5)].map((_,i)=><svg key={i} width="20" height="20" fill="var(--accent)" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
                </div>
                <p style={{ fontSize:13, color:'var(--text-tertiary)', marginBottom:20 }}>Rated <strong style={{ color:'var(--text-secondary)' }}>4.9</strong> by early users</p>
                <blockquote style={{ fontSize:'clamp(17px,2vw,20px)', fontWeight:700, color:'var(--text-primary)', lineHeight:1.5, marginBottom:20, letterSpacing:'-0.5px' }}>
                  "I had no idea my CV was this weak until CVCheck told me exactly why. Got two interview calls the week after fixing the red flags."
                </blockquote>
                <p style={{ fontSize:13, color:'var(--text-tertiary)' }}>— Mihai D., Product Manager, Bucharest</p>
              </div>
            </div>
          </section>

        </>)}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background:'var(--text-primary)', padding:'60px 48px 36px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr', gap:40, marginBottom:48 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:16, fontWeight:700, color:'#fff', marginBottom:14 }}>
                <TealLogo/>CVCheck
              </div>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', lineHeight:1.65 }}>AI-powered CV analysis and job matching. Get your score, fix your red flags, land more interviews.</p>
            </div>
            {[
              {title:'Product', links:['CV Analysis','Job Matching','Job Alerts','Pricing']},
              {title:'Company', links:['About','Blog','Privacy Policy','Terms of Service']},
              {title:'Support', links:['Help Center','Contact']},
            ].map(col=>(
              <div key={col.title}>
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:14, textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>{col.title}</div>
                <ul style={{ listStyle:'none', display:'flex', flexDirection:'column' as const, gap:10 }}>
                  {col.links.map(l=><li key={l}><Link href="/" style={{ fontSize:13, color:'rgba(255,255,255,0.4)', textDecoration:'none', transition:'color 0.15s' }} onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.color='rgba(255,255,255,0.8)'} onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.color='rgba(255,255,255,0.4)'}>{l}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:24, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,0.3)' }}>
            <span>© 2026 CVCheck · cvcheck.app</span>
            <div style={{ display:'flex', gap:20 }}>
              <Link href="/privacy" style={{ color:'rgba(255,255,255,0.3)', textDecoration:'none' }}>Privacy</Link>
              <Link href="/terms"   style={{ color:'rgba(255,255,255,0.3)', textDecoration:'none' }}>Terms</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
