'use client'

import { useState, useRef, useCallback, useEffect, DragEvent } from 'react'
import { motion, type Variants } from 'framer-motion'
import { HeroDotGrid } from '@/components/HeroDotGrid'
import { RotatingText } from '@/components/RotatingText'
import { BorderTrail } from '@/components/BorderTrail'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
    <div className="score-ring-wrap">
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="5"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5" opacity="0.08" strokeDasharray={`${circ} 0`} transform="rotate(-90 68 68)"/>
        <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 68 68)" className="score-ring-arc"/>
      </svg>
      <div className="score-ring-center">
        <span className="score-ring-num" data-score-color={score >= 66 ? 'high' : score >= 40 ? 'mid' : 'low'}>{displayScore}</span>
        <span className="score-ring-denom">/100</span>
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
    <button onClick={onClick} className="unlock-btn">
      <LockIcon size={9}/> {label}
    </button>
  )
}

function DimensionBar({ label, score, max, desc, locked, onUnlock }: { label:string; score:number; max:number; desc:string; locked?:boolean; onUnlock?:()=>void }) {
  const pct = (score / max) * 100
  const color = pct >= 66 ? 'var(--score-high)' : pct >= 40 ? 'var(--score-mid)' : 'var(--score-low)'
  return (
    <div className={`dim-bar-wrap ${locked ? 'dim-bar-locked' : ''}`} onClick={locked?onUnlock:undefined}>
      <div className="dim-bar-row">
        <div>
          <span className={`dim-bar-label ${locked ? 'dim-bar-label-locked' : ''}`}>{label}</span>
          <span className="dim-bar-desc">{desc}</span>
        </div>
        {locked ? <LockIcon/> : <span className="dim-bar-score">{score}<span className="dim-bar-max">/{max}</span></span>}
      </div>
      <div className="dim-bar-track">
        <div data-bar-pct={locked?60:pct} className={`dim-bar-fill ${locked ? 'dim-bar-fill-locked' : ''}`} data-score-level={locked ? '' : pct >= 66 ? 'high' : pct >= 40 ? 'mid' : 'low'}/>
      </div>
    </div>
  )
}

function RedFlagCard({ flag, howToFixLocked, onUnlock }: { flag:{flag:string;severity:RedFlagSeverity;how_to_fix:string}; howToFixLocked:boolean; onUnlock:()=>void }) {
  const color = RED_FLAG_COLORS[flag.severity]
  const label = RED_FLAG_LABELS[flag.severity]
  return (
    <div className="flag-card" data-severity={flag.severity}>
      <div className="flag-card-row">
        <span className="flag-severity-badge" data-severity={flag.severity}>{label}</span>
        <span className="flag-card-text">{flag.flag}</span>
      </div>
      {howToFixLocked ? (
        <div onClick={onUnlock} className="flag-how-locked">
          <span className="flag-how-blurred">Review the context and add specific evidence.</span>
          <span className="flag-how-lock"><LockIcon size={10}/></span>
        </div>
      ) : flag.how_to_fix ? (
        <p className="flag-how-text"><span className="flag-how-prefix">Fix · </span>{flag.how_to_fix}</p>
      ) : null}
    </div>
  )
}

function BulletRewriteCard({ rewrite }: { rewrite: BulletRewrite }) {
  return (
    <div className="bullet-rewrite">
      <div className="bullet-rewrite-cols">
        <div className="bullet-before">
          <div className="bullet-label bullet-label-before">Before</div>
          <p className="bullet-original">{rewrite.original}</p>
        </div>
        <div className="bullet-after">
          <div className="bullet-label bullet-label-after">After</div>
          <p className="bullet-rewritten">{rewrite.rewritten}</p>
        </div>
      </div>
      <div className="bullet-why">
        <p className="bullet-why-text"><span className="bullet-why-label">Why: </span>{rewrite.why}</p>
      </div>
    </div>
  )
}

function ActionCard({ action, index, detailsLocked, onUnlock }: { action:PriorityAction; index:number; detailsLocked:boolean; onUnlock:()=>void }) {
  return (
    <div className="action-card">
      <div className="action-card-top">
        <span className="action-num">{String(index+1).padStart(2,'0')}</span>
        <div className="action-card-body">
          <p className="action-title">{action.action}</p>
          <p className="action-why">{action.why_it_matters}</p>
        </div>
      </div>
      {detailsLocked ? (
        <div onClick={onUnlock} className="action-locked">
          <LockIcon size={10}/><span className="action-locked-text">Unlock steps and example (Pro)</span>
        </div>
      ) : (
        <div className="action-how">
          {action.how && <p className="action-how-text">{action.how}</p>}
          {action.example && <p className="action-how-example">{action.example}</p>}
        </div>
      )}
    </div>
  )
}

function LockedPreview({ count, label, sublabel, onUnlock }: { count?:number|string; label:string; sublabel:string; onUnlock:()=>void }) {
  return (
    <div onClick={onUnlock} className="locked-preview">
      <div className="locked-preview-inner">
        {count !== undefined && <span className="locked-preview-count">{count}</span>}
        <div>
          <div className="locked-preview-label">{label}</div>
          <div className="locked-preview-sub">{sublabel}</div>
        </div>
      </div>
      <div className="locked-preview-btn">
        Unlock — €1.99 <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  )
}

