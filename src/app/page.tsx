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

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.revealHidden')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.remove('revealHidden')
          e.target.classList.add('revealVisible')
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
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
    <div className={styles.scoreRing} style={{ width: 136, height: 136 }}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="5"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5" opacity="0.08" strokeDasharray={`${circ} 0`} transform="rotate(-90 68 68)"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 68 68)" style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1)' }}/>
      </svg>
      <div className={styles.scoreRingInner}>
        <span className={styles.scoreNumber} style={{ color }}>{displayScore}</span>
        <span className={styles.scoreMax}>/100</span>
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

function DimensionBar({ label, score, max, desc, locked, onUnlock }: { label:string; score:number; max:number; desc:string; locked?:boolean; onUnlock?:()=>void }) {
  const pct = (score / max) * 100
  const color = pct >= 66 ? 'var(--score-high)' : pct >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  return (
    <div className={`${styles.dimBar} ${locked ? styles.dimBarLocked : ''}`} onClick={locked ? onUnlock : undefined}>
      <div className={styles.dimBarHeader}>
        <div>
          <span className={styles.dimLabel} style={{ textShadow: locked ? '0 0 8px var(--text-secondary)' : 'none', userSelect: locked ? 'none' : 'auto' }}>{label}</span>
          <span className={styles.dimDesc}>{desc}</span>
        </div>
        {locked
          ? <span className={styles.lockIcon}><LockIcon/></span>
          : <span className={styles.dimScore} style={{ color }}>{score}<span className={styles.dimMax}>/{max}</span></span>
        }
      </div>
      <div className={styles.barTrack}>
        {locked
          ? <div className={styles.barFillLocked} style={{ width: '60%' }}/>
          : <div className={styles.barFill} data-bar-pct={pct} style={{ background: color }}/>
        }
      </div>
    </div>
  )
}

function RedFlagCard({ flag, howToFixLocked, onUnlock }: { flag:{flag:string;severity:RedFlagSeverity;how_to_fix:string}; howToFixLocked:boolean; onUnlock:()=>void }) {
  const color = RED_FLAG_COLORS[flag.severity]
  const label = RED_FLAG_LABELS[flag.severity]
  return (
    <div style={{ padding:'12px 16px', borderRadius:6, background:`${color}05`, border:`0.5px solid ${color}25`, display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', padding:'2px 7px', borderRadius:2, color, background:`${color}12`, border:`0.5px solid ${color}30`, flexShrink:0, marginTop:1 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.4 }}>{flag.flag}</span>
      </div>
      {howToFixLocked ? (
        <div onClick={onUnlock} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', paddingLeft:2 }}>
          <span style={{ fontSize:12, color:'var(--text-secondary)', filter:'blur(4px)', userSelect:'none', flex:1, pointerEvents:'none' }}>Add a one-line note explaining the gap.</span>
          <span style={{ color:'var(--text-tertiary)', flexShrink:0 }}><LockIcon size={10}/></span>
        </div>
      ) : flag.how_to_fix ? (
        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, lineHeight:1.55, paddingLeft:2 }}>
          <span style={{ fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase', fontSize:9, letterSpacing:'0.08em' }}>Fix · </span>{flag.how_to_fix}
        </p>
      ) : null}
    </div>
  )
}

function BulletRewriteCard({ rewrite }: { rewrite: BulletRewrite }) {
  return (
    <div style={{ borderRadius:6, border:'0.5px solid var(--border)', overflow:'hidden', fontSize:12.5 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
        <div style={{ padding:'10px 14px', background:'rgba(220,38,38,0.04)', borderRight:'0.5px solid var(--border)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--score-low)', marginBottom:5 }}>Before</div>
          <p style={{ margin:0, color:'var(--text-secondary)', lineHeight:1.55 }}>{rewrite.original}</p>
        </div>
        <div style={{ padding:'10px 14px', background:'rgba(22,163,74,0.04)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--score-high)', marginBottom:5 }}>After</div>
          <p style={{ margin:0, color:'var(--text-primary)', fontWeight:500, lineHeight:1.55 }}>{rewrite.rewritten}</p>
        </div>
      </div>
      <div style={{ padding:'8px 14px', background:'var(--bg-subtle)', borderTop:'0.5px solid var(--border)' }}>
        <p style={{ margin:0, fontSize:11.5, color:'var(--text-tertiary)', lineHeight:1.5 }}><span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Why: </span>{rewrite.why}</p>
      </div>
    </div>
  )
}

function ActionCard({ action, index, detailsLocked, onUnlock }: { action:PriorityAction; index:number; detailsLocked:boolean; onUnlock:()=>void }) {
  return (
    <div className={styles.priorityCard}>
      <div className={styles.priorityCardHeader}>
        <span style={{ fontFamily:'var(--font-mono)' }}>{String(index+1).padStart(2,'0')}</span>
        <span>{action.action}</span>
      </div>
      <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, lineHeight:1.6 }}>{action.why_it_matters}</p>
      {detailsLocked ? (
        <div onClick={onUnlock} style={{ padding:'8px 12px', borderRadius:5, border:'0.5px dashed var(--border)', background:'var(--bg-subtle)', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-tertiary)' }}>
          <LockIcon size={10}/> Unlock steps + example — Pro
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6, paddingLeft:20 }}>
          {action.how && <p style={{ margin:0, fontSize:12.5, color:'var(--text-primary)', lineHeight:1.6, borderLeft:'2px solid var(--accent-border)', paddingLeft:10 }}>{action.how}</p>}
          {action.example && <p style={{ margin:0, fontSize:12, color:'var(--text-tertiary)', lineHeight:1.55, fontStyle:'italic' }}>{action.example}</p>}
        </div>
      )}
    </div>
  )
}

function LockedPreview({ count, label, sublabel, onUnlock }: { count?:number|string; label:string; sublabel:string; onUnlock:()=>void }) {
  return (
    <div onClick={onUnlock} style={{ padding:'14px 18px', borderRadius:6, border:'0.5px solid var(--border)', background:'var(--bg-subtle)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {count !== undefined && <span style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-1px', lineHeight:1 }}>{count}</span>}
        <div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{label}</div>
          <div style={{ fontSize:11.5, color:'var(--text-tertiary)' }}>{sublabel}</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, fontSize:11.5, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', borderRadius:4, padding:'4px 10px', whiteSpace:'nowrap' }}>
        Unlock — €1.99 <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  )
}

const FIT_COLORS: Record<string,string> = { strong:'var(--score-high)', good:'#65A30D', partial:'var(--score-mid)', stretch:'var(--score-low)' }

function FitBadge({ label, score }: { label:string; score:number }) {
  const color = FIT_COLORS[label] ?? 'var(--text-secondary)'
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color, background:`${color}15`, border:`0.5px solid ${color}40`, borderRadius:3, padding:'2px 8px' }}>{score}% · {label}</span>
}

