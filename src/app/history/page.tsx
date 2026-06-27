'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { Rating, CVScores, FirstImpression, ImpactAnalysis, ATSAnalysis, RedFlag, CareerStory, FormatAnalysis, CredibilityAnalysis, PriorityAction } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string
  created_at: string
  source: string | null
  total_score: number
  rating: Rating
  detected_domain: string | null
  detected_level: string | null
  summary: string
  scores: CVScores
  first_impression: FirstImpression | null
  impact: ImpactAnalysis | null
  ats: ATSAnalysis | null
  red_flags: RedFlag[] | null
  career_story: CareerStory | null
  format: FormatAnalysis | null
  credibility: CredibilityAnalysis | null
  top_3_actions: PriorityAction[] | null
  tier?: 'free' | 'pro' | 'premium'
}

interface SavedJobEntry {
  id: string
  job_id: string
  title: string
  company: string
  location: string | null
  redirect_url: string
  salary_min: number | null
  salary_max: number | null
  remote: boolean
  country_code: string | null
  status: 'saved' | 'applied'
  saved_at: string
  applied_at: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RATING_LABELS: Record<Rating, string> = {
  needs_work: 'Needs Work',
  below_average: 'Below Average',
  average: 'Average',
  good: 'Good',
  strong: 'Strong',
  excellent: 'Excellent',
}

const RATING_COLORS: Record<Rating, string> = {
  needs_work: '#FF5F5F',
  below_average: '#FF8F5F',
  average: '#FFD23F',
  good: '#B8E85F',
  strong: '#5FE8A8',
  excellent: '#3DFFA0',
}

const LIST_SELECT = [
  'id', 'created_at', 'source', 'total_score', 'rating',
  'detected_domain', 'detected_level', 'summary', 'scores',
  'first_impression', 'impact', 'ats', 'red_flags',
  'career_story', 'format', 'credibility', 'top_3_actions', 'tier',
].join(', ')

const PAGE_SIZE = 20

function scoreColor(score: number): string {
  if (score >= 66) return 'var(--score-high)'
  if (score >= 40) return 'var(--score-mid)'
  return 'var(--score-low)'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatSource(source: string | null): string {
  if (!source) return 'Unknown source'
  try {
    const url = new URL(source.startsWith('http') ? source : `https://${source}`)
    return url.hostname.replace('www.', '')
  } catch {
    return source.length > 32 ? source.slice(0, 30) + '…' : source
  }
}

// ── Mini Score Ring ───────────────────────────────────────────────────────────

function MiniRing({ score }: { score: number }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = scoreColor(score)

  return (
    <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="4.5" />
        <circle
          cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font-display)' }}>{score}</span>
        <span style={{ fontSize: 8, color: 'var(--text-tertiary)', lineHeight: 1, marginTop: 1 }}>/100</span>
      </div>
    </div>
  )
}

// ── History Card ──────────────────────────────────────────────────────────────

function HistoryCard({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const vColor = RATING_COLORS[entry.rating]
  const tierMeta = entry.tier === 'premium'
    ? { label: 'Premium', color: 'var(--text-inverse)', bg: 'var(--accent)', border: 'transparent' }
    : entry.tier === 'pro'
    ? { label: 'Pro', color: 'var(--accent)', bg: 'var(--accent-subtle)', border: 'var(--accent-border)' }
    : null

  return (
    <button
      onClick={onClick}
      className="_hist-card"
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        width: '100%', padding: '20px 22px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        cursor: 'pointer', textAlign: 'left',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
      }}
    >
      <MiniRing score={entry.total_score} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
          {/* Rating badge */}
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            color: vColor,
            background: `${vColor}14`,
            border: `1px solid ${vColor}28`,
            padding: '2px 8px', borderRadius: 20,
          }}>
            {RATING_LABELS[entry.rating]}
          </span>
          {/* Tier badge */}
          {tierMeta && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              color: tierMeta.color, background: tierMeta.bg,
              border: `1px solid ${tierMeta.border}`,
              padding: '2px 8px', borderRadius: 20,
            }}>
              {tierMeta.label}
            </span>
          )}
          {entry.detected_domain && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {entry.detected_domain}
            </span>
          )}
        </div>
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55,
          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          fontWeight: 500,
        }}>
          {entry.summary}
        </p>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {formatDate(entry.created_at)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatSource(entry.source)}
        </span>
        <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const isPro = entry.tier === 'pro' || entry.tier === 'premium'
  const vColor = RATING_COLORS[entry.rating]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const severityColor = (s: string) => {
    if (s === 'dealbreaker') return '#FF5F5F'
    if (s === 'warning') return '#FFD23F'
    return '#9896A8'
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540,
          height: '100%', overflowY: 'auto',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-strong)',
          boxShadow: '-32px 0 100px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <style>{`
          @keyframes slideIn { from { transform: translateX(48px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
          ._drawer-close:hover { background: var(--accent-subtle) !important; border-color: var(--accent-border) !important; color: var(--accent) !important; }
          ._hist-card:hover { border-color: var(--accent-border) !important; box-shadow: 0 4px 20px rgba(0,0,0,0.10) !important; transform: translateY(-1px) !important; }
        `}</style>

        {/* Stripe + Header */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))', flexShrink: 0 }} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-elevated)', zIndex: 10,
          backdropFilter: 'blur(20px)',
        }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 3px', fontWeight: 500 }}>
              {formatDate(entry.created_at)} · {formatSource(entry.source)}
            </p>
            <h2 style={{
              fontSize: 17, fontWeight: 800, color: 'var(--text-heading)', margin: 0,
              fontFamily: 'var(--font-display)', letterSpacing: '-0.02em',
            }}>
              Analysis detail
            </h2>
          </div>
          <button
            className="_drawer-close"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-subtle)',
              cursor: 'pointer', color: 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Score hero */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20,
            padding: '20px', background: 'var(--bg)', borderRadius: 14,
            border: '1px solid var(--border)',
          }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              {(() => {
                const r = 30, circ = 2 * Math.PI * r
                const dash = (entry.total_score / 100) * circ
                const color = scoreColor(entry.total_score)
                return (
                  <>
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="5.5" />
                      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5.5"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`}
                        transform="rotate(-90 40 40)"
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font-display)' }}>{entry.total_score}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1, marginTop: 2 }}>/100</span>
                    </div>
                  </>
                )
              })()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase' as const,
                  color: vColor, background: `${vColor}14`,
                  border: `1px solid ${vColor}28`,
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {RATING_LABELS[entry.rating]}
                </span>
                {(entry.detected_domain || entry.detected_level) && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, alignSelf: 'center' }}>
                    {[entry.detected_domain, entry.detected_level].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                {entry.summary}
              </p>
            </div>
          </div>

          {/* First Impression */}
          {entry.first_impression && (
            <DrawerSection title="First Impression">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  {entry.first_impression.what_recruiter_sees}
                </p>
                {entry.first_impression.recommended_title !== entry.first_impression.current_title && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{entry.first_impression.current_title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
                    <span style={{ fontSize: 12, color: 'var(--score-high)', fontWeight: 600 }}>{entry.first_impression.recommended_title}</span>
                  </div>
                )}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                  color: entry.first_impression.passes_7_second_test ? '#3DFFA0' : '#FF5F5F',
                  background: entry.first_impression.passes_7_second_test ? 'var(--accent-subtle)' : 'rgba(255,95,95,0.08)',
                  border: `1px solid ${entry.first_impression.passes_7_second_test ? 'var(--accent-border)' : 'rgba(255,95,95,0.2)'}`,
                  padding: '4px 10px', borderRadius: 20, alignSelf: 'flex-start',
                }}>
                  {entry.first_impression.passes_7_second_test
                    ? <><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Passes 7-second test</>
                    : <><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Fails 7-second test</>
                  }
                </div>
              </div>
            </DrawerSection>
          )}

          {/* Red Flags */}
          {entry.red_flags && entry.red_flags.length > 0 && (
            <DrawerSection title={`Red Flags (${entry.red_flags.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entry.red_flags.map((flag, i) => {
                  const c = severityColor(flag.severity)
                  return (
                    <div key={i} style={{
                      padding: '12px 14px', background: `${c}07`,
                      borderRadius: 10, border: `1px solid ${c}22`,
                      borderLeft: `3px solid ${c}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isPro && flag.how_to_fix ? 10 : 0 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const,
                          letterSpacing: '0.06em', color: c,
                          padding: '2px 7px', borderRadius: 4, background: `${c}14`,
                          flexShrink: 0,
                        }}>
                          {flag.severity}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>{flag.flag}</span>
                      </div>
                      {isPro && flag.how_to_fix && (
                        <div style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 7 }}>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{flag.how_to_fix}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </DrawerSection>
          )}

          {/* Top 3 Actions */}
          {entry.top_3_actions && entry.top_3_actions.length > 0 && (
            <DrawerSection title="Top Actions">
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                filter: isPro ? 'none' : 'blur(4px)',
                userSelect: isPro ? 'auto' : 'none',
                pointerEvents: isPro ? 'auto' : 'none',
                position: 'relative',
              }}>
                {entry.top_3_actions.map((action, i) => (
                  <div key={i} style={{
                    padding: '14px 16px', background: 'var(--bg)',
                    borderRadius: 10, border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--accent)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: 'var(--text-inverse)',
                        background: 'var(--accent)',
                        width: 20, height: 20, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 1,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{action.action}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55, margin: '0 0 0 30px' }}>{action.why_it_matters}</p>
                    {isPro && action.how && (
                      <div style={{ marginTop: 10, marginLeft: 30, padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 7 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>How</p>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{action.how}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!isPro && (
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                  <a href="/" style={{
                    padding: '10px 22px',
                    background: 'var(--accent)', color: 'var(--text-inverse)',
                    borderRadius: 9, fontSize: 13, fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(61,255,160,0.30)',
                  }}>
                    Unlock full analysis — €1.99
                  </a>
                </div>
              )}
            </DrawerSection>
          )}

          {/* Career Story */}
          {entry.career_story && (
            <DrawerSection title="Career Story">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  {entry.career_story.trajectory_detected}
                </p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                    color: entry.career_story.progression_clear ? '#3DFFA0' : '#FFD23F',
                    padding: '3px 9px', borderRadius: 20,
                    background: entry.career_story.progression_clear ? 'var(--accent-subtle)' : 'rgba(255,210,63,0.10)',
                    border: `1px solid ${entry.career_story.progression_clear ? 'var(--accent-border)' : 'rgba(255,210,63,0.22)'}`,
                  }}>
                    {entry.career_story.progression_clear ? '✓ Clear progression' : '⚠ Unclear progression'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                    color: 'var(--text-secondary)', padding: '3px 9px', borderRadius: 20,
                    background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                  }}>
                    {entry.career_story.seniority_match}
                  </span>
                </div>
              </div>
            </DrawerSection>
          )}

        </div>
      </div>
    </div>
  )
}