const FIT_COLORS: Record<string,string> = { strong:'var(--score-high)', good:'#65A30D', partial:'var(--score-mid)', stretch:'var(--score-low)' }
function FitBadge({ label, score }: { label:string; score:number }) {
  const color = FIT_COLORS[label] ?? 'var(--text-secondary)'
  return (
    <span className={`fit-badge fit-badge-${label}`}>
      {score}% · {label}
    </span>
  )
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
    <div className={`job-card ${fit?.fit_label==='strong'?'job-card-strong':'job-card-normal'}`}>
      <div className="job-card-top">
        <div className="job-card-meta">
          <div className="job-title">{listing.title}</div>
          <div className="job-sub">
            <span>{listing.company}</span>
            {listing.location&&<><span className="job-sub-dot">·</span><span>{listing.location}</span></>}
            {salary&&<><span className="job-sub-dot">·</span><span className="job-salary">{salary}</span></>}
          </div>
        </div>
        {fit&&<FitBadge label={fit.fit_label} score={fit.fit_score}/>}
      </div>
      <p className={`job-desc ${expanded ? 'job-desc-expanded' : 'job-desc-clamped'}`}>{listing.description}</p>
      {listing.description.length>200&&<button className="job-show-more" onClick={()=>setExpanded(e=>!e)}>{expanded?'Show less':'Show more'}</button>}
      {fit&&fit.strengths&&fit.strengths.length>0&&(
        <div className="job-section">
          <div className="job-section-label job-section-label-success">Why you're a good fit</div>
          {fit.strengths.map((s,i)=><div key={i} className="job-section-row"><span className="icon-success">✓</span>{s}</div>)}
        </div>
      )}
      {fit&&fit.gaps&&fit.gaps.length>0&&(
        <div className="job-section">
          <div className="job-section-label job-section-label-muted">What you're missing</div>
          {fit.gaps.map((gap,i)=><div key={i} className="job-section-row"><span className="icon-danger">✕</span>{gap}</div>)}
        </div>
      )}
      {fitLocked&&fit&&(
        <div className="job-section">
          <button onClick={onUnlock} className="job-unlock-btn">Unlock skill gaps & full analysis</button>
        </div>
      )}
      <div className="job-actions">
        <a href={listing.redirect_url} target="_blank" rel="noopener noreferrer" className="job-view-btn">View job →</a>
        <button onClick={()=>!saving&&handleSave('saved')} className={`job-save-btn ${saved==='saved'?'job-save-active':''} ${saving?'job-btn-wait':''}`}>{saved==='saved'?'★':'☆'}</button>
        <button onClick={()=>!saving&&handleSave('applied')} className={`job-apply-btn ${saved==='applied'?'job-apply-active':''} ${saving?'job-btn-wait':''}`}>{saved==='applied'?'✓ Applied':'Applied?'}</button>
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
    <div className="jobs-wrap">
      <div className="jobs-header">
        <div>
          <div className="jobs-title-eyebrow">Job Matches</div>
          <h2 className="jobs-title">Roles that fit your profile</h2>
          {data?.detected_country&&<p className="jobs-subtitle">{ADZUNA_UI_SUPPORTED.has(data.detected_country)?`Jobs near you · ${data.detected_country.toUpperCase()}`:'Remote & global jobs matched to your profile'}</p>}
        </div>
        {data&&data.jobs.length>0&&(
          <div className="job-filter-row">
            {(['all','strong','good','partial','stretch'] as FilterType[]).map(f=>{
              const count=f==='all'?data.jobs.length:(counts[f]??0)
              return <button key={f} onClick={()=>setFilter(f)} className={`job-filter-btn ${filter===f?'job-filter-active':'job-filter-inactive'}`}>{f}{count>0?` (${count})`:''}</button>
            })}
          </div>
        )}
      </div>
      {state==='done'&&data&&(
        <div className="jobs-toolbar">
          <div>
            {alertState==='subscribed'?<div className="jobs-alert-success"><span>✓</span> Weekly job alerts activated</div>
            :alertState==='error'?<div className="jobs-alert-error">Failed to subscribe.</div>
            :<button id="alerts-trigger" onClick={handleAlertSubscribe} disabled={alertState==='loading'} className={`jobs-alert-btn ${alertState==='loading'?'jobs-alert-btn-loading':''}`}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {alertState==='loading'?'Activating…':'Get weekly alerts'}
            </button>}
          </div>
          <button onClick={()=>{ try{sessionStorage.removeItem(CACHE_KEY);sessionStorage.removeItem(SAVED_CACHE_KEY)}catch{};fetchJobs() }} className="jobs-refresh-btn">↻ Refresh</button>
        </div>
      )}
      {state==='loading'&&<div className="jobs-loading"><div className="jobs-loading-spinner"/>Finding matching jobs…</div>}
      {state==='error'&&<div className="jobs-error">{errMsg}<button onClick={fetchJobs} className="jobs-retry">Retry</button></div>}
      {state==='done'&&data&&(
        <div className="jobs-more-list">
          <div className="jobs-grid">
            {filteredJobs.slice(0,isPremium?filteredJobs.length:FREE_LIMIT).map(job=>(
              <JobCard key={job.listing.id} job={job} fitLocked={data.fit_locked} onUnlock={onUnlock} token={token} initialStatus={savedStatuses[job.listing.id]} onSaveChange={handleSaveChange}/>
            ))}
          </div>
          {!isPremium&&filteredJobs.length>FREE_LIMIT&&(
            <div className="jobs-locked-cta">
              <p className="jobs-unlock-title">{filteredJobs.length-FREE_LIMIT} more matching jobs</p>
              <p className="jobs-unlock-sub">Unlock all matches + skill gap analysis for every role</p>
              <button onClick={onUnlock} className="jobs-unlock-premium">Unlock with Premium — €5.99/mo</button>
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
    <div className="result-content">

      <div className="score-card">
        <div className="score-card-stripe"/>
        <div className="score-hero-inner">
          <ScoreRing score={result.total_score}/>
          <div className="score-hero-meta">
            <div className="score-hero-badges">
              <span className={`rating-badge rating-badge-${result.rating}`}>{RATING_LABELS[result.rating]}</span>
              {result.detected_domain&&result.detected_domain!=='Unknown'&&<span className="domain-badge">{LEVEL_LABELS[result.detected_level]} · {result.detected_domain}</span>}
            </div>
            <p className="score-hero-summary">{result.summary}</p>
          </div>
        </div>
        <div className="score-breakdown-inner" ref={barsRef}>
          <div className="score-breakdown-label">Score Breakdown</div>
          <div className="score-breakdown-grid">
            {SCORE_DIMENSIONS.map(({key,label,max,desc})=>(
              <DimensionBar key={key} label={label} score={(result.scores as unknown as Record<string,number>)[key]??0} max={max} desc={desc} locked={false} onUnlock={unlock}/>
            ))}
          </div>
        </div>
      </div>

      {result.quick_win && (
        <div className="quick-win">
          <div className="quick-win-icon">
            <svg width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div>
            <div className="quick-win-label">Quick Win</div>
            <p className="quick-win-text">{result.quick_win}</p>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="panel-icon">
            <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M2 20c0-4 4-7 10-7s10 3 10 7"/></svg>
          </div>
          <h2 className="panel-h2">First Impression</h2>
          <span className={`rating-badge fi-test-badge ${result.first_impression.passes_7_second_test?'fi-test-pass':'fi-test-fail'}`}>{result.first_impression.passes_7_second_test?'✓ Passes 7-second test':'✗ Fails 7-second test'}</span>
        </div>
        <div className="fi-recruiter-box">
          <p className="fi-quote">"{result.first_impression.what_recruiter_sees}"</p>
          <p className="fi-quote-sub">what a recruiter sees in 7 seconds</p>
        </div>
        <div className="grid-2">
          {[
            { label:'Tone', value: result.first_impression.tone_signal },
            { label:'Summary', value: result.first_impression.summary_verdict },
          ].map(item=>(
            <div key={item.label} className="info-cell">
              <div className="info-cell-label">{item.label}</div>
              <div className="info-cell-value">{item.value?.replace(/_/g,' ')??'—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-between">
          <div className="panel-header panel-header-sub">
            <div className="panel-icon">
              <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <h2 className="panel-h2">Impact & Achievements</h2>
          </div>
          {result.rewrites_locked&&<UnlockBtn label="Unlock rewrites — €1.99" onClick={unlock}/>}
        </div>
        <div className="impact-stats-grid">
          {[
            { label:'With metrics', value:result.impact.bullets_with_metrics, colorClass:'success', text:false },
            { label:'Without metrics', value:result.impact.bullets_without_metrics, colorClass:'danger', text:false },
            { label:'Verb quality', value:result.impact.action_verb_quality?.replace(/_/g,' ')??'—', colorClass:'primary', text:true },
          ].map((s,i)=>(
            <div key={i} className="impact-stat">
              <div className={`impact-stat-value ${s.text?'impact-stat-value-text':''}`} data-color={s.colorClass}>{s.value}</div>
              <div className="impact-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
        {result.rewrites_locked
          ? <LockedPreview count={Math.min(result.impact.bullets_without_metrics||2,3)} label="bullet rewrites ready" sublabel="Your weakest bullets rewritten with Action + Result + Numbers" onUnlock={unlock}/>
          : <div className="impact-rewrites-list">{result.impact.rewrites.map((rw,i)=><BulletRewriteCard key={i} rewrite={rw}/>)}</div>
        }
      </div>

      <div className="panel">
        <div className="panel-header-between">
          <div className="panel-header panel-header-sub">
            <div className="panel-icon">
              <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </div>
            <h2 className="panel-h2">ATS Compatibility</h2>
          </div>
          {result.keywords_locked&&<UnlockBtn label="See missing keywords — €1.99" onClick={unlock}/>}
        </div>
        <div className="ats-meta">
          <span className={`ats-verdict ats-verdict-${result.ats.verdict}`}>{ATS_VERDICT_LABELS[result.ats.verdict]}</span>
          <span className="ats-searchable">Title searchable: <span className={result.ats.title_is_searchable?'text-success':'text-danger'}>{result.ats.title_is_searchable?'Yes':'No'}</span></span>
          {result.ats.notes&&<span className="ats-notes">{result.ats.notes}</span>}
        </div>
        {result.keywords_locked
          ? <LockedPreview count="5" label="missing ATS keywords for your domain" sublabel="The exact terms recruiters search that aren't in your CV" onUnlock={unlock}/>
          : result.ats.missing_keywords.length>0&&(
              <div>
                <div className="subsection-label">Missing Keywords</div>
                <div className="keyword-list">
                  {result.ats.missing_keywords.map(kw=><span key={kw} className="keyword-tag keyword-missing">{kw}</span>)}
                </div>
              </div>
            )
        }
      </div>

      {result.red_flags.length>0&&(
        <div className="panel">
          <div className="panel-header-between">
            <div className="panel-header panel-header-sub">
              <div className="panel-icon-danger">
                <svg width="13" height="13" fill="none" stroke="var(--score-low)" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h2 className="panel-h2">Red Flags</h2>
              <span className="flag-count">{result.red_flags.length}</span>
            </div>
            {result.how_to_fix_locked&&<UnlockBtn label="Unlock fixes — €1.99" onClick={unlock}/>}
          </div>
          <div className="red-flags-list">
            {result.red_flags.map((flag,i)=><RedFlagCard key={i} flag={flag} howToFixLocked={result.how_to_fix_locked} onUnlock={unlock}/>)}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="panel-icon">
            <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          </div>
          <h2 className="panel-h2">Career Story</h2>
        </div>
        {result.career_story.trajectory_detected&&(
          <div className="trajectory-box">
            {result.career_story.trajectory_detected}
          </div>
        )}
        <div className="grid-2">
          {[
            { label:'Narrative', value: result.career_story.narrative_thread?.replace(/_/g,' ') },
            { label:'Seniority match', value: result.career_story.seniority_match?.replace(/_/g,' ') },
            { label:'Progression', value: result.career_story.progression_clear ? 'Clear' : 'Unclear', color: result.career_story.progression_clear ? 'var(--score-high)' : 'var(--score-low)' },
            { label:'Gaps', value: result.gaps_locked ? '—' : (result.career_story.gaps_or_transitions||'None detected') },
          ].map(item=>(
            <div key={item.label} className="info-cell">
              <div className="info-cell-label">{item.label}</div>
              <div className={`info-cell-value ${(item as {color?:string}).color==='var(--score-high)'?'text-success':(item as {color?:string}).color==='var(--score-low)'?'text-danger':''}`}>{item.value??'—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-icon">
            <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h2 className="panel-h2">Credibility</h2>
        </div>
        {result.credibility.signals_present?.length>0&&(
          <div className="credibility-present">
            <div className="subsection-label-success">✓ Signals Present</div>
            <div className="keyword-list">
              {result.credibility.signals_present.map((s:string)=><span key={s} className="keyword-tag keyword-present">{s}</span>)}
            </div>
          </div>
        )}
        {!result.missing_signals_locked&&result.credibility.signals_missing?.length>0&&(
          <div>
            <div className="subsection-label-muted">What would strengthen credibility</div>
            <div className="keyword-list">
              {result.credibility.signals_missing.map((s:string)=><span key={s} className="keyword-tag keyword-neutral">{s}</span>)}
            </div>
          </div>
        )}
        {result.credibility.notes&&<p className="credibility-notes">{result.credibility.notes}</p>}
      </div>

      {(result.format?.issues?.length>0||result.buzzwords_detected?.length>0)&&(
        <div className="panel">
          <div className="panel-header">
            <div className="panel-icon">
              <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
            </div>
            <h2 className="panel-h2">Format & Language</h2>
            <div className="format-badges">
              <span className="format-badge">{result.format?.length_verdict?.replace(/_/g,' ')} · {result.format?.recommended_pages}p recommended</span>
              <span className={`format-badge format-scan-${result.format?.scannability==='easy'?'easy':result.format?.scannability==='hard'?'hard':'mid'}`}>{result.format?.scannability} to scan</span>
            </div>
          </div>
          {result.format?.issues?.length>0&&(
            <div className="format-issue-list">
              <div className="subsection-label-muted">Format Issues</div>
              <div>
                {result.format.issues.map((issue:string,i:number)=>(
                  <div key={i} className="format-issue-row">
                    <span className="icon-warning">⚠</span>{issue}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.buzzwords_detected?.filter((b:{word:string})=>b.word).length>0&&(
            <div>
              <div className="subsection-label-muted">Empty Buzzwords Detected</div>
              <div className="keyword-list">
                {result.buzzwords_detected.filter((b:{word:string})=>b.word).map((b:{word:string;location:string},i:number)=>(
                  <span key={i} className="keyword-tag keyword-warning" title={b.location}>{b.word}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header-between">
          <div className="panel-header panel-header-sub">
            <div className="panel-icon-accent">
              <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            </div>
            <h2 className="panel-h2">Top 3 Priority Actions</h2>
          </div>
          {result.actions_locked&&<UnlockBtn label="Unlock how-to + examples — €1.99" onClick={unlock}/>}
        </div>
        <div className="top-3-list">
          {result.top_3_actions.map((action,i)=><ActionCard key={i} action={action} index={i} detailsLocked={result.actions_locked} onUnlock={unlock}/>)}
        </div>
      </div>

      {!isPro&&(
        <div className="upgrade-cta">
          <div className="upgrade-cta-stripe"/>
          <div>
            <p className="upgrade-cta-title">You're missing the part that actually helps.</p>
            <p className="upgrade-cta-body">Pro shows your bullet rewrites, how to fix every red flag, ATS keywords, and 3 priority actions with examples. €1.99, once.</p>
          </div>
          <div className="upgrade-cta-actions">
            <button onClick={()=>setShowUpgradeModal(true)} className="upgrade-btn-primary">Unlock Pro — €1.99</button>
            <button onClick={()=>setShowPlansModal(true)} className="upgrade-btn-secondary">See all plans</button>
          </div>
        </div>
      )}

      <JobMatchesSection result={result} token={token} isPremium={result.tier==='premium'||result.tier==='pro'} onUnlock={()=>setShowPlansModal(true)}/>

      {!user&&<div className="signin-prompt"><button onClick={()=>setShowAuthModal(true)} className="signin-link">Sign in</button> to save this to your history. Free for all accounts.</div>}
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
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="plans-modal">
        <div className="plans-modal-header">
          <div>
            <h2 className="plans-modal-title">Plans</h2>
            <p className="plans-modal-sub">See your score free. Pay €1.99 once to fix it.</p>
          </div>
          <button onClick={onClose} className="plans-modal-close">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="plans-modal-body">
          {(['free','pro','premium'] as const).map(pk=>{
            const p=PLAN_DEFS[pk]; const isCurrent=tier===pk
            return (
              <div key={pk} className={`plan-card ${pk==='pro'?'plan-card-featured':'plan-card-normal'}`}>
                <div className="plan-card-header">
                  <div className="plan-card-labels">
                    <span className={`plan-tier-label plan-tier-${pk}`}>{p.label}</span>
                    {pk==='pro'&&<span className="plan-badge-popular">Popular</span>}
                    {isCurrent&&<span className="plan-badge-current">Current</span>}
                  </div>
                  <div className="plan-card-price">
                    <span className="plan-price-num">{p.price}</span>
                    {p.period&&<span className="plan-price-period">{p.period}</span>}
                  </div>
                </div>
                <div className="plan-card-body">
                  <ul className="plan-features">
                    {p.features.map(f=><li key={f} className="plan-feature"><svg width="12" height="12" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" className="svg-shrink"><polyline points="20 6 9 17 4 12"/></svg>{f}</li>)}
                  </ul>
                  {!isCurrent&&pk!=='free'&&<button onClick={()=>handleBuy(pk)} disabled={!!buying} className="plan-cta">{buying===pk?'Loading…':pk==='pro'?'Get Pro — €1.99':'Get Premium — €5.99/mo'}</button>}
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
  return (
    <div ref={ref} className="account-dropdown">
      <button onClick={()=>setOpen(v=>!v)} className={`account-toggle ${open?'account-toggle-open':''}`} aria-haspopup="menu" aria-expanded={open}>
        <span className="account-avatar">{initials}</span>
        <span className="account-email">{user.email?.split('@')[0]}</span>
        <svg width="10" height="10" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" viewBox="0 0 24 24" className={`account-chevron ${open?'account-chevron-open':''}`}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&(
        <div className="dropdown-menu" role="menu">
          <div className="dropdown-header">
            <div className="dropdown-email">{user.email}</div>
            <div className={`dropdown-tier dropdown-tier-${tier}`}>{meta.label} plan</div>
          </div>
          <div className="dropdown-section">
            <button role="menuitem" className="dd-row" onClick={()=>{onOpenAccount();setOpen(false)}}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>My account</button>
            <button role="menuitem" className="dd-row" onClick={()=>{router.push('/history');setOpen(false)}}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>History</button>
            <button role="menuitem" className="dd-row" onClick={()=>{router.push('/history?tab=saved');setOpen(false)}}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Saved jobs</button>
            <button role="menuitem" className="dd-row" onClick={()=>{onOpenPlans();setOpen(false)}}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Plans</button>
          </div>
          <div className="dropdown-section dropdown-divider">
            <button role="menuitem" className="dd-danger" onClick={()=>{onSignOut();setOpen(false)}}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}

const LOADING_STEPS = ['Reading your CV…','Running the 7-second test…','Checking ATS compatibility…','Writing your rewrites & actions…']

const HERO_STAGGER = 0.1

const heroKickerVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}
const heroH1Variants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: HERO_STAGGER } },
}
const heroPVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: HERO_STAGGER * 2 } },
}
const heroCtaRowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: HERO_STAGGER * 3 } },
}
const heroCtaMetaVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: HERO_STAGGER * 4 } },
}
const heroWorksWithVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: HERO_STAGGER * 5 } },
}
const heroMockupVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, delay: HERO_STAGGER * 6, ease: [0.16, 1, 0.3, 1] },
  },
}

// Sources analyzed, each with a monochrome brand mark (inherits currentColor)
const HERO_WORKS_ITEMS = [
  {
    name: 'LinkedIn',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.34 18.34v-7.7H5.78v7.7h2.56zM7.06 9.5a1.49 1.49 0 1 0 0-2.98 1.49 1.49 0 0 0 0 2.98zm11.28 8.84v-4.22c0-2.26-1.21-3.31-2.82-3.31-1.3 0-1.88.72-2.2 1.22v-1.05h-2.56c.03.72 0 7.7 0 7.7h2.56v-4.3c0-.23.02-.46.08-.62.18-.46.6-.94 1.3-.94.92 0 1.29.7 1.29 1.72v4.14h2.55z"/></svg>
    ),
  },
  {
    name: 'PDF CVs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h2M8 17h5"/></svg>
    ),
  },
  {
    name: 'Portfolio sites',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
    ),
  },
  {
    name: 'GitHub profiles',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.52.1.71-.23.71-.5v-1.78c-2.92.63-3.54-1.41-3.54-1.41-.48-1.21-1.16-1.53-1.16-1.53-.95-.65.07-.64.07-.64 1.05.07 1.6 1.08 1.6 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.18 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.88 1.07a9.9 9.9 0 0 1 5.24 0c2-1.35 2.88-1.07 2.88-1.07.57 1.45.21 2.52.1 2.79.67.74 1.07 1.67 1.07 2.82 0 4.02-2.45 4.9-4.79 5.16.38.33.71.97.71 1.96v2.9c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5z"/></svg>
    ),
  },
  {
    name: 'Notion pages',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 17V8l6 9V8"/></svg>
    ),
  },
]

function useScrollReveal(active: boolean) {
  useEffect(() => {
    if (!active) return
    const els = document.querySelectorAll<HTMLElement>('[data-sr]')
    if (!els.length) return
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.srDelay ?? '0'
          el.style.transitionDelay = `${delay}s`
          el.classList.add('visible')
          obs.unobserve(el)
        }
      })
    }, { threshold: 0.12 })
    els.forEach(el => {
      el.classList.add('sr')
      obs.observe(el)
    })
    return () => obs.disconnect()
  }, [active])
}

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
  const [appState, setAppState] = useState<AppState>('idle')
  const [result, setResult]     = useState<GatedAnalysisResult|null>(null)
  const appStateRef = useRef<AppState>('idle')
  const resultRef   = useRef<GatedAnalysisResult|null>(null)

  appStateRef.current = appState
  resultRef.current   = result

  const safeSetAppState = (s: AppState) => { appStateRef.current = s; setAppState(s) }
  const safeSetResult   = (r: GatedAnalysisResult|null) => { resultRef.current = r; setResult(r) }

  useEffect(() => {
    if (appStateRef.current === 'result' && appState !== 'result') {
      setAppState('result')
      if (resultRef.current) setResult(resultRef.current)
    }
  })
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

  const submit = useCallback(async () => {
    if (mode==='url'&&!url.trim()) return
    if (mode==='pdf'&&!file) return
    safeSetAppState('loading'); setError(''); safeSetResult(null)
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
        if (res.status===403&&data.error==='free_limit_reached'){setShowUpgradeModal(true);safeSetAppState('idle');return}
        if (res.status===429){const mins=data.retryAfter?Math.ceil(data.retryAfter/60):60;setError(`Too many analyses. Try again in ${mins} minute${mins!==1?'s':''}.`);safeSetAppState('error');return}
        throw new Error(data.error||'Analysis failed')
      }
      appStateRef.current = 'result'; resultRef.current = data; setResult(data); setAppState('result'); setAnalysisCount(c=>c+1)
      setTimeout(() => { const el = document.getElementById('result-section'); if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); else window.scrollTo({top:0, behavior:'smooth'}) }, 100)
      if (!user) setPendingSave(data); else setSavedToHistory(true)
    } catch (err) { setError(err instanceof Error?err.message:'Something went wrong'); safeSetAppState('error') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, url, file, session])

  const reset = () => { appStateRef.current='idle'; resultRef.current=null; setAppState('idle'); setResult(null); setError('');setUrl('');setFile(null);setPendingSave(null);setSavedToHistory(false);setShareUrl(null) }
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
  const scrollToUpload = () => window.scrollTo({top:0, behavior:'smooth'})
  const scrollToAlerts = () => {
    const trigger = document.getElementById('alerts-trigger')
    if (trigger) {
      trigger.scrollIntoView({behavior:'smooth', block:'center'})
      setTimeout(() => trigger.click(), 600)
    } else {
      window.scrollTo({top:0, behavior:'smooth'})
    }
  }

  useScrollReveal(appState === 'idle' || appState === 'error')

  return (
    <div className="page-root">
      {showAuthModal    && <AuthModal onClose={()=>setShowAuthModal(false)}/>}
      {showUpgradeModal && <UpgradeModal onClose={()=>setShowUpgradeModal(false)} roastId={result?.analysis_id} userId={user?.id} userEmail={user?.email}/>}
      {showAccountModal && user && <AccountModal onClose={()=>setShowAccountModal(false)} userId={user.id} userEmail={user.email??''} onUpgrade={()=>{setShowAccountModal(false);setShowPlansModal(true)}} onSignOut={()=>{setShowAccountModal(false);handleSignOut()}}/>}
      {showPlansModal   && <PlansModal tier={tier} userId={user?.id} userEmail={user?.email} onClose={()=>setShowPlansModal(false)} onBuy={()=>{setShowPlansModal(false);setShowUpgradeModal(true)}}/>}

      <nav className="navbar">
        <div className="navbar-logo">
          <img src="/logo.png" width="32" height="32" alt="CVCheck" className="logo-img" />
          CVCheck
        </div>
        <ul className="navbar-links nav-links-desktop">
          {[['CV Analysis','#analysis'],['Job Matching','#jobs'],['Job Alerts','#alerts'],['Pricing','#pricing'],['FAQ','/faq']].map(([label,href])=>(
            <li key={href}><button onClick={()=>{ if (href.startsWith('#')) { const el = document.querySelector(href); if (el) { el.scrollIntoView({behavior:'smooth'}); return } } router.push(href) }} className="nav-link">{label}</button></li>
          ))}
        </ul>
        <div className="navbar-right">
          {!authLoading&&(user?(
            <AccountDropdown user={user} tier={tier} onOpenAccount={()=>setShowAccountModal(true)} onOpenPlans={()=>setShowPlansModal(true)} onSignOut={handleSignOut}/>
          ):(
            <>
              <button onClick={()=>setShowAuthModal(true)} className="nav-btn btn-outline nav-btn-login">Log in</button>
              <button onClick={()=>setShowAuthModal(true)} className="nav-btn-accent btn-primary shimmerBtn">Sign up</button>
            </>
          ))}
        </div>
      </nav>

      <main className="page-main">

        <section className="section-hero">
          <HeroDotGrid />
          <div className="hero-centered-wrap">

            <motion.div className="hero-kicker" variants={heroKickerVariants} initial="hidden" animate="visible">
              Announcing our free CV scoring engine
            </motion.div>

            <motion.h1 className="hero-h1" variants={heroH1Variants} initial="hidden" animate="visible">
              Your CV, analyzed.<br/>
              <span className="hero-h1-accent"><RotatingText texts={['Brutally Honest.', 'ATS-Checked.', 'Interview-Ready.', 'Scored /100.']} /></span>
            </motion.h1>

            <motion.p className="hero-p" variants={heroPVariants} initial="hidden" animate="visible">
              Upload your CV and get a full AI diagnosis: score, red flags, ATS gaps, and rewritten bullets. In seconds.
            </motion.p>

            <motion.div className="hero-cta-row" variants={heroCtaRowVariants} initial="hidden" animate="visible">
              {mode==='url' ? (
                <>
                  <input
                    type="url"
                    placeholder="linkedin.com/in/yourname or portfolio URL"
                    value={url}
                    onChange={e=>setUrl(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&submit()}
                    className="hero-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button onClick={submit} disabled={!url.trim()||appState==='loading'} className="hero-cta-btn shimmerBtn">
                    Analyze my CV
                  </button>
                </>
              ) : (
                <>
                  <label className="hero-input hero-input-file" onClick={()=>fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f?.type==='application/pdf')setFile(f)}} className="hidden"/>
                    {file ? file.name : 'Drop your CV PDF here'}
                  </label>
                  <button onClick={submit} disabled={!file||appState==='loading'} className="hero-cta-btn shimmerBtn">
                    Analyze my CV
                  </button>
                </>
              )}
            </motion.div>

            <motion.div className="hero-cta-meta" variants={heroCtaMetaVariants} initial="hidden" animate="visible">
              <div className="hero-cta-toggle">
                <button onClick={()=>setMode('url')} className={`hero-toggle-btn ${mode==='url'?'hero-toggle-active':''}`}>URL</button>
                <button onClick={()=>setMode('pdf')} className={`hero-toggle-btn ${mode==='pdf'?'hero-toggle-active':''}`}>PDF</button>
              </div>
              <span className="hero-cta-meta-text">
                {tier==='free'&&analysisCount>=1
                  ? <><button className="footer-upgrade-link" onClick={()=>setShowUpgradeModal(true)}>Unlock Pro for €1.99</button> to analyze again</>
                  : '1 free scan · no account required'}
              </span>
            </motion.div>

            {(appState==='error'||appState==='idle')&&error&&(
              <div className="error-box hero-error">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="error-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <motion.div className="hero-works-with" variants={heroWorksWithVariants} initial="hidden" animate="visible">
              <span className="hero-works-label">ANALYZES</span>
              {HERO_WORKS_ITEMS.map((item, i, arr)=>(
                <span key={item.name} className="hero-works-row">
                  <span className="hero-works-item">{item.icon}{item.name}</span>
                  {i < arr.length - 1 && <span className="hero-works-sep">·</span>}
                </span>
              ))}
            </motion.div>

            <motion.div className="hero-mockup-wrap" variants={heroMockupVariants} initial="hidden" animate="visible">
              <div className="mockup-window mockupLift">
                <div className="mockup-titlebar">
                  <div className="mockup-dots">
                    <div className="mockup-dot-r"/><div className="mockup-dot-y"/><div className="mockup-dot-g"/>
                  </div>
                  <div className="mockup-bar"/>
                </div>
                <div className="analysis-mockup-grid">
                  <div className="analysis-mockup-left">
                    <div className="lmock-score-hero">
                      <div className="lmock-score-wrap">
                        <svg width="88" height="88" viewBox="0 0 88 88">
                          <circle cx="44" cy="44" r="36" fill="none" stroke="var(--bg-muted)" strokeWidth="5"/>
                          <circle cx="44" cy="44" r="36" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="164 226" transform="rotate(-90 44 44)"/>
                        </svg>
                        <div className="score-ring-center">
                          <div className="lmock-score-num">73</div>
                          <div className="lmock-score-denom">/100</div>
                        </div>
                      </div>
                      <div>
                        <div className="lmock-score-label">Good</div>
                        <div className="lmock-score-desc">Strong foundation. 3 critical gaps holding you back.</div>
                      </div>
                    </div>
                    {[{label:'First Impression',pct:73},{label:'Impact & Achievements',pct:68},{label:'ATS Compatibility',pct:70},{label:'Red Flags',pct:70},{label:'Career Story',pct:60}].map(d=>(
                      <div key={d.label} className="lmock-bar-row">
                        <div className="lmock-bar-header"><span>{d.label}</span><span className="lmock-bar-pct">{d.pct}%</span></div>
                        <div className="lmock-bar-track"><div className={`lmock-bar-fill pct-${Math.round(d.pct/5)*5}`}/></div>
                      </div>
                    ))}
                  </div>
                  <div className="lmock-right">
                    <div>
                      <div className="section-label">Bullet Rewrite</div>
                      <div className="lmock-bullet-wrap">
                        <div className="lmock-bullet-before">
                          <div className="bullet-label bullet-label-before">Before</div>
                          <p className="lmock-bullet-p lmock-bullet-p-before">Responsible for managing social media accounts and creating content for various platforms.</p>
                        </div>
                        <div className="lmock-bullet-after">
                          <div className="bullet-label bullet-label-after">After</div>
                          <p className="lmock-bullet-p lmock-bullet-p-after">Grew LinkedIn following 340% in 6 months by launching a weekly video series, driving 12k monthly impressions.</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="section-label">Red Flags</div>
                      <div className="lmock-flags-mt">
                        {[{sev:'critical',text:'No quantified achievements in last 3 roles'},{sev:'warning',text:'Generic objective statement adds no value'},{sev:'info',text:'Skills section lacks ATS-relevant keywords'}].map(f=>(
                          <div key={f.text} className="lmock-flag-row">
                            <div className={f.sev==='critical'?'lmock-flag-dot-high':f.sev==='warning'?'lmock-flag-dot-mid':'lmock-flag-dot-info'}/>
                            <span className="lmock-flag-text">{f.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {appState==='loading'&&(
          <div className="loading-overlay">
            <div className="loading-inner">
              <div className="loading-spinner"/>
              <p className="loading-title">Analyzing your CV…</p>
              <div className="loading-steps">
                {LOADING_STEPS.map((step,i)=>(
                  <div key={step} className={`loading-step ${i===loadingStep?'loading-step-active':''} ${i>loadingStep?'loading-step-pending':''}`}>
                    <div className={`loading-step-dot ${i===loadingStep?'loading-step-dot-active':''}`}/>
                    {step}
                  </div>
                ))}
              </div>
              <div className="loading-dots">
                <div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/>
              </div>
            </div>
          </div>
        )}

        {appState==='result'&&result&&(
          <section id="result-section" className="result-section">
            <div className="result-topbar">
              <button onClick={reset} className="topbar-btn">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                New analysis
              </button>
              {user&&savedToHistory&&(
                <button onClick={()=>router.push('/history')} className="topbar-btn topbar-btn-saved">
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Saved · View history
                </button>
              )}
              {!user&&<button onClick={()=>setShowAuthModal(true)} className="topbar-btn">Sign in to save</button>}
              <button onClick={copyShare} disabled={shareLoading} className={`topbar-btn topbar-btn-share share-btn ${shareLoading?'topbar-btn-loading':''}`}>
                {copied?<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Link copied!</>:shareLoading?<>Generating…</>:<><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share score</>}
              </button>
            </div>
            <ResultContent result={result} isPro={isPro} user={user} token={session?.access_token??null} setShowUpgradeModal={setShowUpgradeModal} setShowPlansModal={setShowPlansModal} setShowAuthModal={setShowAuthModal}/>
          </section>
        )}

        {(appState==='idle'||appState==='error')&&(<>

          <div className="trust-strip">
            <div className="trust-strip-inner">
              {[
                '7 scoring dimensions',
                'ATS-tested',
                'No signup to start',
                'Results in seconds',
              ].map(t=>(
                <span key={t} className="trust-item">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <section id="analysis" className="landing-section landing-section-elevated">
            <div className="section-wrap-md">
              <div className="section-head">
                <div data-sr data-sr-delay="0" className="eyebrow-badge">AI CV Analysis</div>
                <h2 data-sr data-sr-delay="0.08" className="section-h2">Every recruiter bias, every ATS gap. Exposed.</h2>
                <p data-sr data-sr-delay="0.16" className="section-body">CVCheck reads your CV the way a recruiter does in 7 seconds, then goes deeper: weak verbs, missing keywords, and credibility gaps across 7 dimensions.</p>
                <button data-sr data-sr-delay="0.22" onClick={scrollToUpload} className="shimmerBtn btn-primary section-btn">Analyze My CV for Free ↑</button>
              </div>

              <div data-sr data-sr-delay="0.28" className="mockup-window mockupLift">
                <div className="mockup-titlebar">
                  <div className="mockup-dots">
                    <div className="mockup-dot-r"/><div className="mockup-dot-y"/><div className="mockup-dot-g"/>
                  </div>
                  <div className="mockup-bar"/>
                </div>
                <div className="analysis-mockup-grid">
                  <div className="analysis-mockup-left">
                    <div className="lmock-score-hero">
                      <div className="lmock-score-wrap">
                        <svg width="88" height="88" viewBox="0 0 88 88">
                          <circle cx="44" cy="44" r="36" fill="none" stroke="var(--bg-muted)" strokeWidth="5"/>
                          <circle cx="44" cy="44" r="36" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="164 226" transform="rotate(-90 44 44)"/>
                        </svg>
                        <div className="score-ring-center">
                          <div className="lmock-score-num">73</div>
                          <div className="lmock-score-denom">/100</div>
                        </div>
                      </div>
                      <div>
                        <div className="lmock-score-label">Good</div>
                        <div className="lmock-score-desc">Strong foundation. 3 critical gaps holding you back.</div>
                      </div>
                    </div>
                    {[{label:'First Impression',pct:73},{label:'Impact & Achievements',pct:68},{label:'ATS Compatibility',pct:70},{label:'Red Flags',pct:70},{label:'Career Story',pct:60}].map(d=>(
                      <div key={d.label} className="lmock-bar-row">
                        <div className="lmock-bar-header"><span>{d.label}</span><span className="lmock-bar-pct">{d.pct}%</span></div>
                        <div className="lmock-bar-track"><div className={`lmock-bar-fill pct-${Math.round(d.pct/5)*5}`}/></div>
                      </div>
                    ))}
                  </div>
                  <div className="lmock-right">
                    <div>
                      <div className="section-label">Bullet Rewrite</div>
                      <div className="lmock-bullet-wrap">
                        <div className="lmock-bullet-before">
                          <div className="bullet-label bullet-label-before">Before</div>
                          <p className="lmock-bullet-p lmock-bullet-p-before">Worked on improving the onboarding experience for new users.</p>
                        </div>
                        <div className="lmock-bullet-after">
                          <div className="bullet-label bullet-label-after">After</div>
                          <p className="lmock-bullet-p lmock-bullet-p-after">Redesigned onboarding for 12k users, cutting drop-off 34% in 3 months.</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="section-label">ATS Keywords</div>
                      <div className="keyword-list">
                        {['Figma ✓','UX Research ✓','Prototyping ✓'].map(k=><span key={k} className="keyword-tag keyword-present">{k}</span>)}
                        {['Design Systems ✗','A/B Testing ✗'].map(k=><span key={k} className="keyword-tag keyword-missing">{k}</span>)}
                      </div>
                    </div>
                    <div className="lmock-flags-mt">
                      <div className="section-label">Red Flags</div>
                      {[{sev:'high',text:'Bullets lack measurable outcomes'},{sev:'medium',text:'No professional summary section'}].map(f=>(
                        <div key={f.text} className="lmock-flag-row">
                          <div className={f.sev==='high'?'lmock-flag-dot-high':'lmock-flag-dot-mid'}/>
                          {f.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="jobs" className="landing-section landing-section-base">
            <div className="section-wrap-md">
              <div className="section-head">
                <div data-sr data-sr-delay="0" className="eyebrow-badge">Job Matching</div>
                <h2 data-sr data-sr-delay="0.08" className="section-h2">Jobs that actually fit, with a score to prove it.</h2>
                <p data-sr data-sr-delay="0.16" className="section-body">CVCheck automatically matches you with relevant roles from Adzuna and Remotive. Premium users see a full fit score, strengths, and gaps for every job.</p>
                <button data-sr data-sr-delay="0.22" onClick={scrollToUpload} className="shimmerBtn btn-primary section-btn">See My Matched Jobs ↑</button>
              </div>
              <div data-sr data-sr-delay="0.3" className="mockup-window mockupLift">
                <div className="mockup-titlebar">
                  <div className="mockup-dots">
                    <div className="mockup-dot-r"/><div className="mockup-dot-y"/><div className="mockup-dot-g"/>
                  </div>
                  <div className="mockup-bar"/>
                </div>
                <div className="lmock-jobs-grid">
                  <div className="lmock-jobs-left">
                    <div className="lmock-jobs-filters">
                      {['All (7)','Strong (3)','Good (2)','Partial (2)'].map((f,i)=>(
                        <span key={f} className={`job-filter-btn ${i===0?'job-filter-active':'job-filter-inactive'}`}>{f}</span>
                      ))}
                    </div>
                    {[
                      {init:'FG',title:'Sr. Product Designer',co:'Figma',loc:'Remote EU',sal:'€80k–110k',fit:87,isTop:true},
                      {init:'ZL',title:'UX Design Lead',co:'Zalando',loc:'Berlin, DE',sal:'€70k–90k',fit:74,isTop:false},
                      {init:'MZ',title:'Design Lead',co:'Monzo',loc:'London, UK',sal:'€85k–105k',fit:91,isTop:false},
                    ].map((j,i)=>(
                      <div key={j.title} className={`lmockup-job-row ${j.isTop?'lmockup-job-row-top':''}`}>
                        <div className={`lmockup-job-avatar ${j.isTop?'lmockup-job-avatar-top':''}`}>{j.init}</div>
                        <div className="job-card-meta">
                          <div className="job-title">{j.title}</div>
                          <div className="lmock-job-co">{j.co} · {j.loc}</div>
                          <div className="lmock-job-sal">{j.sal}</div>
                        </div>
                        <span className={`lmockup-fit-pct ${j.fit>=80?'lmockup-fit-high':'lmockup-fit-mid'}`}>{j.fit}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="lmock-job-detail">
                    <div className="lmock-job-detail-header">
                      <div className="lmock-job-detail-title">Sr. Product Designer</div>
                      <div className="lmock-job-detail-sub">Figma · Remote EU · €80k–110k</div>
                      <div className="lmock-match-badge">87% · Strong Match</div>
                    </div>
                    <div className="lmock-detail-section">
                      <div className="subsection-label-success">✓ Strengths</div>
                      {['Strong portfolio & Figma proficiency','User research background matches'].map(s=><div key={s} className="job-section-row"><span className="icon-success">✓</span>{s}</div>)}
                    </div>
                    <div className="lmock-detail-section">
                      <div className="subsection-label-muted">Gaps</div>
                      {['Design Systems exp. needed','A/B Testing not mentioned'].map(s=><div key={s} className="job-section-row"><span className="icon-danger">✕</span>{s}</div>)}
                    </div>
                    <div>
                      <div className="subsection-label-muted">Skill Match</div>
                      {[{label:'Figma',pct:92},{label:'Design Systems',pct:38},{label:'User Research',pct:80}].map(s=>(
                        <div key={s.label} className="skill-bar-row">
                          <div className="skill-bar-header"><span>{s.label}</span><span className={s.pct<50?'skill-pct-low':'skill-pct-high'}>{s.pct}%</span></div>
                          <div className="skill-bar-track"><div className={`skill-bar-fill ${s.pct<50?'skill-bar-fill-low':'skill-bar-fill-high'} pct-${Math.round(s.pct/5)*5}`}/></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="alerts" className="section-alerts">
            <div className="section-wrap-md">
              <div className="section-head">
                <div data-sr data-sr-delay="0" className="eyebrow-badge">Job Alerts</div>
                <h2 data-sr data-sr-delay="0.08" className="section-h2">New matched jobs in your inbox every Monday.</h2>
                <p data-sr data-sr-delay="0.16" className="section-body">Subscribe once and get weekly job alerts tailored to your CV's domain and level, with fit scores so you only open the ones worth your time.</p>
                <button data-sr data-sr-delay="0.22" onClick={scrollToAlerts} className="shimmerBtn btn-primary section-btn">Enable Job Alerts ↓</button>
              </div>

              <div data-sr data-sr-delay="0.3" className="mockup-window mockupLift">
                <div className="mockup-titlebar">
                  <div className="mockup-dots">
                    <div className="mockup-dot-r"/><div className="mockup-dot-y"/><div className="mockup-dot-g"/>
                  </div>
                  <div className="mockup-bar"/>
                </div>
                <div className="lmock-alerts">
                  <div className="lmock-alerts-header">
                    <div className="lmock-alerts-avatar">
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <div className="lmock-alerts-headtext">
                      <div className="lmock-alerts-title">CVCheck Weekly Digest</div>
                      <div className="lmock-alerts-meta">Monday, 09:00 · 3 new matches</div>
                    </div>
                  </div>
                  {[{title:'Sr. Product Designer',co:'Figma',salary:'€80k–110k',fit:87},{title:'UX Design Lead',co:'Zalando',salary:'€70k–90k',fit:74}].map(j=>(
                    <div key={j.title} className="lmock-alert-job">
                      <div>
                        <div className="lmock-alert-job-title">{j.title} · {j.co}</div>
                        <div className="lmock-alert-job-sub">{j.salary} · Remote</div>
                      </div>
                      <span className="lmock-alert-fit">{j.fit}% fit</span>
                    </div>
                  ))}
                  <div className="lmock-alerts-btns">
                    <button className="lmock-alerts-btn-primary">View All Jobs →</button>
                    <button className="lmock-alerts-btn-secondary">Unsubscribe</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="steps-section">
            <div className="section-wrap-md">
              <div className="section-head">
                <div data-sr data-sr-delay="0" className="eyebrow-badge">How it works</div>
                <h2 data-sr data-sr-delay="0.08" className="section-h2">Done before your coffee gets cold.</h2>
              </div>

              <div className="steps-grid steps-grid-mt">
                {[
                  {n:'01',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>, title:'Upload Your CV', desc:'Drop a PDF or paste a URL. No account needed to start.'},
                  {n:'02',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>, title:'Get Your Score', desc:'AI scores 7 dimensions and flags every red flag in seconds.'},
                  {n:'03',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, title:'Fix & Rewrite', desc:'Get AI-rewritten bullets, missing keywords, and how-to fixes.'},
                  {n:'04',icon:<svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>, title:'Apply Smarter', desc:'Match to jobs with a fit score. Get weekly alerts. Land interviews.'},
                ].map((s,i)=>(
                  <div key={s.n} data-sr data-sr-delay={`${i * 0.1}`} className="step-card card-hover">
                    <div className="step-icon">{s.icon}</div>
                    <div className="step-num">STEP {s.n}</div>
                    <div className="step-title">{s.title}</div>
                    <div className="step-desc">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="landing-section landing-section-elevated">
            <div className="section-wrap-md">
              <div className="section-head">
                <div data-sr data-sr-delay="0" className="eyebrow-badge">Domains</div>
                <h2 data-sr data-sr-delay="0.08" className="section-h2">Works for every domain and level.</h2>
                <p data-sr data-sr-delay="0.16" className="section-body">CVCheck detects your field and seniority automatically.</p>
              </div>
              <div className="domain-tags-wrap">
                {['Product Design','Engineering','Product Management','Marketing','Data Science','UX Research','Frontend Dev','Backend Dev','DevOps','Sales','Finance','Operations','Content','HR','Consulting','Startup Founder'].map(d=>(
                  <span key={d} className="domain-tag">{d}</span>
                ))}
              </div>
            </div>
          </section>

          <section id="pricing" className="pricing-section">
            <div className="section-wrap-md">
              <div className="section-head">
                <div data-sr data-sr-delay="0" className="eyebrow-badge">Pricing</div>
                <h2 data-sr data-sr-delay="0.08" className="section-h2">No tricks. No "contact us."</h2>
                <p data-sr data-sr-delay="0.16" className="section-body">Start free. Pay once for Pro. Subscribe for unlimited.</p>
              </div>

              <div className="pricing-grid">
                {([
                  { key:'free',    label:'Free',    price:'€0',    period:'forever free',  badge:null,           features:['Overall score /100 + rating','First impression analysis','Red flag count + severity','ATS verdict','Career trajectory','2 job matches visible','History (with account)'],         cta:'Get Started Free',  ctaFilled:false, ctaAction:scrollToUpload },
                  { key:'pro',     label:'Pro',     price:'€1.99', period:'one-time',       badge:'Most Popular', features:['Everything in Free','AI bullet rewrites on your text','How-to-fix for every red flag','Missing ATS keywords','Career gap analysis','Top 3 actions with how-to + examples'], cta:'Get Pro — €1.99',   ctaFilled:true,  ctaAction:()=>setShowUpgradeModal(true) },
                  { key:'premium', label:'Premium', price:'€5.99', period:'/month',         badge:null,           features:['Everything in Pro','Unlimited analyses','All matched jobs visible','Fit score 0–100 per job','Strengths & gaps per job','Weekly job alert emails'],                           cta:'Start Premium',     ctaFilled:false, ctaAction:()=>setShowUpgradeModal(true) },
                ] as const).map((p,i)=>(
                  <div key={p.key} data-sr data-sr-delay={`${i * 0.12}`} className={`pricing-card ${p.badge?'pricing-card-featured':'pricing-card-normal'}`}>
                    {p.badge&&<BorderTrail/>}
                    {p.badge&&<div className="pricing-badge"><svg className="pricing-badge-star" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>{p.badge}</span></div>}
                    <div className={`pricing-plan-label ${p.badge?'pricing-plan-label-featured':'pricing-plan-label-normal'}`}>{p.label}</div>
                    <div className="pricing-price">
                      <span className="pricing-price-num">{p.price}</span>
                      <span className="pricing-period">{p.period}</span>
                    </div>
                    <ul className="pricing-features">
                      {p.features.map(f=><li key={f} className="pricing-feature"><svg width="13" height="13" fill="none" stroke="var(--score-high)" strokeWidth="2.5" viewBox="0 0 24 24" className="svg-shrink"><polyline points="20 6 9 17 4 12"/></svg>{f}</li>)}
                    </ul>
                    <button onClick={p.ctaAction} className={`pricing-cta ${p.ctaFilled?'pricing-cta-filled':'pricing-cta-outline'}`}>{tier===p.key?'Current plan':p.cta}</button>
                  </div>
                ))}
              </div>
              <p className="pricing-trust">
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure checkout via Stripe · No subscription on Pro · 1 scan always free
              </p>
            </div>
          </section>

          <section className="testimonial-section">
            <div className="section-wrap-sm">
              <div className="section-head">
                <div data-sr data-sr-delay="0" className="eyebrow-badge">Testimonial</div>
                <h2 data-sr data-sr-delay="0.08" className="section-h2">The most honest feedback your CV will ever get.</h2>
              </div>
              <div className="testimonial-card testimonial-mt">
                <div className="testimonial-stars">
                  {[...Array(5)].map((_,i)=><svg key={i} width="20" height="20" fill="var(--accent)" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
                </div>
                <p className="testimonial-rating">Rated <strong className="testimonial-rating-num">4.9</strong> by early users</p>
                <blockquote className="testimonial-quote">
                  "I had no idea my CV was this weak until CVCheck told me exactly why. Got two interview calls the week after fixing the red flags."
                </blockquote>
                <p className="testimonial-author">Mihai D., Product Manager, Bucharest</p>
              </div>
            </div>
          </section>

        </>)}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <div className="footer-logo">
                <img src="/logo.png" width="32" height="32" alt="CVCheck" className="logo-img" />
                CVCheck
              </div>
              <p className="footer-desc">AI-powered CV analysis and job matching. Get your score, fix your red flags, land more interviews.</p>
            </div>
            {[
              { title:'Product', links:[{label:'CV Analysis',href:'/#analysis'},{label:'Job Matching',href:'/#jobs'},{label:'Job Alerts',href:'/#alerts'},{label:'Pricing',href:'/#pricing'}] },
              { title:'Company', links:[{label:'Privacy Policy',href:'/privacy'},{label:'Terms of Service',href:'/terms'},{label:'FAQ',href:'/faq'}] },
              { title:'Support', links:[{label:'Contact',href:'mailto:hello@cvcheck.app'}] },
            ].map(col=>(
              <div key={col.title}>
                <div className="footer-col-title">{col.title}</div>
                <ul className="footer-links">
                  {col.links.map(l=><li key={l.label}><Link href={l.href} className="footer-link">{l.label}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span>© 2025-2026 CVCheck · cvcheck.app</span>
            <div className="footer-bottom-links">
              <Link href="/privacy" className="footer-bottom-link">Privacy</Link>
              <Link href="/terms" className="footer-bottom-link">Terms</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