function JobCard({ job, fitLocked, onUnlock, token, initialStatus, onSaveChange }: { job:JobMatchType; fitLocked:boolean; onUnlock:()=>void; token:string|null; initialStatus?:'none'|'saved'|'applied'; onSaveChange?:(id:string,status:'none'|'saved'|'applied')=>void }) {
  const { listing, fit } = job
  const [saved, setSaved] = useState<'none'|'saved'|'applied'>(initialStatus ?? 'none')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const salary = listing.salary_min && listing.salary_min >= 1000 ? `${Math.round(listing.salary_min/1000)}k${listing.salary_max?`-${Math.round(listing.salary_max/1000)}k`:'+'}`  : null

  useEffect(() => {
    if (token) return
    try {
      const raw = localStorage.getItem(`job-${listing.id}`)
      if (!raw) return
      let status: string|null = null
      try { const p = JSON.parse(raw); if (p?.expiresAt && Date.now()>p.expiresAt) { localStorage.removeItem(`job-${listing.id}`); return }; status=p?.status??null } catch { status=raw }
      if (status==='saved'||status==='applied') setSaved(status as 'saved'|'applied')
    } catch {}
  }, [listing.id, token])

  async function handleSave(status:'saved'|'applied') {
    const isToggleOff = saved===status
    const next:'none'|'saved'|'applied' = isToggleOff?'none':status
    setSaved(next); onSaveChange?.(listing.id, next)
    if (!token) {
      try { next==='none'?localStorage.removeItem(`job-${listing.id}`):localStorage.setItem(`job-${listing.id}`,JSON.stringify({status:next,expiresAt:Date.now()+7*24*60*60*1000})) } catch {}
      return
    }
    setSaving(true)
    try {
      const action = isToggleOff?(status==='applied'?'unapply':'unsave'):(status==='applied'?'apply':'save')
      await fetch('/api/jobs/save',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,listing})})
    } catch { setSaved(saved) } finally { setSaving(false) }
  }

  return (
    <div style={{ border:`0.5px solid ${fit?.fit_label==='strong'?'rgba(22,163,74,0.3)':'var(--border)'}`, borderRadius:8, padding:'18px 20px', background:'var(--bg-elevated)', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3 }}>{listing.title}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <span>{listing.company}</span>
            {listing.location&&<><span style={{ color:'var(--border-strong)' }}>·</span><span>{listing.location}</span></>}
            {salary&&<><span style={{ color:'var(--border-strong)' }}>·</span><span style={{ color:'var(--text-primary)', fontWeight:600 }}>{salary}</span></>}
          </div>
        </div>
        {fit&&<FitBadge label={fit.fit_label} score={fit.fit_score}/>}
      </div>
      <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6, margin:0, display:'-webkit-box', WebkitLineClamp:expanded?undefined:3, WebkitBoxOrient:'vertical', overflow:expanded?'visible':'hidden' }}>{listing.description}</p>
      {listing.description.length>200&&<button onClick={()=>setExpanded(e=>!e)} style={{ alignSelf:'flex-start', fontSize:11, color:'var(--text-tertiary)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font-sans)' }}>{expanded?'Show less':'Show more'}</button>}
      {fit&&fit.strengths&&fit.strengths.length>0&&(
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--score-high)' }}>Why you are a good fit</div>
          {fit.strengths.map((s,i)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}><span style={{ color:'var(--score-high)', flexShrink:0 }}>check</span>{s}</div>)}
        </div>
      )}
      {fit&&fit.gaps&&fit.gaps.length>0&&(
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-tertiary)' }}>What you are missing</div>
          {fit.gaps.map((gap,i)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}><span style={{ color:'var(--score-low)', flexShrink:0 }}>x</span>{gap}</div>)}
        </div>
      )}
      {fitLocked&&fit&&(
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10 }}>
          <button onClick={onUnlock} style={{ fontSize:12, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', borderRadius:4, padding:'5px 12px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Unlock skill gaps and full analysis</button>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
        <a href={listing.redirect_url} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-muted)', border:'0.5px solid var(--border-strong)', borderRadius:4, padding:'6px 12px', textDecoration:'none' }}>View job</a>
        <button onClick={()=>!saving&&handleSave('saved')} style={{ fontSize:13, padding:'5px 10px', borderRadius:4, border:`0.5px solid ${saved==='saved'?'var(--accent)':'var(--border)'}`, background:saved==='saved'?'var(--accent-subtle)':'var(--bg-muted)', color:saved==='saved'?'var(--accent)':'var(--text-tertiary)', cursor:saving?'wait':'pointer', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>{saved==='saved'?'saved':'save'}</button>
        <button onClick={()=>!saving&&handleSave('applied')} style={{ fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:4, border:`0.5px solid ${saved==='applied'?'var(--score-high)':'var(--border)'}`, background:saved==='applied'?'rgba(22,163,74,0.08)':'var(--bg-muted)', color:saved==='applied'?'var(--score-high)':'var(--text-tertiary)', cursor:saving?'wait':'pointer', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>{saved==='applied'?'Applied':'Applied?'}</button>
      </div>
    </div>
  )
}

const ADZUNA_UI_SUPPORTED = new Set(['gb','us','ca','au','de','nl','sg','at','be','br','in','nz','pl','za','fr','it','es','ru','mx','ar'])
type FilterType = 'all'|'strong'|'good'|'partial'|'stretch'

function JobMatchesSection({ result, token, isPremium, onUnlock }: { result:GatedAnalysisResult; token:string|null; isPremium:boolean; onUnlock:()=>void }) {
  const CACHE_KEY       = `jobs-cache-${result.analysis_id}`
  const SAVED_KEY       = `jobs-saved-${result.analysis_id}`
  const [jobs,        setJobs]        = useState<JobMatchType[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError,   setJobsError]   = useState('')
  const [fitLocked,   setFitLocked]   = useState(true)
  const [filter,      setFilter]      = useState<FilterType>('all')
  const [savedStatuses, setSavedStatuses] = useState<Record<string,'none'|'saved'|'applied'>>({})
  const [queryUsed,   setQueryUsed]   = useState('')
  const [alertStatus, setAlertStatus] = useState<'idle'|'loading'|'subscribed'|'error'>('idle')

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SAVED_KEY)
      if (raw) setSavedStatuses(JSON.parse(raw))
    } catch {}
  }, [SAVED_KEY])

  useEffect(() => {
    async function fetchJobs() {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY)
        if (raw) {
          const { data, cachedAt } = JSON.parse(raw)
          if (Date.now() - cachedAt < 24*60*60*1000) {
            setJobs(data.jobs); setFitLocked(data.fit_locked); setQueryUsed(data.query_used??''); return
          }
        }
      } catch {}
      setJobsLoading(true)
      try {
        const headers: Record<string,string> = { 'Content-Type':'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/jobs', { method:'POST', headers, body:JSON.stringify({ detected_domain:result.detected_domain, detected_level:result.detected_level, trajectory:result.career_story?.trajectory_detected??'', keywords:(result.ats?.missing_keywords??[]).slice(0,8) }) })
        if (!res.ok) throw new Error()
        const data: JobsResponse = await res.json()
        setJobs(data.jobs); setFitLocked(data.fit_locked); setQueryUsed(data.query_used??'')
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt:Date.now() })) } catch {}
      } catch { setJobsError('Could not load job matches.') } finally { setJobsLoading(false) }
    }
    fetchJobs()
  }, [result.analysis_id])

  async function handleAlertSubscribe() {
    if (!token) return
    setAlertStatus('loading')
    try {
      const res = await fetch('/api/jobs/alert', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({ action:'subscribe', cvMeta:{ detected_domain:result.detected_domain, detected_level:result.detected_level, trajectory:result.career_story?.trajectory_detected, keywords:result.ats?.missing_keywords??[] } }) })
      if (!res.ok) throw new Error()
      setAlertStatus('subscribed')
    } catch { setAlertStatus('error') }
  }

  const handleSaveChange = (id:string, status:'none'|'saved'|'applied') => {
    setSavedStatuses(prev => {
      const next = { ...prev, [id]: status }
      try { sessionStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const filtered = filter==='all' ? jobs : jobs.filter(j=>j.fit?.fit_label===filter)
  const FREE_VISIBLE = 2

  if (jobsLoading) return (
    <div style={{ padding:'32px 24px', textAlign:'center' }}>
      <div style={{ width:24, height:24, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }}/>
      <p style={{ fontSize:13, color:'var(--text-secondary)' }}>Finding matched jobs...</p>
    </div>
  )
  if (jobsError) return <p style={{ fontSize:13, color:'var(--text-tertiary)', padding:'16px 0' }}>{jobsError}</p>
  if (!jobs.length) return <p style={{ fontSize:13, color:'var(--text-tertiary)', padding:'16px 0' }}>No job matches found for your profile.</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {(['all','strong','good','partial','stretch'] as FilterType[]).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:4, border:`0.5px solid ${filter===f?'var(--border-strong)':'var(--border)'}`, background:filter===f?'var(--bg-muted)':'transparent', color:filter===f?'var(--text-primary)':'var(--text-tertiary)', cursor:'pointer', fontFamily:'var(--font-sans)', textTransform:'capitalize' }}>{f}</button>
          ))}
        </div>
        {queryUsed&&<span style={{ fontSize:11, color:'var(--text-tertiary)' }}>Query: {queryUsed}</span>}
      </div>

      {filtered.map((job, idx) => {
        const isLocked = !isPremium && idx >= FREE_VISIBLE
        if (isLocked) return (
          <div key={job.listing.id} onClick={onUnlock} style={{ border:'0.5px solid var(--border)', borderRadius:8, padding:'14px 18px', background:'var(--bg-elevated)', cursor:'pointer', opacity:0.5, filter:'blur(1px)', userSelect:'none' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{job.listing.title}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>{job.listing.company} · {job.listing.location}</div>
          </div>
        )
        return <JobCard key={job.listing.id} job={job} fitLocked={fitLocked} onUnlock={onUnlock} token={token} initialStatus={savedStatuses[job.listing.id]??'none'} onSaveChange={handleSaveChange}/>
      })}

      {!isPremium&&jobs.length>FREE_VISIBLE&&(
        <div onClick={onUnlock} style={{ padding:'18px', borderRadius:8, border:'0.5px dashed var(--border)', textAlign:'center', cursor:'pointer', background:'var(--bg-subtle)' }}>
          <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 8px' }}>{jobs.length - FREE_VISIBLE} more matches locked</p>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--accent)' }}>Unlock Premium to see all</span>
        </div>
      )}

      {token&&alertStatus!=='subscribed'&&(
        <div style={{ padding:'16px 18px', borderRadius:8, border:'0.5px solid var(--border)', background:'var(--bg-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>Get weekly job alerts</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)' }}>New matches for your profile, every Monday.</div>
          </div>
          <button onClick={handleAlertSubscribe} disabled={alertStatus==='loading'} style={{ fontSize:12, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', borderRadius:4, padding:'7px 14px', cursor:'pointer', fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>
            {alertStatus==='loading'?'Subscribing...':alertStatus==='error'?'Try again':'Subscribe free'}
          </button>
        </div>
      )}
      {alertStatus==='subscribed'&&<p style={{ fontSize:12, color:'var(--score-high)', textAlign:'center' }}>You are subscribed to weekly job alerts.</p>}
    </div>
  )
}