// ── DrawerSection helper ──────────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h3 style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', margin: 0,
        }}>
          {title}
        </h3>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      {children}
    </div>
  )
}

// ── Saved Job Card ────────────────────────────────────────────────────────────

function SavedJobCard({ job, token, onStatusChange }: {
  job: SavedJobEntry
  token: string | null
  onStatusChange: (id: string, status: 'saved' | 'applied' | 'removed') => void
}) {
  const [loading, setLoading] = useState(false)

  const salary = job.salary_min
    ? `${Math.round(job.salary_min / 1000)}k${job.salary_max ? `–${Math.round(job.salary_max / 1000)}k` : '+'}`
    : null

  async function handleAction(action: 'apply' | 'unapply' | 'unsave') {
    setLoading(true)
    try {
      await fetch('/api/jobs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action, listing: { id: job.job_id, title: job.title, company: job.company, location: job.location, redirect_url: job.redirect_url, salary_min: job.salary_min, salary_max: job.salary_max, remote: job.remote, country_code: job.country_code } }),
      })
      if (action === 'unsave') onStatusChange(job.job_id, 'removed')
      else if (action === 'apply') onStatusChange(job.job_id, 'applied')
      else if (action === 'unapply') onStatusChange(job.job_id, 'saved')
    } finally {
      setLoading(false)
    }
  }

  const isApplied = job.status === 'applied'

  return (
    <div style={{
      padding: '18px 20px',
      background: 'var(--bg-elevated)',
      border: `1px solid ${isApplied ? 'var(--accent-border)' : 'var(--border)'}`,
      borderRadius: 14,
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Company logo placeholder */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--bg-subtle)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-display)',
        }}>
          {job.company.slice(0, 1).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
              {job.title}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              padding: '3px 9px', borderRadius: 20, flexShrink: 0,
              color: isApplied ? '#3DFFA0' : 'var(--accent)',
              background: isApplied ? 'var(--accent-subtle)' : 'var(--accent-subtle)',
              border: `1px solid ${isApplied ? 'var(--accent-border)' : 'var(--accent-border)'}`,
            }}>
              {isApplied ? '✓ Applied' : 'Saved'}
            </span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 8, fontWeight: 500 }}>
            <span>{job.company}</span>
            {job.location && <><span style={{ color: 'var(--border-strong)' }}>·</span><span>{job.location}</span></>}
            {salary && <><span style={{ color: 'var(--border-strong)' }}>·</span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{salary}</span></>}
            {job.remote && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                color: 'var(--accent)', background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)', borderRadius: 4, padding: '2px 7px',
              }}>Remote</span>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12, fontWeight: 500 }}>
            Saved {formatDate(job.saved_at)}{job.applied_at ? ` · Applied ${formatDate(job.applied_at)}` : ''}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            <a
              href={job.redirect_url} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)',
                borderRadius: 8, padding: '6px 14px', textDecoration: 'none',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              View job →
            </a>
            {job.status === 'saved' ? (
              <button
                onClick={() => handleAction('apply')} disabled={loading}
                style={{
                  fontSize: 12, fontWeight: 600, color: '#3DFFA0',
                  background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', opacity: loading ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                Mark applied
              </button>
            ) : (
              <button
                onClick={() => handleAction('unapply')} disabled={loading}
                style={{
                  fontSize: 12, color: 'var(--text-tertiary)',
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', opacity: loading ? 0.5 : 1,
                }}
              >
                Undo applied
              </button>
            )}
            <button
              onClick={() => handleAction('unsave')} disabled={loading}
              style={{
                fontSize: 12, color: 'var(--text-tertiary)',
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', marginLeft: 'auto', opacity: loading ? 0.5 : 1,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty States ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <svg width="26" height="26" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 8px', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>No analyses yet</p>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 28px', fontWeight: 500 }}>
        Run your first analysis and it will appear here.
      </p>
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '11px 24px',
        background: 'var(--accent)', color: 'var(--text-inverse)',
        borderRadius: 10, fontSize: 14, fontWeight: 700,
        textDecoration: 'none',
        boxShadow: '0 4px 14px rgba(61,255,160,0.28)',
      }}>
        Analyze a CV
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  )
}

