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
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--text-tertiary)', background:'none', border:'0.5px solid var(--border)', borderRadius:4, padding:'4px 10px', cursor:'pointer', fontFamily:'var(--font-sans)', letterSpacing:'-0.01em' }}>
      <LockIcon size={9}/> {label}
    </button>
  )
}

function DimensionBar({ label, score, max, desc, locked, onUnlock }: { label:string; score:number; max:number; desc:string; locked?:boolean; onUnlock?:()=>void }) {
  const pct = (score / max) * 100
  const color = pct >= 66 ? 'var(--score-high)' : pct >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  return (
    <div style={{ display:'flex', flexDirection:'column' as const, gap:6, padding:'12px 0', borderBottom:'0.5px solid var(--border)', cursor:locked?'pointer':'default' }} onClick={locked?onUnlock:undefined}>
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
    <div style={{ padding:'12px 16px', borderRadius:6, background:`${color}05`, border:`0.5px solid ${color}25`, display:'flex', flexDirection:'column' as const, gap:6 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', padding:'2px 7px', borderRadius:2, color, background:`${color}12`, border:`0.5px solid ${color}30`, flexShrink:0, marginTop:1 }}>{label}</span>
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
    <div style={{ borderRadius:6, border:'0.5px solid var(--border)', overflow:'hidden', fontSize:12.5 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
        <div style={{ padding:'10px 14px', background:'rgba(220,38,38,0.04)', borderRight:'0.5px solid var(--border)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--score-low)', marginBottom:5 }}>Before</div>
          <p style={{ margin:0, color:'var(--text-secondary)', lineHeight:1.55 }}>{rewrite.original}</p>
        </div>
        <div style={{ padding:'10px 14px', background:'rgba(22,163,74,0.04)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--score-high)', marginBottom:5 }}>After</div>
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
    <div style={{ padding:'16px 18px', borderRadius:6, border:'0.5px solid var(--border)', background:'var(--bg-elevated)', display:'flex', flexDirection:'column' as const, gap:8 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <span style={{ fontSize:10, fontWeight:800, color:'var(--text-tertiary)', flexShrink:0, marginTop:1, letterSpacing:'0.04em', fontFamily:'var(--font-mono)' }}>{String(index+1).padStart(2,'0')}</span>
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontSize:13.5, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.35 }}>{action.action}</p>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{action.why_it_matters}</p>
        </div>
      </div>
      {detailsLocked ? (
        <div onClick={onUnlock} style={{ padding:'8px 12px', borderRadius:5, border:'0.5px dashed var(--border)', background:'var(--bg-subtle)', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
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
    <div onClick={onUnlock} style={{ padding:'14px 18px', borderRadius:6, border:'0.5px solid var(--border)', background:'var(--bg-subtle)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {count !== undefined && <span style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-1px', lineHeight:1 }}>{count}</span>}
        <div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{label}</div>
          <div style={{ fontSize:11.5, color:'var(--text-tertiary)' }}>{sublabel}</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, fontSize:11.5, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', borderRadius:4, padding:'4px 10px', whiteSpace:'nowrap' as const }}>
        Unlock — €1.99 <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  )
}
const FIT_COLORS: Record<string,string> = { strong:'var(--score-high)', good:'#65A30D', partial:'var(--score-mid)', stretch:'var(--score-low)' }
function FitBadge({ label, score }: { label:string; score:number }) {
  const color = FIT_COLORS[label] ?? 'var(--text-secondary)'
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' as const, color, background:`${color}15`, border:`0.5px solid ${color}40`, borderRadius:3, padding:'2px 8px' }}>{score}% · {label}</span>
}

function JobCard({ job, fitLocked, onUnlock, token, initialStatus, onSaveChange }: { job:JobMatchType; fitLocked:boolean; onUnlock:()=>void; token:string|null; initialStatus?:'none'|'saved'|'applied'; onSaveChange?:(id:string,status:'none'|'saved'|'applied')=>void }) {
  const { listing, fit } = job
  const [saved, setSaved] = useState<'none'|'saved'|'applied'>(initialStatus ?? 'none')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const salary = listing.salary_min && listing.salary_min >= 1000 ? `${Math.round(listing.salary_min/1000)}k${listing.salary_max?`–${Math.round(listing.salary_max/1000)}k`:'+'}`  : null

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
    <div style={{ border:`0.5px solid ${fit?.fit_label==='strong'?'rgba(22,163,74,0.3)':'var(--border)'}`, borderRadius:8, padding:'18px 20px', background:'var(--bg-elevated)', display:'flex', flexDirection:'column' as const, gap:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3 }}>{listing.title}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3, display:'flex', gap:6, flexWrap:'wrap' as const, alignItems:'center' }}>
            <span>{listing.company}</span>
            {listing.location&&<><span style={{ color:'var(--border-strong)' }}>·</span><span>{listing.location}</span></>}
            {salary&&<><span style={{ color:'var(--border-strong)' }}>·</span><span style={{ color:'var(--text-primary)', fontWeight:600 }}>{salary}</span></>}
          </div>
        </div>
        {fit&&<FitBadge label={fit.fit_label} score={fit.fit_score}/>}
      </div>
      <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6, margin:0, display:'-webkit-box' as const, WebkitLineClamp:expanded?undefined:3, WebkitBoxOrient:'vertical' as const, overflow:expanded?'visible':'hidden' }}>{listing.description}</p>
      {listing.description.length>200&&<button onClick={()=>setExpanded(e=>!e)} style={{ alignSelf:'flex-start', fontSize:11, color:'var(--text-tertiary)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font-sans)' }}>{expanded?'Show less':'Show more'}</button>}
      {fit&&fit.strengths&&fit.strengths.length>0&&(
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column' as const, gap:5 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--score-high)' }}>Why you're a good fit</div>
          {fit.strengths.map((s,i)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}><span style={{ color:'var(--score-high)', flexShrink:0 }}>✓</span>{s}</div>)}
        </div>
      )}
      {fit&&fit.gaps&&fit.gaps.length>0&&(
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column' as const, gap:5 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--text-tertiary)' }}>What you're missing</div>
          {fit.gaps.map((gap,i)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'var(--text-secondary)' }}><span style={{ color:'var(--score-low)', flexShrink:0 }}>✕</span>{gap}</div>)}
        </div>
      )}
      {fitLocked&&fit&&(
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10 }}>
          <button onClick={onUnlock} style={{ fontSize:12, fontWeight:600, color:'var(--accent)', background:'var(--accent-subtle)', border:'0.5px solid var(--accent-border)', borderRadius:4, padding:'5px 12px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Unlock skill gaps & full analysis</button>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
        <a href={listing.redirect_url} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:'center' as const, fontSize:12, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-muted)', border:'0.5px solid var(--border-strong)', borderRadius:4, padding:'6px 12px', textDecoration:'none' }}>View job →</a>
        <button onClick={()=>!saving&&handleSave('saved')} style={{ fontSize:13, padding:'5px 10px', borderRadius:4, border:`0.5px solid ${saved==='saved'?'var(--accent)':'var(--border)'}`, background:saved==='saved'?'var(--accent-subtle)':'var(--bg-muted)', color:saved==='saved'?'var(--accent)':'var(--text-tertiary)', cursor:saving?'wait':'pointer', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>{saved==='saved'?'★':'☆'}</button>
        <button onClick={()=>!saving&&handleSave('applied')} style={{ fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:4, border:`0.5px solid ${saved==='applied'?'var(--score-high)':'var(--border)'}`, background:saved==='applied'?'rgba(22,163,74,0.08)':'var(--bg-muted)', color:saved==='applied'?'var(--score-high)':'var(--text-tertiary)', cursor:saving?'wait':'pointer', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>{saved==='applied'?'✓ Applied':'Applied?'}</button>
      </div>
    </div>
  )
}

const ADZUNA_UI_SUPPORTED = new Set(['gb','us','ca','au','de','nl','sg','at','be','br','in','nz','pl','za','fr','it','es','ru','mx','ar'])
type FilterType = 'all'|'strong'|'good'|'partial'|'stretch'

function JobMatchesSection({ result, token, isPremium, onUnlock }: { result:GatedAnalysisResult; token:string|null; isPremium:boolean; onUnlock:()=>void }) {
  const CACHE_KEY       = `jobs-cache-${result.analysis_id}`
  const SAVED_CACHE_KEY = `jobs-saved-${result.analysis_id}`
  const CACHE_TTL_MS    = 24*60*60*1000
  const [state, setState]         = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [data, setData]           = useState<JobsResponse|null>(null)
  const [errMsg, setErrMsg]       = useState('')
  const [filter, setFilter]       = useState<FilterType>('all')
  const [savedStatuses, setSavedStatuses] = useState<Record<string,'saved'|'applied'>>({})
  const [alertState, setAlertState] = useState<'idle'|'loading'|'subscribed'|'error'>('idle')

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as { data:JobsResponse; cachedAt:number }
        if (Date.now()-parsed.cachedAt<CACHE_TTL_MS) {
          setData(parsed.data); setState('done')
          try { const s=sessionStorage.getItem(SAVED_CACHE_KEY); if (s) setSavedStatuses(JSON.parse(s)) } catch {}
          return
        }
        sessionStorage.removeItem(CACHE_KEY); sessionStorage.removeItem(SAVED_CACHE_KEY)
      }
    } catch {}
    fetchJobs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!token||state!=='done') return
    fetch('/api/jobs/save',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(({jobs})=>{
      const map:Record<string,'saved'|'applied'>={};
      for (const j of (jobs??[])) map[j.job_id]=j.status
      setSavedStatuses(map)
      try { sessionStorage.setItem(SAVED_CACHE_KEY,JSON.stringify(map)) } catch {}
    }).catch(()=>{})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, state])

  async function fetchJobs() {
    setState('loading'); setErrMsg('')
    try {
      const headers:Record<string,string>={'Content-Type':'application/json'}
      if (token) headers['Authorization']=`Bearer ${token}`
      const res = await fetch('/api/jobs',{method:'POST',headers,body:JSON.stringify({detected_domain:result.detected_domain,detected_level:result.detected_level,trajectory:result.career_story.trajectory_detected,keywords:result.ats.missing_keywords??[]})})
      if (!res.ok) { const e=await res.json(); throw new Error(e.error??'Unknown error') }
      const json = await res.json() as JobsResponse
      try { sessionStorage.setItem(CACHE_KEY,JSON.stringify({data:json,cachedAt:Date.now()})); sessionStorage.removeItem(SAVED_CACHE_KEY) } catch {}
      setData(json); setState('done')
    } catch (e:unknown) { setErrMsg(e instanceof Error?e.message:'Something went wrong'); setState('error') }
  }

  async function handleAlertSubscribe() {
    if (!token) { onUnlock(); return }
    setAlertState('loading')
    try {
      const res = await fetch('/api/jobs/alert',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'subscribe',cvMeta:{detected_domain:result.detected_domain,detected_level:result.detected_level,trajectory:result.career_story.trajectory_detected,keywords:result.ats.missing_keywords??[]}})})
      if (!res.ok) throw new Error()
      setAlertState('subscribed')
    } catch { setAlertState('error') }
  }

  function handleSaveChange(id:string, status:'none'|'saved'|'applied') {
    setSavedStatuses(prev => { if (status==='none'){const n={...prev};delete n[id];return n}; return {...prev,[id]:status} })
    try { const c=sessionStorage.getItem(SAVED_CACHE_KEY); const m=c?JSON.parse(c):{}; if (status==='none') delete m[id]; else m[id]=status; sessionStorage.setItem(SAVED_CACHE_KEY,JSON.stringify(m)) } catch {}
  }

  const filteredJobs = data?.jobs.filter(j=>filter==='all'?true:j.fit?.fit_label===filter)??[]
  const counts = data?.jobs.reduce((acc,j)=>{ const l=j.fit?.fit_label; if (l) acc[l]=(acc[l]??0)+1; return acc },{} as Record<string,number>)??{}
  const FREE_LIMIT = 2

  return (
    <div style={{ marginTop:32 }}>
      <div style={{ marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap' as const, gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'var(--text-tertiary)', marginBottom:5 }}>Job Matches</div>
          <h2 style={{ fontSize:'clamp(18px,2.5vw,24px)', fontWeight:700, color:'var(--text-primary)', margin:0, letterSpacing:'-0.5px' }}>Roles that fit your profile</h2>
          {data?.detected_country&&<p style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4, marginBottom:0 }}>{ADZUNA_UI_SUPPORTED.has(data.detected_country)?`Jobs near you · ${data.detected_country.toUpperCase()}`:'Remote & global jobs matched to your profile'}</p>}
        </div>
        {data&&data.jobs.length>0&&(
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
            {(['all','strong','good','partial','stretch'] as FilterType[]).map(f=>{
              const count=f==='all'?data.jobs.length:(counts[f]??0)
              return <button key={f} onClick={()=>setFilter(f)} style={{ fontSize:11, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' as const, padding:'4px 10px', borderRadius:4, border:`0.5px solid ${filter===f?'var(--accent)':'var(--border)'}`, background:filter===f?'var(--accent)':'transparent', color:filter===f?'#fff':'var(--text-tertiary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>{f}{count>0?` (${count})`:''}</button>
            })}
          </div>
        )}
      </div>
      {state==='done'&&data&&(
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            {alertState==='subscribed'?<div style={{ fontSize:12, color:'var(--score-high)', display:'flex', alignItems:'center', gap:5 }}><span>✓</span> Weekly job alerts activated</div>
            :alertState==='error'?<div style={{ fontSize:12, color:'var(--score-low)' }}>Failed to subscribe.</div>
            :<button onClick={handleAlertSubscribe} disabled={alertState==='loading'} style={{ fontSize:12, color:'var(--text-secondary)', background:'none', border:'0.5px solid var(--border)', borderRadius:4, padding:'4px 12px', cursor:alertState==='loading'?'wait':'pointer', fontFamily:'var(--font-sans)', opacity:alertState==='loading'?0.6:1, display:'flex', alignItems:'center', gap:6 }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {alertState==='loading'?'Activating…':'Get weekly alerts'}
            </button>}
          </div>
          <button onClick={()=>{ try{sessionStorage.removeItem(CACHE_KEY);sessionStorage.removeItem(SAVED_CACHE_KEY)}catch{};fetchJobs() }} style={{ fontSize:11, color:'var(--text-tertiary)', background:'none', border:'0.5px solid var(--border)', borderRadius:4, padding:'3px 10px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>↻ Refresh</button>
        </div>
      )}
      {state==='loading'&&<div style={{ fontSize:13, color:'var(--text-secondary)', padding:'16px 0', display:'flex', alignItems:'center', gap:8 }}><div style={{ width:14, height:14, borderRadius:'50%', border:'1.5px solid var(--border)', borderTopColor:'var(--text-primary)', animation:'spin 0.7s linear infinite' }}/>Finding matching jobs…</div>}
      {state==='error'&&<div style={{ fontSize:13, color:'var(--score-low)', padding:'10px 14px', border:'0.5px solid var(--score-low)', borderRadius:6, maxWidth:400 }}>{errMsg}<button onClick={fetchJobs} style={{ marginLeft:12, fontSize:12, color:'var(--text-primary)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'var(--font-sans)' }}>Retry</button></div>}
      {state==='done'&&data&&(
        <div style={{ display:'flex', flexDirection:'column' as const, gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
            {filteredJobs.slice(0,isPremium?filteredJobs.length:FREE_LIMIT).map(job=>(
              <JobCard key={job.listing.id} job={job} fitLocked={data.fit_locked} onUnlock={onUnlock} token={token} initialStatus={savedStatuses[job.listing.id]} onSaveChange={handleSaveChange}/>
            ))}
          </div>
          {!isPremium&&filteredJobs.length>FREE_LIMIT&&(
            <div style={{ border:'0.5px dashed var(--accent-border)', borderRadius:8, padding:'28px 24px', background:'linear-gradient(135deg,rgba(212,98,42,0.06) 0%,rgba(212,98,42,0.02) 100%)', display:'flex', flexDirection:'column' as const, alignItems:'center', gap:12, textAlign:'center' as const }}>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', margin:'0 0 4px' }}>{filteredJobs.length-FREE_LIMIT} more matching jobs</p>
              <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:0 }}>Unlock all matches + skill gap analysis for every role</p>
              <button onClick={onUnlock} style={{ fontSize:13, fontWeight:700, color:'#fff', background:'var(--accent)', border:'none', borderRadius:4, padding:'9px 24px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Unlock with Premium — €5.99/mo</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
function ResultContent({ result, isPro, user, token, setShowUpgradeModal, setShowPlansModal, setShowAuthModal }: {
  result:GatedAnalysisResult; isPro:boolean; user:{email?:string}|null; token:string|null
  setShowUpgradeModal:(v:boolean)=>void; setShowPlansModal:(v:boolean)=>void; setShowAuthModal:(v:boolean)=>void
}) {
  const unlock = () => setShowUpgradeModal(true)
  const barsRef = useAnimatedBars()

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'0 20px', display:'flex', flexDirection:'column' as const, gap:20 }}>
      {/* Score hero */}
      <div style={{ display:'flex', alignItems:'center', gap:28, padding:'28px 32px', background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', boxShadow:'var(--shadow-md)' }}>
        <ScoreRing score={result.total_score}/>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' as const, marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', padding:'3px 10px', borderRadius:3, color:RATING_COLORS[result.rating], background:`${RATING_COLORS[result.rating]}08`, border:`0.5px solid ${RATING_COLORS[result.rating]}30` }}>{RATING_LABELS[result.rating]}</span>
            {result.detected_domain&&result.detected_domain!=='Unknown'&&<span style={{ fontSize:10, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:'var(--text-tertiary)', padding:'2px 8px', border:'0.5px solid var(--border)', borderRadius:3 }}>{LEVEL_LABELS[result.detected_level]} · {result.detected_domain}</span>}
          </div>
          <p style={{ margin:0, fontSize:14, color:'var(--text-secondary)', lineHeight:1.65 }}>{result.summary}</p>
        </div>
      </div>

      {/* First Impression */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', padding:'20px 24px' }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:14, letterSpacing:'-0.02em' }}>First Impression</h2>
        <div style={{ padding:'14px 18px', borderRadius:6, border:`0.5px solid ${result.first_impression.passes_7_second_test?'rgba(22,163,74,0.25)':'rgba(220,38,38,0.25)'}`, background:result.first_impression.passes_7_second_test?'rgba(22,163,74,0.04)':'rgba(220,38,38,0.04)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', color:result.first_impression.passes_7_second_test?'var(--score-high)':'var(--score-low)', marginBottom:7 }}>{result.first_impression.passes_7_second_test?'✓ Passes 7-second test':'✗ Fails 7-second test'}</div>
          <p style={{ margin:0, fontSize:13, color:'var(--text-primary)', fontStyle:'italic', lineHeight:1.6 }}>"{result.first_impression.what_recruiter_sees}"</p>
          <p style={{ margin:'6px 0 0', fontSize:11.5, color:'var(--text-tertiary)' }}>— what a recruiter understands about you in 7 seconds</p>
        </div>
      </div>

      {/* Score Breakdown */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', padding:'20px 24px' }} ref={barsRef}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4, letterSpacing:'-0.02em' }}>Score Breakdown</h2>
        {SCORE_DIMENSIONS.map(({key,label,max,desc})=>(
          <DimensionBar key={key} label={label} score={(result.scores as unknown as Record<string,number>)[key]??0} max={max} desc={desc} locked={false} onUnlock={unlock}/>
        ))}
      </div>

      {/* Impact */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Impact & Achievements</h2>
          {result.rewrites_locked&&<UnlockBtn label="Unlock rewrites — €1.99" onClick={unlock}/>}
        </div>
        <div style={{ display:'flex', gap:0, borderRadius:6, border:'0.5px solid var(--border)', overflow:'hidden', marginBottom:10 }}>
          {[{label:'With metrics',value:result.impact.bullets_with_metrics,color:'var(--score-high)'},{label:'Without metrics',value:result.impact.bullets_without_metrics,color:'var(--score-low)'}].map((s,i)=>(
            <div key={i} style={{ flex:1, padding:'14px 18px', borderRight:i===0?'0.5px solid var(--border)':'none' }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, letterSpacing:'-1.5px' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex:2, padding:'14px 18px' }}>
            <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>Pattern</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{result.impact.dominant_pattern}</div>
          </div>
        </div>
        {result.rewrites_locked?<LockedPreview count={Math.min(result.impact.bullets_without_metrics||2,3)} label="bullet rewrites ready" sublabel="Your weakest bullets rewritten with Action + Result + Numbers" onUnlock={unlock}/>:(
          <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
            {result.impact.rewrites.map((rw,i)=><BulletRewriteCard key={i} rewrite={rw}/>)}
          </div>
        )}
      </div>

      {/* ATS */}
      <div style={{ background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>ATS Compatibility</h2>
          {result.keywords_locked&&<UnlockBtn label="See missing keywords — €1.99" onClick={unlock}/>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.09em', padding:'4px 10px', borderRadius:3, color:ATS_VERDICT_COLORS[result.ats.verdict], background:`${ATS_VERDICT_COLORS[result.ats.verdict]}10`, border:`0.5px solid ${ATS_VERDICT_COLORS[result.ats.verdict]}30` }}>{ATS_VERDICT_LABELS[result.ats.verdict]}</span>
          <span style={{ fontSize:12, color:'var(--text-secondary)' }}>Title searchable: <span style={{ fontWeight:600, color:result.ats.title_is_searchable?'var(--score-high)':'var(--score-low)' }}>{result.ats.title_is_searchable?'Yes':'No'}</span></span>
        </div>
        {result.keywords_locked?<LockedPreview count="5" label="missing ATS keywords for your domain" sublabel="The exact terms recruiters search that aren't in your CV" onUnlock={unlock}/>:(
          result.ats.missing_keywords.length>0&&(
            <div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:7 }}>Missing keywords</div>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:5 }}>
                {result.ats.missing_keywords.map(kw=><span key={kw} style={{ fontSize:11.5, padding:'3px 10px', borderRadius:3, background:'rgba(220,38,38,0.06)', border:'0.5px solid rgba(220,38,38,0.2)', color:'var(--score-low)' }}>{kw}</span>)}
              </div>
            </div>
          )
        )}
      </div>

      {/* Red Flags */}
      {result.red_flags.length>0&&(
        <div style={{ background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', padding:'20px 24px' }}>
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
      <div style={{ background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Top 3 Actions</h2>
          {result.actions_locked&&<UnlockBtn label="Unlock how-to + examples — €1.99" onClick={unlock}/>}
        </div>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
          {result.top_3_actions.map((action,i)=><ActionCard key={i} action={action} index={i} detailsLocked={result.actions_locked} onUnlock={unlock}/>)}
        </div>
      </div>

      {!isPro&&(
        <div style={{ background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:8, padding:36, display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, flexWrap:'wrap' as const }}>
          <div>
            <p style={{ fontSize:16.5, fontWeight:700, color:'var(--text-primary)', margin:'0 0 6px', letterSpacing:'-0.04em' }}>You're missing the part that actually helps.</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.65, margin:0, maxWidth:360 }}>Pro shows your bullet rewrites, how to fix every red flag, ATS keywords, and 3 priority actions. €1.99, once.</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:8, flexShrink:0 }}>
            <button onClick={()=>setShowUpgradeModal(true)} style={{ padding:'11px 22px', fontSize:13.5, fontWeight:600, color:'#fff', background:'var(--accent)', border:'none', borderRadius:4, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Unlock Pro — €1.99</button>
            <button onClick={()=>setShowPlansModal(true)} style={{ padding:'11px 22px', fontSize:13.5, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'0.5px solid var(--border-strong)', borderRadius:4, cursor:'pointer', fontFamily:'var(--font-sans)' }}>See all plans</button>
          </div>
        </div>
      )}

      <JobMatchesSection result={result} token={token} isPremium={result.tier==='premium'||result.tier==='pro'} onUnlock={()=>setShowPlansModal(true)}/>

      {!user&&<div style={{ textAlign:'center' as const, padding:16, fontSize:12, color:'var(--text-tertiary)' }}><button onClick={()=>setShowAuthModal(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline', padding:0 }}>Sign in</button> to save this to your history — free for all accounts.</div>}
    </div>
  )
}

const PLAN_DEFS = {
  free:    { label:'Free',    price:'€0',    period:'',         features:['Overall score /100 + rating','First impression (7-second test)','Impact stats — bullets with/without metrics','Red flag count + severity','ATS verdict','Career trajectory + format verdict','History saved (requires account)'] },
  pro:     { label:'Pro',     price:'€1.99', period:'one-time', features:['Everything in Free','Bullet rewrites on your actual text','How to fix every red flag','Missing ATS keywords for your domain','Career gaps & seniority analysis','Top 3 priority actions with how-to + examples'] },
  premium: { label:'Premium', price:'€5.99', period:'/month',   features:['Everything in Pro','Unlimited analyses','Job matching — live listings matched to your profile'] },
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
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>See your score free. Pay €1.99 once to fix it.</p>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-subtle)', border:'0.5px solid var(--border)', borderRadius:6, color:'var(--text-tertiary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column' as const, gap:8 }}>
          {(['free','pro','premium'] as const).map(pk=>{
            const p=PLAN_DEFS[pk]; const isCurrent=tier===pk
            return (
              <div key={pk} style={{ border:pk==='pro'?'1.5px solid var(--border-strong)':'0.5px solid var(--border)', borderRadius:10, background:pk==='pro'?'var(--bg-subtle)':'var(--bg)', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:pk==='pro'?'var(--text-primary)':pk==='premium'?'var(--score-high)':'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.07em' }}>{p.label}</span>
                    {pk==='pro'&&<span style={{ fontSize:8, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, background:'var(--accent)', color:'#fff', padding:'2px 7px', borderRadius:20 }}>Popular</span>}
                    {isCurrent&&<span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase' as const, color:'var(--text-tertiary)', border:'0.5px solid var(--border)', padding:'2px 7px', borderRadius:20 }}>Current</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                    <span style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', lineHeight:1 }}>{p.price}</span>
                    {p.period&&<span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{p.period}</span>}
                  </div>
                </div>
                <div style={{ padding:'12px 18px 14px', borderTop:'0.5px solid var(--border)' }}>
                  <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column' as const, gap:6 }}>
                    {p.features.map(f=><li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.45 }}><svg width="12" height="12" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>{f}</li>)}
                  </ul>
                  {!isCurrent&&pk!=='free'&&<button onClick={()=>handleBuy(pk)} disabled={!!buying} style={{ width:'100%', marginTop:12, padding:10, fontSize:13, fontWeight:600, color:'#fff', background:'var(--accent)', border:'none', borderRadius:6, cursor:buying?'not-allowed':'pointer', fontFamily:'var(--font-sans)' }}>{buying===pk?'Loading…':pk==='pro'?'Get Pro — €1.99':'Get Premium — €5.99/mo'}</button>}
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
      <button onClick={()=>setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px 4px 5px', background:open?'var(--bg-subtle)':'transparent', border:'0.5px solid var(--border)', borderRadius:40, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
        <span style={{ width:25, height:25, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{initials}</span>
        <span style={{ maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, fontSize:12.5, fontWeight:500, color:'var(--text-secondary)' }}>{user.email?.split('@')[0]}</span>
        <svg width="10" height="10" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&(
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:220, background:'var(--bg-elevated)', border:'0.5px solid var(--border)', borderRadius:7, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.14)', zIndex:1000 }}>
          <div style={{ padding:'13px 16px', borderBottom:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{user.email}</div>
            <div style={{ fontSize:10.5, color:meta.color, fontWeight:600, marginTop:3, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>{meta.label} plan</div>
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

const LOADING_STEPS = ['Reading your CV…','Running the 7-second test…','Checking ATS compatibility…','Writing your rewrites & actions…']
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

  const S = {
    nav: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 40px', height:60, borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', position:'sticky' as const, top:0, zIndex:200 },
    sect: (bg:string) => ({ background:bg, padding:'80px 40px' }),
    wrap: { maxWidth:1100, margin:'0 auto' },
    twoCol: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' as const },
    eyebrow: { fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', color:'var(--accent)', marginBottom:10 },
    h2: { fontSize:'clamp(24px,3vw,36px)' as const, fontWeight:800, color:'var(--text-primary)', lineHeight:1.2, marginBottom:14, letterSpacing:'-0.02em' },
    body: { fontSize:15, color:'var(--text-secondary)', lineHeight:1.7, marginBottom:24 },
    btnPrimary: { background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, padding:'12px 24px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)', transition:'background 0.2s' },
    banner: (bg:string) => ({ background:bg, padding:'44px 40px' }),
    bannerInner: { maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:40 },
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' as const, background:'var(--bg)', fontFamily:'var(--font-sans)' }}>

      {showAuthModal    && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
      {showUpgradeModal && <UpgradeModal onClose={()=>setShowUpgradeModal(false)} roastId={result?.analysis_id} userId={user?.id} userEmail={user?.email}/>}
      {showAccountModal && user && <AccountModal onClose={()=>setShowAccountModal(false)} userId={user.id} userEmail={user.email??''} onUpgrade={()=>{setShowAccountModal(false);setShowPlansModal(true)}} onSignOut={()=>{setShowAccountModal(false);handleSignOut()}}/>}
      {showPlansModal   && <PlansModal tier={tier} userId={user?.id} userEmail={user?.email} onClose={()=>setShowPlansModal(false)} onBuy={()=>{setShowPlansModal(false);setShowUpgradeModal(true)}}/>}

      {/* NAVBAR */}
      <nav style={S.nav}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:18, fontWeight:700, color:'var(--accent)' }}>
          <svg viewBox="0 0 28 28" fill="none" width="28" height="28"><rect width="28" height="28" rx="6" fill="#D4622A"/><path d="M7 14.5L11.5 19L21 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          CVCheck
        </div>
        <ul style={{ display:'flex', alignItems:'center', gap:28, listStyle:'none' }}>
          {[['CV Analysis','#analysis'],['Job Matching','#jobs'],['Job Alerts','#alerts'],['Pricing','#pricing']].map(([label,href])=>(
            <li key={href}><button onClick={()=>document.querySelector(href)?.scrollIntoView({behavior:'smooth'})} style={{ fontSize:14, color:'var(--text-secondary)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)', fontWeight:500 }}>{label}</button></li>
          ))}
        </ul>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {!authLoading&&(user?(
            <AccountDropdown user={user} tier={tier} onOpenAccount={()=>setShowAccountModal(true)} onOpenPlans={()=>setShowPlansModal(true)} onSignOut={handleSignOut}/>
          ):(
            <>
              <button onClick={()=>setShowAuthModal(true)} style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Sign in</button>
              <button onClick={scrollToUpload} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, padding:'9px 18px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Check My CV — Free</button>
            </>
          ))}
          <ThemeToggle/>
        </div>
      </nav>

      <main style={{ flex:1 }}>

        {/* HERO */}
        <section style={{ background:'var(--bg-elevated)', padding:'80px 40px 60px', textAlign:'center' as const }}>
          <div style={S.wrap}>
            <h1 style={{ fontSize:'clamp(36px,5vw,58px)', fontWeight:800, lineHeight:1.08, color:'var(--text-primary)', marginBottom:18, letterSpacing:'-0.03em' }}>
              Your CV, Brutally Honest.<br/>Land More Interviews.
            </h1>
            <p style={{ fontSize:17, color:'var(--text-secondary)', maxWidth:520, margin:'0 auto 32px', lineHeight:1.65 }}>
              Upload your CV and get a full AI diagnosis — score, red flags, ATS gaps, and rewritten bullets — in seconds.
            </p>

            {/* Upload Box */}
            <div id="upload" style={{ maxWidth:560, margin:'0 auto 12px', background:'var(--bg-elevated)', border:'0.5px solid var(--border-strong)', borderRadius:10, overflow:'hidden', boxShadow:'var(--shadow-xl)' }}>
              <div style={{ display:'flex', borderBottom:'0.5px solid var(--border)' }}>
                {(['url','pdf'] as const).map(m=>(
                  <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:'12px', fontSize:13, fontWeight:600, color:mode===m?'var(--text-primary)':'var(--text-tertiary)', background:mode===m?'var(--bg-elevated)':'var(--bg-subtle)', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)', borderBottom:mode===m?'2px solid var(--accent)':'2px solid transparent', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {m==='url'?<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Link / URL</>:<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF upload</>}
                  </button>
                ))}
              </div>
              <div style={{ padding:20 }}>
                {mode==='url'&&(
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="url" placeholder="yourportfolio.com · linkedin.com/in/yourname" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={{ flex:1, padding:'10px 14px', fontSize:13, border:'0.5px solid var(--border-strong)', borderRadius:5, background:'var(--bg)', color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none' }} autoComplete="off" spellCheck={false}/>
                    <button onClick={submit} disabled={!url.trim()||appState==='loading'} style={{ padding:'10px 20px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)', opacity:!url.trim()||appState==='loading'?0.4:1, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' as const }}>
                      Analyze <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                  </div>
                )}
                {mode==='pdf'&&(
                  <>
                    <div onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onClick={()=>!file&&fileInputRef.current?.click()} style={{ border:`1.5px dashed ${isDragging?'var(--accent)':file?'var(--score-high)':'var(--border-strong)'}`, borderRadius:8, padding:'28px 20px', textAlign:'center' as const, cursor:file?'default':'pointer', background:isDragging?'var(--accent-subtle)':file?'rgba(22,163,74,0.04)':'var(--bg)', marginBottom:10 }}>
                      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f?.type==='application/pdf')setFile(f)}} style={{ display:'none' }}/>
                      {file?(
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
                      ):(
                        <>
                          <svg width="28" height="28" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom:8 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', marginBottom:4 }}>Drop your CV here</div>
                          <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>or click to browse · PDF · max 5 MB</div>
                        </>
                      )}
                    </div>
                    <button onClick={submit} disabled={!file||appState==='loading'} style={{ width:'100%', padding:'11px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:file&&appState!=='loading'?'pointer':'not-allowed', fontFamily:'var(--font-sans)', opacity:!file||appState==='loading'?0.38:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                      Analyze my CV <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                  </>
                )}
                {(appState==='error'||appState==='idle')&&error&&(
                  <div style={{ marginTop:10, padding:'10px 14px', borderRadius:5, background:'rgba(220,38,38,0.06)', border:'0.5px solid rgba(220,38,38,0.2)', fontSize:12.5, color:'var(--score-low)', display:'flex', gap:8, alignItems:'flex-start' }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error}
                  </div>
                )}
              </div>
              <div style={{ padding:'10px 20px 14px', fontSize:12, color:'var(--text-tertiary)', textAlign:'center' as const, borderTop:'0.5px solid var(--border)' }}>
                {tier==='free'&&analysisCount>=1?<>Used your free scan · <button style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--accent)', fontFamily:'var(--font-sans)', fontSize:'inherit', textDecoration:'underline' }} onClick={()=>setShowUpgradeModal(true)}>Unlock Pro for €1.99</button> to analyze again</>:'1 free scan · no account, no card'}
              </div>
            </div>

            {/* Stats strip */}
            <div style={{ display:'flex', justifyContent:'center', gap:48, flexWrap:'wrap' as const, marginTop:48, paddingTop:32, borderTop:'0.5px solid var(--border)' }}>
              {[{num:'7',label:'dimensions scored'},{num:'~30s',label:'from upload to score'},{num:'€1.99',label:'Pro · one-time'},{num:'0',label:'"consider improving" in your feedback'}].map(s=>(
                <div key={s.num} style={{ textAlign:'center' as const }}>
                  <div style={{ fontSize:28, fontWeight:800, color:'var(--accent)', letterSpacing:'-1px', lineHeight:1 }}>{s.num}</div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LOADING OVERLAY */}
        {appState==='loading'&&(
          <div style={{ position:'fixed', inset:0, background:'rgba(253,248,243,0.94)', backdropFilter:'blur(14px)', display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', zIndex:300, gap:20 }}>
            <div style={{ width:36, height:36, border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
            <p style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)' }}>Analyzing your CV…</p>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:8, alignItems:'center' }}>
              {LOADING_STEPS.map((step,i)=>(
                <div key={step} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:i===loadingStep?'var(--text-secondary)':'var(--text-tertiary)', opacity:i<=loadingStep?1:0.25 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:i===loadingStep?'var(--accent)':'var(--border)', animation:i===loadingStep?'pulse 1.4s ease-in-out infinite':'none' }}/>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {appState==='result'&&result&&(
          <section style={{ background:'var(--bg)', padding:'32px 0 60px' }}>
            <div style={{ maxWidth:800, margin:'0 auto 20px', padding:'0 20px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' as const }}>
              <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'none', border:'0.5px solid var(--border)', borderRadius:4, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                New analysis
              </button>
              {user&&savedToHistory&&(
                <button onClick={()=>router.push('/history')} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--score-high)', background:'rgba(22,163,74,0.06)', border:'0.5px solid rgba(22,163,74,0.2)', borderRadius:4, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Saved · View history
                </button>
              )}
              {!user&&<button onClick={()=>setShowAuthModal(true)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'0.5px solid var(--border)', borderRadius:4, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Sign in to save</button>}
              <button onClick={copyShare} disabled={shareLoading} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'var(--text-secondary)', background:'transparent', border:'0.5px solid var(--border)', borderRadius:4, padding:'5px 13px', cursor:'pointer', fontFamily:'var(--font-sans)', opacity:shareLoading?0.6:1 }}>
                {copied?<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Link copied!</>:shareLoading?<>Generating…</>:<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share score</>}
              </button>
            </div>
            <ResultContent result={result} isPro={isPro} user={user} token={session?.access_token??null} setShowUpgradeModal={setShowUpgradeModal} setShowPlansModal={setShowPlansModal} setShowAuthModal={setShowAuthModal}/>
          </section>
        )}

        {/* LANDING — only when idle/error */}
        {(appState==='idle'||appState==='error')&&(<>

          {/* CV Analysis */}
          <section id="analysis" style={S.sect('var(--bg-elevated)')}>
            <div style={{ ...S.wrap, ...S.twoCol }}>
              <div>
                <p style={S.eyebrow}>AI CV Analysis</p>
                <h2 style={S.h2}>Every recruiter bias, every ATS gap — exposed.</h2>
                <p style={S.body}>CVCheck reads your CV the way a recruiter does in 7 seconds, then goes deeper — flagging weak verbs, missing keywords, format issues, and credibility gaps across 7 dimensions.</p>
                <button onClick={scrollToUpload} style={S.btnPrimary}>Analyze My CV Now ↑</button>
              </div>
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, border:'0.5px solid var(--border)', padding:24, boxShadow:'var(--shadow-lg)' }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:16, paddingBottom:14, borderBottom:'0.5px solid var(--border)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2 }}>Ana Ionescu</div>
                    <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:10 }}>Senior Product Designer</div>
                    <div style={{ display:'flex', flexDirection:'column' as const, gap:4 }}>
                      {[100,80,90,60].map((w,i)=><div key={i} style={{ height:5, borderRadius:3, background:'var(--bg-muted)', width:`${w}%` }}/>)}
                    </div>
                  </div>
                  <div style={{ background:'var(--accent)', color:'#fff', borderRadius:8, padding:'8px 14px', textAlign:'center' as const, flexShrink:0 }}>
                    <div style={{ fontSize:22, fontWeight:800, lineHeight:1 }}>73</div>
                    <div style={{ fontSize:9, fontWeight:500, marginTop:2 }}>/ 100</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                  <div style={{ flex:1, background:'var(--accent-subtle)', borderRadius:7, padding:10 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--accent)', textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:6 }}>Found</div>
                    <div style={{ display:'flex', flexWrap:'wrap' as const, gap:4 }}>
                      {['Figma','UX Research','Prototyping'].map(k=><span key={k} style={{ fontSize:10, padding:'2px 7px', borderRadius:3, background:'var(--accent)', color:'#fff' }}>{k}</span>)}
                    </div>
                  </div>
                  <div style={{ flex:1, background:'rgba(220,38,38,0.05)', borderRadius:7, padding:10 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--score-low)', textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:6 }}>Missing</div>
                    <div style={{ display:'flex', flexWrap:'wrap' as const, gap:4 }}>
                      {['Design Systems','A/B Testing'].map(k=><span key={k} style={{ fontSize:10, padding:'2px 7px', borderRadius:3, background:'rgba(220,38,38,0.1)', color:'var(--score-low)' }}>{k}</span>)}
                    </div>
                  </div>
                </div>
                <div style={{ borderRadius:6, border:'0.5px solid var(--border)', overflow:'hidden', fontSize:11.5 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                    <div style={{ padding:'10px 12px', background:'rgba(220,38,38,0.04)', borderRight:'0.5px solid var(--border)' }}>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', color:'var(--score-low)', marginBottom:4 }}>Before</div>
                      <p style={{ margin:0, color:'var(--text-secondary)', lineHeight:1.5 }}>Worked on improving the onboarding experience.</p>
                    </div>
                    <div style={{ padding:'10px 12px', background:'rgba(22,163,74,0.04)' }}>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em', color:'var(--score-high)', marginBottom:4 }}>After</div>
                      <p style={{ margin:0, color:'var(--text-primary)', fontWeight:500, lineHeight:1.5 }}>Redesigned onboarding for 12k users, cutting drop-off 34% in 3 months.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Banner 1 */}
          <div style={S.banner('var(--accent)')}>
            <div style={S.bannerInner}>
              <div>
                <p style={{ ...S.eyebrow, color:'rgba(240,196,168,0.9)' }}>CV Analysis</p>
                <h2 style={{ fontSize:24, fontWeight:800, color:'#fff', marginBottom:8 }}>Stop guessing. Start knowing.</h2>
                <p style={{ fontSize:14, color:'rgba(240,196,168,0.8)', maxWidth:420, lineHeight:1.6 }}>Get your score, red flags, and AI-rewritten bullets — all in under 30 seconds.</p>
              </div>
              <button onClick={scrollToUpload} style={{ flexShrink:0, whiteSpace:'nowrap' as const, padding:'12px 24px', fontSize:14, fontWeight:700, color:'var(--accent)', background:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Analyze My CV — Free</button>
            </div>
          </div>

          {/* Job Matching */}
          <section id="jobs" style={S.sect('var(--bg-elevated)')}>
            <div style={{ ...S.wrap, ...S.twoCol }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:12 }}>Matched Jobs <span style={{ background:'var(--accent)', color:'#fff', borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, marginLeft:6 }}>7 MATCHED</span></div>
                <div style={{ background:'var(--bg-elevated)', borderRadius:10, border:'0.5px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow-md)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 0.8fr', padding:'8px 16px', background:'var(--bg-subtle)', borderBottom:'0.5px solid var(--border)', fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.05em', gap:12 }}>
                    <div>Position</div><div>Company</div><div>Location</div><div>Fit</div>
                  </div>
                  {[{init:'PD',name:'Sr. Product Designer',co:'Figma',loc:'Remote EU',fit:'87%'},{init:'UX',name:'UX Design Lead',co:'Zalando',loc:'Berlin, DE',fit:'74%'},{init:'DL',name:'Design Lead',co:'Monzo',loc:'London, UK',fit:'91%'}].map((j,i)=>(
                    <div key={j.name} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 0.8fr', padding:'12px 16px', borderBottom:i<2?'0.5px solid var(--border)':'none', alignItems:'center', gap:12, fontSize:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:24, height:24, borderRadius:5, background:'var(--accent-subtle)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'var(--accent)', flexShrink:0 }}>{j.init}</div>
                        <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{j.name}</span>
                      </div>
                      <span style={{ color:'var(--text-secondary)' }}>{j.co}</span>
                      <span style={{ color:'var(--text-secondary)' }}>{j.loc}</span>
                      <span style={{ fontWeight:700, color:'var(--accent)' }}>{j.fit}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:12, background:'var(--bg-subtle)', borderRadius:8, padding:'12px 16px', border:'0.5px solid var(--border)' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>Fit Analysis — Figma Sr. Designer</div>
                  {[{label:'Figma proficiency',pct:90},{label:'Design Systems',pct:40},{label:'User Research',pct:80}].map(s=>(
                    <div key={s.label} style={{ marginBottom:6 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-secondary)', marginBottom:2 }}><span>{s.label}</span><span style={{ color:s.pct<50?'var(--score-low)':'var(--score-high)' }}>{s.pct}%</span></div>
                      <div style={{ height:4, background:'var(--bg-muted)', borderRadius:2 }}><div style={{ height:4, borderRadius:2, background:s.pct<50?'var(--score-low)':'var(--accent)', width:`${s.pct}%` }}/></div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={S.eyebrow}>Job Matching</p>
                <h2 style={S.h2}>Jobs that actually fit — with a score to prove it.</h2>
                <p style={S.body}>After analyzing your CV, CVCheck automatically matches you with relevant roles. Premium users see a full fit score (0–100), strengths, and gaps for every job.</p>
                <button onClick={scrollToUpload} style={S.btnPrimary}>See Matched Jobs ↑</button>
              </div>
            </div>
          </section>

          {/* Banner 2 */}
          <div style={S.banner('var(--bg-subtle)')}>
            <div style={{ ...S.bannerInner, borderTop:'0.5px solid var(--border)', marginTop:-44, paddingTop:44, ...S.bannerInner }}>
              <div>
                <p style={S.eyebrow}>Job Matching</p>
                <h2 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', marginBottom:8 }}>Jobs matched to your CV. Not the other way around.</h2>
                <p style={{ fontSize:14, color:'var(--text-secondary)', maxWidth:420, lineHeight:1.6 }}>Stop applying blindly. Know your fit score before you apply.</p>
              </div>
              <button onClick={scrollToUpload} style={{ ...S.btnPrimary, flexShrink:0, whiteSpace:'nowrap' as const }}>See My Matches ↑</button>
            </div>
          </div>

          {/* Job Alerts dark */}
          <section id="alerts" style={{ background:'var(--text-primary)', padding:'80px 40px' }}>
            <div style={{ ...S.wrap, ...S.twoCol }}>
              <div>
                <p style={{ ...S.eyebrow, color:'rgba(240,196,168,0.8)' }}>Job Alerts</p>
                <h2 style={{ ...S.h2, color:'#fff' }}>New matched jobs in your inbox every Monday.</h2>
                <p style={{ ...S.body, color:'rgba(255,255,255,0.55)' }}>Subscribe once — we'll send you weekly job alerts tailored to your CV's domain and level, with fit scores so you only open the ones worth your time.</p>
                <button onClick={scrollToUpload} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', fontSize:14, fontWeight:700, color:'var(--accent)', background:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Enable Job Alerts ↑</button>
              </div>
              <div style={{ background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:12, padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, paddingBottom:14, borderBottom:'0.5px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ width:30, height:30, background:'var(--accent)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>CVCheck</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>Weekly Job Alerts · Monday 9:00</div>
                  </div>
                </div>
                {[{title:'Sr. Product Designer',co:'Figma',salary:'€80k–€110k',fit:87},{title:'UX Design Lead',co:'Zalando',salary:'€70k–€90k',fit:74}].map(j=>(
                  <div key={j.title} style={{ background:'rgba(255,255,255,0.08)', borderRadius:8, padding:14, marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:2 }}>{j.title} — {j.co}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginBottom:8 }}>{j.salary} · Remote</div>
                    <div style={{ display:'flex', gap:6 }}>
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:4, background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.55)' }}>Full Time</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, background:'var(--accent)', color:'#fff' }}>Fit: {j.fit}%</span>
                    </div>
                  </div>
                ))}
                <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6 }}>
                  {['Adzuna','Remotive','We Work Remotely'].map(b=><span key={b} style={{ fontSize:10, padding:'3px 10px', borderRadius:4, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.35)' }}>{b}</span>)}
                </div>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" style={S.sect('var(--bg)')}>
            <div style={S.wrap}>
              <div style={{ textAlign:'center' as const, marginBottom:48 }}>
                <p style={S.eyebrow}>Pricing</p>
                <h2 style={{ ...S.h2, marginBottom:10 }}>Simple, honest pricing.</h2>
                <p style={{ fontSize:15, color:'var(--text-secondary)', maxWidth:480, margin:'0 auto' }}>Start free. Upgrade when you need the full picture.</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
                {(['free','pro','premium'] as const).map(pk=>{
                  const p=PLAN_DEFS[pk]; const isFeatured=pk==='pro'; const isCurrent=tier===pk
                  return (
                    <div key={pk} style={{ background:'var(--bg-elevated)', borderRadius:14, border:isFeatured?'2px solid var(--border-strong)':'0.5px solid var(--border)', padding:'32px 28px', boxShadow:'var(--shadow-md)', position:'relative' as const }}>
                      {isFeatured&&<div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'var(--accent)', color:'#fff', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.05em', whiteSpace:'nowrap' as const }}>Most Popular</div>}
                      <div style={{ fontSize:12, fontWeight:700, color:isFeatured?'var(--accent)':'var(--text-tertiary)', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:8 }}>{p.label}</div>
                      <div style={{ fontSize:38, fontWeight:800, color:'var(--text-primary)', lineHeight:1, marginBottom:4 }}>{p.price}</div>
                      <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:24 }}>{p.period||'forever free'}</div>
                      <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column' as const, gap:9, marginBottom:28 }}>
                        {p.features.map(f=><li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'var(--text-secondary)' }}><svg width="12" height="12" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>{f}</li>)}
                      </ul>
                      {isCurrent?<div style={{ textAlign:'center' as const, fontSize:13, color:'var(--text-tertiary)', padding:'11px' }}>Current plan</div>
                      :pk==='free'?<button onClick={scrollToUpload} style={{ width:'100%', padding:'11px', background:'transparent', color:'var(--accent)', border:'2px solid var(--accent)', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Get Started Free</button>
                      :pk==='pro'?<button onClick={()=>setShowUpgradeModal(true)} style={{ width:'100%', padding:'11px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Get Pro — €1.99</button>
                      :<button onClick={()=>setShowUpgradeModal(true)} style={{ width:'100%', padding:'11px', background:'transparent', color:'var(--accent)', border:'2px solid var(--accent)', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Start Premium</button>}
                    </div>
                  )
                })}
              </div>
              <p style={{ textAlign:'center' as const, marginTop:24, fontSize:12, color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure checkout via Stripe · No subscription on Pro · 1 scan always free
              </p>
            </div>
          </section>

          {/* Testimonial */}
          <section style={{ background:'var(--bg-subtle)', padding:'80px 40px', textAlign:'center' as const, borderTop:'0.5px solid var(--border)' }}>
            <div style={{ maxWidth:680, margin:'0 auto' }}>
              <div style={{ display:'flex', justifyContent:'center', gap:3, marginBottom:16 }}>
                {[...Array(5)].map((_,i)=><svg key={i} width="20" height="20" fill="var(--accent)" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
              </div>
              <p style={{ fontSize:13, color:'var(--text-tertiary)', marginBottom:20 }}>Rated <strong style={{ color:'var(--text-secondary)' }}>4.9</strong> by early users</p>
              <blockquote style={{ fontSize:'clamp(17px,2vw,22px)', fontWeight:600, color:'var(--text-primary)', lineHeight:1.45, fontStyle:'italic', marginBottom:20, fontFamily:'var(--font-serif)' }}>
                "I had no idea my CV was this weak until CVCheck told me exactly why. Got two interview calls the week after fixing the red flags."
              </blockquote>
              <p style={{ fontSize:13, color:'var(--text-tertiary)' }}>— Mihai D., Product Manager, Bucharest</p>
            </div>
          </section>

        </>)}

      </main>

      {/* FOOTER */}
      <footer style={{ background:'var(--text-primary)', padding:'60px 40px 36px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr', gap:40, marginBottom:48 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:18, fontWeight:700, color:'#fff', marginBottom:14 }}>
                <svg viewBox="0 0 28 28" fill="none" width="28" height="28"><rect width="28" height="28" rx="6" fill="#D4622A"/><path d="M7 14.5L11.5 19L21 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                CVCheck
              </div>
              <p style={{ fontSize:13, color:'#8A6848', lineHeight:1.6 }}>AI-powered CV analysis and job matching. Get your score, fix your red flags, land more interviews.</p>
            </div>
            {[
              { title:'Product', links:['CV Analysis','Job Matching','Job Alerts','Pricing'] },
              { title:'Company', links:['About','Blog','Privacy Policy','Terms of Service'] },
              { title:'Support', links:['Help Center','Contact'] },
            ].map(col=>(
              <div key={col.title}>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:14, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>{col.title}</div>
                <ul style={{ listStyle:'none', display:'flex', flexDirection:'column' as const, gap:10 }}>
                  {col.links.map(l=><li key={l}><Link href="/" style={{ fontSize:13, color:'#8A6848', textDecoration:'none' }}>{l}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ borderTop:'1px solid #3D2910', paddingTop:24, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'#5A3C20' }}>
            <span>© 2026 CVCheck · cvcheck.app</span>
            <div style={{ display:'flex', gap:20 }}>
              <Link href="/privacy" style={{ color:'#5A3C20', textDecoration:'none' }}>Privacy</Link>
              <Link href="/terms" style={{ color:'#5A3C20', textDecoration:'none' }}>Terms</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