function ResultContent({ result, isPro, user, token, setShowUpgradeModal, setShowPlansModal, setShowAuthModal }: { result:GatedAnalysisResult; isPro:boolean; user:any; token:string|null; setShowUpgradeModal:(v:boolean)=>void; setShowPlansModal:(v:boolean)=>void; setShowAuthModal:(v:boolean)=>void }) {
  const barsRef = useAnimatedBars()
  const unlock  = () => setShowUpgradeModal(true)
  const ratingColor = RATING_COLORS[result.rating]

  return (
    <div className={styles.results} ref={barsRef}>
      <div className={styles.scoreHero}>
        <ScoreRing score={result.total_score}/>
        <div className={styles.scoreHeroMeta}>
          <span className={styles.ratingBadge} style={{ color:ratingColor, background:`${ratingColor}12`, borderColor:`${ratingColor}30` }}>{RATING_LABELS[result.rating]}</span>
          <p className={styles.scoreSummary}>{result.summary}</p>
          <p className={styles.sourceLabel}>{result.detected_domain} · {LEVEL_LABELS[result.detected_level]}</p>
        </div>
      </div>

      <div className={styles.section} style={{ animationDelay:'0.15s' }}>
        <div className={styles.sectionTitleRow}>
          <span className={styles.sectionTitle}>7 Dimensions</span>
        </div>
        <div className={styles.categoryBars}>
          {SCORE_DIMENSIONS.map(d => (
            <DimensionBar key={d.key} label={d.label} score={result.scores[d.key]} max={d.max} desc={d.desc} locked={false}/>
          ))}
        </div>
      </div>

      {result.first_impression&&(
        <div className={styles.section} style={{ animationDelay:'0.2s' }}>
          <div className={styles.sectionTitle}>First Impression</div>
          <div style={{ padding:'16px 20px', background:'var(--bg-elevated)', borderRadius:8, border:'0.5px solid var(--border)', display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:13, color:'var(--text-primary)', fontWeight:500 }}>{result.first_impression.what_recruiter_sees}</div>
            {result.first_impression.current_title&&result.first_impression.recommended_title&&result.first_impression.current_title!==result.first_impression.recommended_title&&(
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:12 }}>
                <span style={{ padding:'3px 10px', background:'rgba(220,38,38,0.06)', border:'0.5px solid rgba(220,38,38,0.2)', borderRadius:4, color:'var(--score-low)' }}>Current: {result.first_impression.current_title}</span>
                <span style={{ padding:'3px 10px', background:'rgba(22,163,74,0.06)', border:'0.5px solid rgba(22,163,74,0.2)', borderRadius:4, color:'var(--score-high)' }}>Suggested: {result.first_impression.recommended_title}</span>
              </div>
            )}
            <div style={{ fontSize:12, color:result.first_impression.passes_7_second_test?'var(--score-high)':'var(--score-low)', display:'flex', alignItems:'center', gap:5 }}>
              {result.first_impression.passes_7_second_test?'Passes the 7-second test':'Fails the 7-second test'}
            </div>
          </div>
        </div>
      )}

      {result.impact&&(
        <div className={styles.section} style={{ animationDelay:'0.25s' }}>
          <div className={styles.sectionTitleRow}>
            <span className={styles.sectionTitle}>Impact and Achievements</span>
            {result.rewrites_locked&&<button className={styles.unlockBtn} onClick={unlock}><LockIcon size={9}/>Unlock rewrites</button>}
          </div>
          <div style={{ display:'flex', gap:12, fontSize:12, flexWrap:'wrap' }}>
            <span style={{ padding:'5px 12px', borderRadius:4, background:'rgba(22,163,74,0.08)', border:'0.5px solid rgba(22,163,74,0.2)', color:'var(--score-high)', fontWeight:600 }}>{result.impact.bullets_with_metrics} bullets with metrics</span>
            <span style={{ padding:'5px 12px', borderRadius:4, background:'rgba(220,38,38,0.06)', border:'0.5px solid rgba(220,38,38,0.2)', color:'var(--score-low)', fontWeight:600 }}>{result.impact.bullets_without_metrics} without</span>
          </div>
          {result.rewrites_locked
            ? <LockedPreview count={result.impact.top_weak_bullets?.length??0} label="Bullet rewrites with your actual text" sublabel="See Pro - AI rewrites your exact bullets" onUnlock={unlock}/>
            : result.impact.rewrites?.map((rw,i)=><BulletRewriteCard key={i} rewrite={rw}/>)
          }
        </div>
      )}

      {result.ats&&(
        <div className={styles.section} style={{ animationDelay:'0.3s' }}>
          <div className={styles.sectionTitleRow}>
            <span className={styles.sectionTitle}>ATS Compatibility</span>
            <span style={{ fontSize:11, fontWeight:700, color:ATS_VERDICT_COLORS[result.ats.verdict] }}>{ATS_VERDICT_LABELS[result.ats.verdict]}</span>
          </div>
          {result.keywords_locked
            ? <LockedPreview label="Missing ATS keywords for your domain" sublabel="See exact keywords recruiters and parsers scan for" onUnlock={unlock}/>
            : result.ats.missing_keywords?.length>0&&(
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {result.ats.missing_keywords.map(k=><span key={k} style={{ fontSize:11.5, padding:'4px 10px', borderRadius:4, background:'rgba(220,38,38,0.06)', border:'0.5px solid rgba(220,38,38,0.2)', color:'var(--score-low)', fontWeight:500 }}>{k}</span>)}
              </div>
            )
          }
        </div>
      )}

      {result.red_flags?.length>0&&(
        <div className={styles.section} style={{ animationDelay:'0.35s' }}>
          <div className={styles.sectionTitle}>Red Flags ({result.red_flags.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {result.red_flags.map((flag,i)=><RedFlagCard key={i} flag={flag} howToFixLocked={result.how_to_fix_locked} onUnlock={unlock}/>)}
          </div>
        </div>
      )}

      <div className={styles.section} style={{ animationDelay:'0.4s' }}>
        <div className={styles.sectionTitleRow}>
          <span className={styles.sectionTitle}>Top 3 Actions</span>
          {result.actions_locked&&<button className={styles.unlockBtn} onClick={unlock}><LockIcon size={9}/>Unlock how-to + examples</button>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {result.top_3_actions.map((action,i)=><ActionCard key={i} action={action} index={i} detailsLocked={result.actions_locked} onUnlock={unlock}/>)}
        </div>
      </div>

      {!isPro&&(
        <div className={styles.upgradeBanner}>
          <div className={styles.upgradeBannerContent}>
            <p className={styles.upgradeBannerTitle}>You are missing the part that actually helps.</p>
            <p className={styles.upgradeBannerSub}>Pro shows your bullet rewrites, how to fix every red flag, ATS keywords, and 3 priority actions. 1.99 euro, once.</p>
          </div>
          <div className={styles.upgradeBannerActions}>
            <button className={styles.upgradeBannerPro} onClick={()=>setShowUpgradeModal(true)}>Unlock Pro - 1.99 euro</button>
            <button className={styles.upgradeBannerPremium} onClick={()=>setShowPlansModal(true)}>See all plans</button>
          </div>
        </div>
      )}

      <div className={styles.section} style={{ animationDelay:'0.45s' }}>
        <div className={styles.sectionTitle}>Matched Jobs</div>
        <JobMatchesSection result={result} token={token} isPremium={result.tier==='premium'||result.tier==='pro'} onUnlock={()=>setShowPlansModal(true)}/>
      </div>

      {!user&&<div style={{ textAlign:'center', padding:16, fontSize:12, color:'var(--text-tertiary)' }}><button onClick={()=>setShowAuthModal(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline', padding:0 }}>Sign in</button> to save this to your history - free for all accounts.</div>}
    </div>
  )
}

const PLAN_DEFS = {
  free:    { label:'Free',    price:'0',    period:'',         features:['Overall score /100 + rating','First impression (7-second test)','Impact stats - bullets with/without metrics','Red flag count + severity','ATS verdict','Career trajectory + format verdict','History saved (requires account)'] },
  pro:     { label:'Pro',     price:'1.99', period:'one-time', features:['Everything in Free','Bullet rewrites on your actual text','How to fix every red flag','Missing ATS keywords for your domain','Career gaps and seniority analysis','Top 3 priority actions with how-to + examples'] },
  premium: { label:'Premium', price:'5.99', period:'/month',   features:['Everything in Pro','Unlimited analyses','Job matching - live listings matched to your profile'] },
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px 16px' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:14, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 32px 100px rgba(0,0,0,0.28)' }}>
        <div style={{ padding:'24px 26px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:'0 0 4px', letterSpacing:'-0.04em' }}>Plans</h2>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>See your score free. Pay 1.99 once to fix it.</p>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-subtle)', border:'0.5px solid var(--border)', borderRadius:6, color:'var(--text-tertiary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
          {(['free','pro','premium'] as const).map(pk=>{
            const p=PLAN_DEFS[pk]; const isCurrent=tier===pk
            return (
              <div key={pk} style={{ border:pk==='pro'?'1.5px solid var(--border-strong)':'0.5px solid var(--border)', borderRadius:10, background:pk==='pro'?'var(--bg-subtle)':'var(--bg)', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:pk==='pro'?'var(--text-primary)':pk==='premium'?'var(--score-high)':'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{p.label}</span>
                    {pk==='pro'&&<span style={{ fontSize:8, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', background:'var(--accent)', color:'#fff', padding:'2px 7px', borderRadius:20 }}>Popular</span>}
                    {isCurrent&&<span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', color:'var(--text-tertiary)', border:'0.5px solid var(--border)', padding:'2px 7px', borderRadius:20 }}>Current</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                    <span style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', lineHeight:1 }}>{p.price}</span>
                    {p.period&&<span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{p.period}</span>}
                  </div>
                </div>
                <div style={{ padding:'12px 18px 14px', borderTop:'0.5px solid var(--border)' }}>
                  <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:6 }}>
                    {p.features.map(f=><li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.45 }}><svg width="12" height="12" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>{f}</li>)}
                  </ul>
                  {!isCurrent&&pk!=='free'&&<button onClick={()=>handleBuy(pk)} disabled={!!buying} style={{ width:'100%', marginTop:12, padding:10, fontSize:13, fontWeight:600, color:'#fff', background:'var(--accent)', border:'none', borderRadius:6, cursor:buying?'not-allowed':'pointer', fontFamily:'var(--font-sans)' }}>{buying===pk?'Loading...':pk==='pro'?'Get Pro - 1.99 euro':'Get Premium - 5.99 euro per month'}</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TIER_META:Record<string,{label:string;color:string}> = { free:{label:'Free',color:'var(--text-tertiary)'}, pro:{label:'Pro',color:'var(--text-primary)'}, premium:{label:'Premium',color:'var(--score-high)'} }

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
  const ddItem:React.CSSProperties = { display:'flex', alignItems:'center', gap:9, width:'100%', padding:'9px 16px', background:'transparent', border:'none', color:'var(--text-secondary)', fontSize:12.5, cursor:'pointer', textAlign:'left', fontFamily:'var(--font-sans)' }
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px 4px 5px', background:open?'var(--bg-subtle)':'transparent', border:'0.5px solid var(--border)', borderRadius:40, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
        <span style={{ width:25, height:25, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{initials}</span>
        <span style={{ maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12.5, fontWeight:500, color:'var(--text-secondary)' }}>{user.email?.split('@')[0]}</span>
        <svg width="10" height="10" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&(
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:220, background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:7, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.14)', zIndex:1000, animation:'dropIn 0.18s cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ padding:'13px 16px', borderBottom:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
            <div style={{ fontSize:10.5, color:meta.color, fontWeight:600, marginTop:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{meta.label} plan</div>
          </div>
          <div style={{ padding:'4px 0' }}>
            <button className="dd-row" onClick={()=>{onOpenAccount();setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>My account</button>
            <button className="dd-row" onClick={()=>{router.push('/history');setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>History</button>
            <button className="dd-row" onClick={()=>{router.push('/history?tab=saved');setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Saved jobs</button>
            <button className="dd-row" onClick={()=>{onOpenPlans();setOpen(false)}} style={ddItem}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Plans</button>
          </div>
          <div style={{ borderTop:'0.5px solid var(--border)', padding:'4px 0' }}>
            <button className="dd-danger" onClick={()=>{onSignOut();setOpen(false)}} style={{...ddItem,color:'#ef4444'}}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}

const LOADING_STEPS = ['Reading your CV...','Running the 7-second test...','Checking ATS compatibility...','Writing your rewrites and actions...']

export default function Home() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const { tier } = useTier(user?.id)
  const router = useRouter()

  function handleSignOut() {
    try { const keys:string[]=[]; for (let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k&&(k.startsWith('jobs-cache-')||k.startsWith('jobs-saved-')))keys.push(k)}; keys.forEach(k=>sessionStorage.removeItem(k)) } catch {}
    signOut()
  }

  const [showAuthModal,    setShowAuthModal]    = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showPlansModal,   setShowPlansModal]   = useState(false)
  const [mode,        setMode]        = useState<InputMode>('url')
  const [url,         setUrl]         = useState('')
  const [file,        setFile]        = useState<File|null>(null)
  const [isDragging,  setIsDragging]  = useState(false)
  const [appState,    setAppState]    = useState<AppState>('idle')
  const [result,      setResult]      = useState<GatedAnalysisResult|null>(null)
  const [error,       setError]       = useState('')
  const [copied,        setCopied]        = useState(false)
  const [shareLoading,  setShareLoading]  = useState(false)
  const [shareUrl,      setShareUrl]      = useState<string|null>(null)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [loadingStep,   setLoadingStep]   = useState(0)
  const [pendingSave,   setPendingSave]   = useState<GatedAnalysisResult|null>(null)
  const [savedToHistory, setSavedToHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useScrollReveal()

  useEffect(() => {
    if (appState!=='loading'){setLoadingStep(0);return}
    const timers=LOADING_STEPS.slice(0,-1).map((_,i)=>setTimeout(()=>setLoadingStep(i+1),(i+1)*5000))
    return ()=>timers.forEach(clearTimeout)
  }, [appState])

  useEffect(() => {
    if (!user||!session||!pendingSave||savedToHistory) return
    const supabase=createSupabaseBrowser()
    supabase.from('roasts').insert({ id:pendingSave.analysis_id, user_id:user.id, source:pendingSave.source??null, total_score:pendingSave.total_score, rating:pendingSave.rating, summary:pendingSave.summary, scores:pendingSave.scores, first_impression:pendingSave.first_impression, impact:pendingSave.impact, ats:pendingSave.ats, red_flags:pendingSave.red_flags, career_story:pendingSave.career_story, format:pendingSave.format, credibility:pendingSave.credibility, top_3_actions:pendingSave.top_3_actions, detected_domain:pendingSave.detected_domain, detected_level:pendingSave.detected_level, tier:pendingSave.tier }).then(({error})=>{ if (!error){setSavedToHistory(true);setPendingSave(null)} })
  }, [user, session, pendingSave, savedToHistory])

  const handleDrop = useCallback((e:DragEvent<HTMLDivElement>)=>{ e.preventDefault();setIsDragging(false); const f=e.dataTransfer.files[0]; if (f?.type==='application/pdf') setFile(f) }, [])

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
    } catch (err) { setError(err instanceof Error?err.message:'Something went wrong'); setAppState('error') }
  }

  const reset     = () => { setAppState('idle');setResult(null);setError('');setUrl('');setFile(null);setPendingSave(null);setSavedToHistory(false);setShareUrl(null) }
  const copyShare = async () => {
    if (!result) return
    if (shareUrl) { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(()=>setCopied(false),2500); return }
    setShareLoading(true)
    try {
      const res=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roast_id:result.analysis_id})})
      if (!res.ok) throw new Error()
      const { token } = await res.json()
      const u=`${window.location.origin}/share/${token}`; setShareUrl(u)
      await navigator.clipboard.writeText(u); setCopied(true); setTimeout(()=>setCopied(false),2500)
    } catch {
      const fallback=`My CV scored ${result.total_score}/100 on CVCheck. Check yours free: https://cvcheck.app`
      await navigator.clipboard.writeText(fallback); setCopied(true); setTimeout(()=>setCopied(false),2000)
    } finally { setShareLoading(false) }
  }

  const isPro = result?.tier==='pro'||result?.tier==='premium'
  const scrollToUpload = () => document.getElementById('upload')?.scrollIntoView({behavior:'smooth'})

  return (
    <div className={styles.page}>

      {showAuthModal    && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
      {showUpgradeModal && <UpgradeModal onClose={()=>setShowUpgradeModal(false)} roastId={result?.analysis_id} userId={user?.id} userEmail={user?.email}/>}
      {showAccountModal && user && <AccountModal onClose={()=>setShowAccountModal(false)} userId={user.id} userEmail={user.email??''} onUpgrade={()=>{setShowAccountModal(false);setShowPlansModal(true)}} onSignOut={()=>{setShowAccountModal(false);handleSignOut()}}/>}
      {showPlansModal   && <PlansModal tier={tier} userId={user?.id} userEmail={user?.email} onClose={()=>setShowPlansModal(false)} onBuy={()=>{setShowPlansModal(false);setShowUpgradeModal(true)}}/>}

      {/* NAVBAR */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.logo} href="/">
            <span className={styles.logoMark}>
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                <path d="M3 8.5L6.5 12L13 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={styles.logoText}>CVCheck</span>
          </a>

          <nav className={styles.navCenter}>
            {[['CV Analysis','#analysis'],['Job Matching','#jobs'],['Job Alerts','#alerts'],['Pricing','#pricing']].map(([label,href])=>(
              <button key={href} className={styles.navLink} onClick={()=>document.querySelector(href)?.scrollIntoView({behavior:'smooth'})}>{label}</button>
            ))}
          </nav>

          <div className={styles.headerRight}>
            {!authLoading&&(user?(
              <AccountDropdown user={user} tier={tier} onOpenAccount={()=>setShowAccountModal(true)} onOpenPlans={()=>setShowPlansModal(true)} onSignOut={handleSignOut}/>
            ):(
              <div className={styles.headerAuthBtns}>
                <button className={styles.signInBtn} onClick={()=>setShowAuthModal(true)}>Sign in</button>
                <button className={styles.upgradeHeaderBtn} onClick={scrollToUpload}>Check My CV Free</button>
              </div>
            ))}
            <ThemeToggle/>
          </div>
        </div>
      </header>

      <main className={styles.main}>

        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.heroGradient}/>

          <div className={styles.heroInner}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot}/>
              AI CV Analysis and Job Matching
            </div>

            <h1 className={styles.heroTitle}>
              Your CV,{' '}
              <span className={styles.heroTitleItalic}>Brutally</span>
              <br/>Honest.
            </h1>

            <p className={styles.heroSubtitle}>
              Upload your CV or paste a URL. Get a full AI diagnosis including score, red flags, ATS gaps, and rewritten bullets in seconds.
            </p>

            {/* Upload Box */}
            <div id="upload" className={styles.uploadBox}>
              <div className={styles.uploadBoxInner}>
                <div className={styles.modeTabs}>
                  {(['url','pdf'] as const).map(m=>(
                    <button key={m} className={`${styles.modeTab} ${mode===m?styles.modeTabActive:''}`} onClick={()=>setMode(m)}>
                      {m==='url'
                        ? <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Link / URL</>
                        : <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF upload</>
                      }
                    </button>
                  ))}
                </div>

                {mode==='url'&&(
                  <div className={styles.urlRow}>
                    <input type="url" placeholder="yourportfolio.com or linkedin.com/in/yourname" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} className={styles.urlField} autoComplete="off" spellCheck={false}/>
                    <button onClick={submit} disabled={!url.trim()||appState==='loading'} className={styles.submitBtn}>
                      Analyze
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                  </div>
                )}

                {mode==='pdf'&&(
                  <>
                    <div
                      className={`${styles.dropzone} ${isDragging?styles.dropzoneActive:''} ${file?styles.dropzoneHasFile:''}`}
                      onDrop={handleDrop}
                      onDragOver={e=>{e.preventDefault();setIsDragging(true)}}
                      onDragLeave={()=>setIsDragging(false)}
                      onClick={()=>!file&&fileInputRef.current?.click()}
                    >
                      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f?.type==='application/pdf')setFile(f)}} style={{ display:'none' }}/>
                      {file ? (
                        <div className={styles.filePreview}>
                          <span className={styles.fileIcon}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
                          <div className={styles.fileMeta}>
                            <span className={styles.fileName}>{file.name}</span>
                            <span className={styles.fileSize}>{(file.size/1024).toFixed(0)} KB - PDF ready</span>
                          </div>
                          <button className={styles.fileRemove} onClick={e=>{e.stopPropagation();setFile(null)}}><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        </div>
                      ) : (
                        <div className={styles.dropzonePrompt}>
                          <span className={styles.dropzoneIconWrap}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
                          <span className={styles.dropzoneText}>Drop your CV here</span>
                          <span className={styles.dropzoneHint}>or click to browse - PDF - max 5 MB</span>
                        </div>
                      )}
                    </div>
                    <button onClick={submit} disabled={!file||appState==='loading'} className={styles.submitBtn} style={{ width:'100%', justifyContent:'center' }}>
                      Analyze my CV
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                  </>
                )}

                {(appState==='error'||appState==='idle')&&error&&(
                  <div className={styles.errorBox}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error}
                  </div>
                )}
              </div>
              <div className={styles.freeNote}>
                {tier==='free'&&analysisCount>=1
                  ? <>Used your free scan · <button style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline' }} onClick={()=>setShowUpgradeModal(true)}>Unlock Pro for 1.99 euro</button> to analyze again</>
                  : '1 free scan - no account, no card'
                }
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className={styles.statsStrip}>
            {[
              { num:'7',    label:'dimensions scored' },
              { num:'~30s', label:'from upload to score' },
              { num:'1.99', label:'Pro - one-time payment' },
              { num:'0',    label:'vague feedback in your report' },
            ].map((s,i)=>(
              <div key={s.num} className={`${styles.statItem} revealHidden`} style={{ transitionDelay:`${i*60}ms` }}>
                <span className={styles.statNum}>{s.num}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.heroGradientBottom}/>
        </section>

        {/* LOADING OVERLAY */}
        {appState==='loading'&&(
          <div style={{ position:'fixed', inset:0, background:'color-mix(in srgb, var(--bg) 94%, transparent)', backdropFilter:'blur(14px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:300 }}>
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner}/>
              <p className={styles.loadingText}>Analyzing your CV...</p>
              <div className={styles.loadingSteps}>
                {LOADING_STEPS.map((step,i)=>(
                  <div key={step} className={styles.loadingStep} style={{ color:i===loadingStep?'var(--text-secondary)':'var(--text-tertiary)', opacity:i<=loadingStep?1:0.25 }}>
                    <div className={styles.loadingDot} style={{ boxShadow:i===loadingStep?'0 0 8px var(--accent)':undefined, background:i===loadingStep?'var(--accent)':'var(--text-tertiary)' }}/>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {appState==='result'&&result&&(
          <section style={{ background:'var(--bg)', paddingTop:72 }}>
            <div className={styles.results} style={{ paddingTop:0 }}>
              <div className={styles.resultsHeader}>
                <button className={styles.backBtn} onClick={reset}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                  New analysis
                </button>
                {user&&savedToHistory&&(
                  <button onClick={()=>router.push('/history')} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--score-high)', background:'rgba(22,163,74,0.06)', border:'0.5px solid rgba(22,163,74,0.2)', borderRadius:4, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    Saved - View history
                  </button>
                )}
                {!user&&<button onClick={()=>setShowAuthModal(true)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'0.5px solid var(--border)', borderRadius:4, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Sign in to save</button>}
                <button className={styles.shareBtn} onClick={copyShare} disabled={shareLoading}>
                  {copied
                    ? <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Link copied!</>
                    : shareLoading ? <>Generating...</>
                    : <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share score</>
                  }
                </button>
              </div>
            </div>
            <ResultContent result={result} isPro={isPro} user={user} token={session?.access_token??null} setShowUpgradeModal={setShowUpgradeModal} setShowPlansModal={setShowPlansModal} setShowAuthModal={setShowAuthModal}/>
          </section>
        )}

        {/* LANDING */}
        {(appState==='idle'||appState==='error')&&(<>

          {/* Feature 1: CV Analysis */}
          <section id="analysis" className={styles.featureSection}>
            <div className={styles.sectionWrap}>
              <div className={styles.sHead}>
                <p className={styles.sEyebrow}>AI CV Analysis</p>
                <h2 className={styles.sTitle}>Every recruiter bias, every ATS gap - exposed.</h2>
                <p className={styles.sSub}>CVCheck reads your CV the way a recruiter does in 7 seconds, then goes deeper across 7 dimensions.</p>
                <button className={styles.featureCta} onClick={scrollToUpload}>
                  Analyze My CV Free
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="5 10 12 3 19 10"/></svg>
                </button>
              </div>

              <div className={`${styles.mockCard} revealHidden`} style={{ overflow:'hidden' }}>
                <div style={{ padding:'10px 16px', background:'var(--bg-subtle)', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ display:'flex', gap:5 }}>{['#EF4444','#F59E0B','#22C55E'].map(c=><div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}</div>
                  <div style={{ flex:1, height:22, background:'var(--bg-muted)', borderRadius:4, maxWidth:280, margin:'0 auto' }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                  <div style={{ padding:'24px', borderRight:'0.5px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, paddingBottom:16, borderBottom:'0.5px solid var(--border)' }}>
                      <div style={{ position:'relative', width:80, height:80, flexShrink:0 }}>
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--bg-muted)" strokeWidth="4"/>
                          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="146 201" transform="rotate(-90 40 40)"/>
                        </svg>
                        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                          <div style={{ fontSize:20, fontWeight:800, color:'var(--accent)', lineHeight:1 }}>73</div>
                          <div style={{ fontSize:9, color:'var(--text-tertiary)' }}>/100</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--score-mid)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>Good</div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>3 critical gaps holding you back.</div>
                      </div>
                    </div>
                    {[{label:'First Impression',pct:73},{label:'Impact and Achievements',pct:68},{label:'ATS Compatibility',pct:70},{label:'Red Flags',pct:85},{label:'Career Story',pct:60}].map(d=>(
                      <div key={d.label} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-secondary)', marginBottom:3 }}><span>{d.label}</span><span style={{ color:'var(--accent)', fontWeight:700 }}>{d.pct}%</span></div>
                        <div style={{ height:3, background:'var(--bg-muted)', borderRadius:2 }}><div style={{ height:3, background:'var(--accent)', borderRadius:2, width:`${d.pct}%`, opacity:0.7 }}/></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:14 }}>
                    <div>
                      <div style={{ fontSize:9, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Bullet Rewrite</div>
                      <div style={{ borderRadius:6, border:'0.5px solid var(--border)', overflow:'hidden', fontSize:11 }}>
                        <div style={{ padding:'9px 12px', background:'rgba(220,38,38,0.04)', borderBottom:'0.5px solid var(--border)' }}>
                          <div style={{ fontSize:8, fontWeight:700, color:'var(--score-low)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Before</div>
                          <p style={{ margin:0, color:'var(--text-secondary)', lineHeight:1.5 }}>Worked on improving the onboarding experience for new users.</p>
                        </div>
                        <div style={{ padding:'9px 12px', background:'rgba(22,163,74,0.04)' }}>
                          <div style={{ fontSize:8, fontWeight:700, color:'var(--score-high)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>After</div>
                          <p style={{ margin:0, color:'var(--text-primary)', fontWeight:500, lineHeight:1.5 }}>Redesigned onboarding for 12k users, cutting drop-off 34% in 3 months.</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:9, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>ATS Keywords</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {['Figma','UX Research','Prototyping'].map(k=><span key={k} style={{ fontSize:10, padding:'2px 8px', borderRadius:3, background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', color:'var(--accent)', fontWeight:600 }}>{k}</span>)}
                        {['Design Systems','A/B Testing'].map(k=><span key={k} style={{ fontSize:10, padding:'2px 8px', borderRadius:3, background:'rgba(220,38,38,0.06)', border:'0.5px solid rgba(220,38,38,0.2)', color:'var(--score-low)', fontWeight:600 }}>{k}</span>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:9, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Red Flags</div>
                      {[{sev:'high',text:'Bullets lack measurable outcomes'},{sev:'medium',text:'No professional summary section'}].map(f=>(
                        <div key={f.text} style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:6, fontSize:11, color:'var(--text-secondary)' }}>
                          <div style={{ width:5, height:5, borderRadius:'50%', background:f.sev==='high'?'var(--score-low)':'var(--score-mid)', flexShrink:0, marginTop:4 }}/>
                          {f.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 2: Job Matching */}
          <section id="jobs" style={{ background:'var(--bg)', padding:'88px 0' }}>
            <div className={styles.sectionWrap}>
              <div className={styles.sHead}>
                <p className={styles.sEyebrow}>Job Matching</p>
                <h2 className={styles.sTitle}>Jobs that actually fit - with a score to prove it.</h2>
                <p className={styles.sSub}>CVCheck automatically matches you with relevant roles from Adzuna and Remotive. Premium users see a full fit score, strengths, and gaps for every job.</p>
                <button className={styles.featureCta} onClick={scrollToUpload}>
                  See My Matched Jobs
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="5 10 12 3 19 10"/></svg>
                </button>
              </div>

              <div className={`${styles.mockCard} revealHidden`} style={{ overflow:'hidden' }}>
                <div style={{ padding:'10px 16px', background:'var(--bg-subtle)', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ display:'flex', gap:5 }}>{['#EF4444','#F59E0B','#22C55E'].map(c=><div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}</div>
                  <div style={{ flex:1, height:22, background:'var(--bg-muted)', borderRadius:4, maxWidth:280, margin:'0 auto' }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                  <div style={{ padding:'20px', borderRight:'0.5px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
                    {[
                      { title:'Senior Product Designer', company:'Stripe', location:'Remote', score:92, label:'strong' },
                      { title:'UX Lead - Growth', company:'Figma', location:'San Francisco', score:78, label:'good' },
                      { title:'Design Systems Manager', company:'Notion', location:'Remote', score:64, label:'partial' },
                    ].map((j,i)=>(
                      <div key={i} style={{ padding:'12px 14px', borderRadius:6, border:`0.5px solid ${j.label==='strong'?'rgba(22,163,74,0.3)':'var(--border)'}`, background:'var(--bg-elevated)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{j.title}</div>
                          <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:3, color:j.label==='strong'?'var(--score-high)':j.label==='good'?'#65A30D':'var(--score-mid)', background:j.label==='strong'?'rgba(22,163,74,0.1)':j.label==='good'?'rgba(101,163,13,0.1)':'rgba(202,138,4,0.1)' }}>{j.score}% {j.label}</span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{j.company} - {j.location}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Fit Analysis</div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--score-high)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Strengths</div>
                      {['Strong Figma and design systems background','5+ yrs experience matches seniority ask'].map((s,i)=>(
                        <div key={i} style={{ display:'flex', gap:7, fontSize:11, color:'var(--text-secondary)', marginBottom:5 }}><span style={{ color:'var(--score-high)' }}>check</span>{s}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Gaps</div>
                      {['No B2B SaaS product experience listed','Missing quantified revenue impact metrics'].map((g,i)=>(
                        <div key={i} style={{ display:'flex', gap:7, fontSize:11, color:'var(--text-secondary)', marginBottom:5 }}><span style={{ color:'var(--score-low)' }}>x</span>{g}</div>
                      ))}
                    </div>
                    <div style={{ marginTop:'auto', padding:'10px 12px', borderRadius:5, background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', fontSize:11, color:'var(--accent)', fontWeight:600, cursor:'pointer' }}>
                      Unlock full analysis - Premium
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 3: Job Alerts */}
          <section id="alerts" className={styles.alertsSection}>
            <div className={styles.sectionWrap}>
              <div className={styles.sHead} style={{ color:'#F5EDE4' }}>
                <p className={styles.sEyebrow} style={{ color:'rgba(245,237,228,0.5)' }}>Weekly Job Alerts</p>
                <h2 className={styles.sTitle} style={{ color:'#F5EDE4' }}>New matches, every Monday morning.</h2>
                <p className={styles.sSub} style={{ color:'rgba(245,237,228,0.6)' }}>Subscribe once, and get a curated list of jobs matched to your profile sent to your inbox every week.</p>
                <button className={styles.featureCta} onClick={scrollToUpload} style={{ background:'#F5EDE4', color:'var(--text-primary)' }}>
                  Get Free Alerts
                </button>
              </div>

              <div className={`${styles.mockCard} revealHidden`} style={{ background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(245,237,228,0.12)', maxWidth:560, margin:'0 auto' }}>
                <div style={{ padding:'14px 18px', borderBottom:'0.5px solid rgba(245,237,228,0.1)', fontSize:11, fontWeight:600, color:'rgba(245,237,228,0.5)', display:'flex', alignItems:'center', gap:8 }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Weekly CV Match Report - Monday 9:00 UTC
                </div>
                <div style={{ padding:'18px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#F5EDE4', marginBottom:12 }}>3 new matches this week for Product Designer at Senior level</div>
                  {[{t:'Staff Designer',c:'Linear',s:88},{t:'Design Lead',c:'Vercel',s:81}].map((j,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'0.5px solid rgba(245,237,228,0.08)', fontSize:12 }}>
                      <span style={{ color:'rgba(245,237,228,0.8)', fontWeight:600 }}>{j.t}</span>
                      <span style={{ color:'rgba(245,237,228,0.4)' }}>{j.c}</span>
                      <span style={{ color:'var(--score-high)', fontWeight:700 }}>{j.s}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* How it Works */}
          <section className={styles.howSection}>
            <div className={styles.sectionWrap}>
              <div className={styles.sHead}>
                <p className={styles.sEyebrow}>How it works</p>
                <h2 className={styles.sTitle}>From upload to offer.</h2>
              </div>
              <div className={styles.howSteps}>
                {[
                  { n:'01', title:'Upload your CV', desc:'Paste a URL (LinkedIn, portfolio) or upload a PDF. Max 5 MB. No account required.' },
                  { n:'02', title:'AI reads it like a recruiter', desc:'We run 7 checks in parallel - ATS parsing, impact scoring, red flag detection, and more. Done in about 30 seconds.' },
                  { n:'03', title:'Get your score and diagnosis', desc:'See exactly where you lose points, with rewritten bullets and a step-by-step fix list.' },
                ].map((s,i)=>(
                  <div key={s.n} className={`${styles.howStep} revealHidden`} style={{ transitionDelay:`${i*80}ms` }}>
                    <span className={styles.howStepNum}>STEP {s.n}</span>
                    <h3 className={styles.howStepTitle}>{s.title}</h3>
                    <p className={styles.howStepDesc}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Domain Examples */}
          <section className={styles.sampleSection}>
            <div className={styles.sectionWrap}>
              <div className={styles.sHead}>
                <p className={styles.sEyebrow}>Every domain</p>
                <h2 className={styles.sTitle}>Works for every field and level.</h2>
                <p className={styles.sSub}>CVCheck detects your domain and seniority automatically and benchmarks you against the right standard.</p>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
                {['Product Design','Engineering','Product Management','Marketing','Data Science','UX Research','Frontend Dev','Backend Dev','DevOps','Sales','Finance','Operations','Content','HR','Consulting','Startup Founder'].map(d=>(
                  <span key={d} style={{ fontSize:13, fontWeight:500, padding:'7px 16px', borderRadius:20, background:'var(--bg-elevated)', border:'0.5px solid var(--border)', color:'var(--text-secondary)', transition:'all 0.15s', cursor:'default' }}>{d}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className={styles.pricingSection}>
            <div className={styles.sectionWrap}>
              <div className={styles.sHead}>
                <p className={styles.sEyebrow}>Pricing</p>
                <h2 className={styles.sTitle}>No tricks. No contact us.</h2>
                <p className={styles.sSub}>Start free. Pay once for Pro. Subscribe for unlimited.</p>
              </div>

              <div className={styles.pricingCards}>
                {([
                  { key:'free',    name:'Free',    price:'0',    period:'forever free',  badge:null,           ctaClass:styles.pricingCtaGhost,  action:scrollToUpload },
                  { key:'pro',     name:'Pro',     price:'1.99', period:'one-time',       badge:'Most Popular', ctaClass:styles.pricingCtaAccent, action:()=>setShowUpgradeModal(true) },
                  { key:'premium', name:'Premium', price:'5.99', period:'/month',         badge:null,           ctaClass:styles.pricingCtaGhost,  action:()=>setShowUpgradeModal(true) },
                ] as const).map(p=>(
                  <div key={p.key} className={`${styles.pricingCard} ${p.key==='pro'?styles.pricingCardFeatured:''}`}>
                    {p.badge&&<span className={styles.pricingBadge}>{p.badge}</span>}
                    <div>
                      <p className={styles.pricingCardName}>{p.name}</p>
                      <p className={styles.pricingCardPrice}>{p.price}</p>
                      <p className={styles.pricingCardPeriod}>{p.period}</p>
                    </div>
                    <ul className={styles.pricingFeatureList}>
                      {(p.key==='free'
                        ? ['Overall score /100 + rating','First impression analysis','Red flag count + severity','ATS verdict','Career trajectory','2 job matches visible','History (with account)']
                        : p.key==='pro'
                        ? ['Everything in Free','AI bullet rewrites on your text','How-to-fix for every red flag','Missing ATS keywords','Career gap analysis','Top 3 actions with how-to + examples']
                        : ['Everything in Pro','Unlimited analyses','All matched jobs visible','Fit score 0-100 per job','Strengths and gaps per job','Weekly job alert emails']
                      ).map(f=>(
                        <li key={f} className={styles.pricingFeatureItem}>
                          <svg width="12" height="12" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:2 }}><polyline points="20 6 9 17 4 12"/></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button className={p.ctaClass} onClick={p.action}>
                      {tier===p.key?'Current plan':p.key==='free'?'Get Started Free':p.key==='pro'?'Get Pro - 1.99 euro':'Start Premium'}
                    </button>
                  </div>
                ))}
              </div>

              <p className={styles.pricingGuarantee}>
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure checkout via Stripe - No subscription on Pro - 1 scan always free
              </p>
            </div>
          </section>

          {/* Testimonial */}
          <section className={styles.testimonialSection}>
            <div className={styles.sectionWrap}>
              <div className={styles.sHead}>
                <p className={styles.sEyebrow}>Testimonial</p>
                <h2 className={styles.sTitle}>The most honest feedback your CV will ever get.</h2>
              </div>
              <div className={`${styles.sampleCard} revealHidden`} style={{ maxWidth:600, margin:'0 auto', padding:'40px 44px' }}>
                <div style={{ display:'flex', justifyContent:'center', gap:3, marginBottom:12 }}>
                  {[...Array(5)].map((_,i)=><svg key={i} width="18" height="18" fill="var(--accent)" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
                </div>
                <p style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:20, textAlign:'center' }}>Rated 4.9 by early users</p>
                <blockquote style={{ fontSize:'clamp(16px,2vw,19px)', fontWeight:400, color:'var(--text-primary)', lineHeight:1.55, fontStyle:'italic', marginBottom:18, fontFamily:'var(--font-serif)', textAlign:'center' }}>
                  I had no idea my CV was this weak until CVCheck told me exactly why. Got two interview calls the week after fixing the red flags.
                </blockquote>
                <p style={{ fontSize:13, color:'var(--text-tertiary)', textAlign:'center' }}>Mihai D., Product Manager, Bucharest</p>
              </div>
            </div>
          </section>

        </>)}
      </main>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <svg viewBox="0 0 28 28" fill="none" width="18" height="18"><rect width="28" height="28" rx="6" fill="var(--accent)"/><path d="M7 14.5L11.5 19L21 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>CVCheck</span>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/privacy" className={styles.footerLink}>Privacy</Link>
          <Link href="/terms" className={styles.footerLink}>Terms</Link>
          <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>2026 cvcheck.app</span>
        </div>
      </footer>

    </div>
  )
}