function EmptySavedJobs() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <svg width="26" height="26" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 8px', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>No saved jobs yet</p>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 28px', fontWeight: 500 }}>
        Star jobs from your analysis results to track them here.
      </p>
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '11px 24px',
        background: 'var(--accent)', color: 'var(--text-inverse)',
        borderRadius: 10, fontSize: 14, fontWeight: 700,
        textDecoration: 'none',
        boxShadow: '0 4px 14px rgba(61,255,160,0.28)',
      }}>
        Find matching jobs
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function HistoryContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialTab = searchParams.get('tab') === 'saved' ? 'saved' : 'analyses'
  const [tab, setTab] = useState<'analyses' | 'saved'>(initialTab)

  useEffect(() => {
    const t = searchParams.get('tab') === 'saved' ? 'saved' : 'analyses'
    setTab(t)
  }, [searchParams])

  const [entries,     setEntries]     = useState<HistoryEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [page,        setPage]        = useState(0)
  const [selected,    setSelected]    = useState<HistoryEntry | null>(null)

  const [savedJobs,        setSavedJobs]        = useState<SavedJobEntry[]>([])
  const [savedLoading,     setSavedLoading]     = useState(false)
  const [savedFilter,      setSavedFilter]      = useState<'all' | 'saved' | 'applied'>('all')
  const [token,            setToken]            = useState<string | null>(null)

  const fetchPage = async (pageIndex: number, userId: string, append = false) => {
    const supabase = createSupabaseBrowser()
    const from = pageIndex * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('roasts')
      .select(LIST_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (!error && data) {
      setEntries(prev => append ? [...prev, ...(data as unknown as HistoryEntry[])] : (data as unknown as HistoryEntry[]))
      setHasMore(data.length === PAGE_SIZE)
    }
  }

  async function fetchSavedJobs(tok: string, status?: string) {
    setSavedLoading(true)
    try {
      const url = status && status !== 'all' ? `/api/jobs/save?status=${status}` : '/api/jobs/save'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
      const { jobs } = await res.json()
      setSavedJobs(jobs ?? [])
    } finally {
      setSavedLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); router.replace('/'); return }
    const supabase = createSupabaseBrowser()
    supabase.auth.getSession().then(({ data }) => {
      const tok = data.session?.access_token ?? null
      setToken(tok)
      if (tok) fetchSavedJobs(tok, savedFilter)
    })
    fetchPage(0, user.id).finally(() => setLoading(false))
  }, [user, authLoading, router])

  useEffect(() => {
    if (!token) return
    fetchSavedJobs(token, savedFilter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFilter])

  const loadMore = async () => {
    if (!user || loadingMore) return
    setLoadingMore(true)
    const next = page + 1
    await fetchPage(next, user.id, true)
    setPage(next)
    setLoadingMore(false)
  }

  function handleSavedJobStatusChange(jobId: string, newStatus: 'saved' | 'applied' | 'removed') {
    if (newStatus === 'removed') {
      setSavedJobs(prev => prev.filter(j => j.job_id !== jobId))
    } else {
      setSavedJobs(prev => prev.map(j =>
        j.job_id === jobId
          ? { ...j, status: newStatus, applied_at: newStatus === 'applied' ? new Date().toISOString() : null }
          : j
      ))
    }
  }

  function handleTabChange(newTab: 'analyses' | 'saved') {
    setTab(newTab)
    const url = newTab === 'saved' ? '/history?tab=saved' : '/history'
    router.replace(url, { scroll: false })
  }

  const savedCount   = savedJobs.filter(j => j.status === 'saved').length
  const appliedCount = savedJobs.filter(j => j.status === 'applied').length
  const filteredJobs = savedFilter === 'all' ? savedJobs : savedJobs.filter(j => j.status === savedFilter)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        ._hist-card:hover {
          border-color: var(--accent-border) !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.10) !important;
          transform: translateY(-1px) !important;
        }
        ._hist-tab { transition: color 0.15s, border-color 0.15s !important; }
        ._hist-tab:hover { color: var(--text-primary) !important; }
        ._hist-filter { transition: all 0.15s !important; }
        ._hist-filter:hover { border-color: var(--border-strong) !important; color: var(--text-secondary) !important; }
        ._hist-loadmore { transition: all 0.15s !important; }
        ._hist-loadmore:hover { border-color: var(--accent-border) !important; color: var(--accent) !important; background: var(--accent-subtle) !important; }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 var(--border)',
      }}>
        {/* Accent stripe */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))', flexShrink: 0 }} />
        <div style={{
          maxWidth: 860, margin: '0 auto',
          padding: '0 32px',
          height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 13, fontWeight: 500,
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </Link>
            <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <img src="/logo.svg" width="24" height="24" alt="CVCheck" style={{display:"block",borderRadius:5}}/>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                CVCheck
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {user.email?.split('@')[0]}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', width: '100%', padding: '48px 32px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 800, color: 'var(--text-heading)',
            margin: '0 0 6px', letterSpacing: '-0.03em',
            fontFamily: 'var(--font-display)', lineHeight: 1.05,
          }}>
            History
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-tertiary)', margin: '0 0 28px', fontWeight: 500 }}>
            Your CV analyses and saved job applications.
          </p>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1.5px solid var(--border)',
          }}>
            {([
              { key: 'analyses', label: 'Analyses', count: entries.length },
              { key: 'saved',    label: 'Saved Jobs', count: savedJobs.length },
            ] as const).map(t => (
              <button
                key={t.key}
                className="_hist-tab"
                onClick={() => handleTabChange(t.key)}
                style={{
                  fontSize: 13, fontWeight: 600,
                  color: tab === t.key ? 'var(--accent)' : 'var(--text-tertiary)',
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
                  padding: '8px 16px', marginBottom: -1.5,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: tab === t.key ? '#fff' : 'var(--text-tertiary)',
                    background: tab === t.key ? 'var(--accent)' : 'var(--bg-muted)',
                    borderRadius: 20, padding: '1px 7px',
                    minWidth: 20, textAlign: 'center',
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── ANALYSES TAB ── */}
        {tab === 'analyses' && (
          <>
            {(loading && !authLoading) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    height: 92, borderRadius: 14,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    animation: 'skPulse 1.5s ease-in-out infinite',
                    opacity: 1 - i * 0.18,
                  }} />
                ))}
                <style>{`@keyframes skPulse { 0%,100%{opacity:0.5} 50%{opacity:0.9} }`}</style>
              </div>
            )}
            {!loading && !authLoading && entries.length === 0 && <EmptyState />}
            {!loading && !authLoading && entries.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entries.map(entry => (
                  <HistoryCard key={entry.id} entry={entry} onClick={() => setSelected(entry)} />
                ))}
                {hasMore && (
                  <button
                    className="_hist-loadmore"
                    onClick={loadMore} disabled={loadingMore}
                    style={{
                      marginTop: 8, padding: '11px 20px',
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 10, color: 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 600,
                      cursor: loadingMore ? 'default' : 'pointer',
                      opacity: loadingMore ? 0.5 : 1,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ── SAVED JOBS TAB ── */}
        {tab === 'saved' && (
          <>
            {savedJobs.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20, flexWrap: 'wrap' as const, gap: 12,
              }}>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  <span>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{savedCount}</strong> saved
                  </span>
                  <span>
                    <strong style={{ color: 'var(--score-high)', fontWeight: 700 }}>{appliedCount}</strong> applied
                  </span>
                </div>
                {/* Filter pills */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['all', 'saved', 'applied'] as const).map(f => (
                    <button
                      key={f}
                      className="_hist-filter"
                      onClick={() => setSavedFilter(f)}
                      style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                        textTransform: 'capitalize' as const, padding: '4px 12px', borderRadius: 20,
                        border: `1px solid ${savedFilter === f ? 'var(--accent)' : 'var(--border)'}`,
                        background: savedFilter === f ? 'var(--accent)' : 'transparent',
                        color: savedFilter === f ? '#fff' : 'var(--text-tertiary)',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {savedLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: 120, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', animation: 'skPulse 1.5s ease-in-out infinite', opacity: 1 - i * 0.18 }} />
                ))}
              </div>
            )}

            {!savedLoading && savedJobs.length === 0 && <EmptySavedJobs />}

            {!savedLoading && filteredJobs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredJobs.map(job => (
                  <SavedJobCard
                    key={job.job_id}
                    job={job}
                    token={token}
                    onStatusChange={handleSavedJobStatusChange}
                  />
                ))}
              </div>
            )}

            {!savedLoading && savedJobs.length > 0 && filteredJobs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 500 }}>
                No {savedFilter} jobs found.
              </div>
            )}
          </>
        )}

      </main>

      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 860, width: '100%', margin: '0 auto',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          © 2026 CVCheck · cvcheck.app
        </span>
      </footer>

      {selected && <DetailDrawer entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  )
}
