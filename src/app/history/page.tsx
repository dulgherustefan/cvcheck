'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/ThemeToggle'
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
  needs_work: '#DC2626',
  below_average: '#EA580C',
  average: '#CA8A04',
  good: '#65A30D',
  strong: '#16A34A',
  excellent: '#0891B2',
}

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
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
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
        <span style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, color: 'var(--text-tertiary)', lineHeight: 1, marginTop: 1 }}>/100</span>
      </div>
    </div>
  )
}

// ── History Card ──────────────────────────────────────────────────────────────

function HistoryCard({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const vColor = RATING_COLORS[entry.rating]

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        width: '100%', padding: '18px 20px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      <MiniRing score={entry.total_score} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            color: vColor,
            background: `${vColor}14`,
            border: `1px solid ${vColor}30`,
            padding: '2px 8px', borderRadius: 20,
          }}>
            {RATING_LABELS[entry.rating]}
          </span>
          {entry.detected_domain && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {entry.detected_domain}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {formatSource(entry.source)}
          </span>
        </div>
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {entry.summary}
        </p>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {formatDate(entry.created_at)}
        </span>
        <svg width="13" height="13" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" viewBox="0 0 24 24">
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
    if (s === 'dealbreaker') return '#DC2626'
    if (s === 'warning') return '#CA8A04'
    return '#6B7280'
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          height: '100%', overflowY: 'auto',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-24px 0 80px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>

        {/* Drawer Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-elevated)', zIndex: 10,
        }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 2px' }}>
              {formatDate(entry.created_at)} · {formatSource(entry.source)}
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Analysis detail
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'none',
              cursor: 'pointer', color: 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Score hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              {(() => {
                const r = 30, circ = 2 * Math.PI * r
                const dash = (entry.total_score / 100) * circ
                const color = scoreColor(entry.total_score)
                return (
                  <>
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="6" />
                      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`}
                        transform="rotate(-90 40 40)"
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{entry.total_score}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1, marginTop: 2 }}>/100</span>
                    </div>
                  </>
                )
              })()}
            </div>
            <div>
              <span style={{
                display: 'inline-block', fontSize: 12, fontWeight: 700,
                color: vColor, background: `${vColor}14`,
                border: `1px solid ${vColor}30`,
                padding: '3px 10px', borderRadius: 20, marginBottom: 8,
              }}>
                {RATING_LABELS[entry.rating]}
              </span>
              {(entry.detected_domain || entry.detected_level) && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 6px' }}>
                  {[entry.detected_domain, entry.detected_level].filter(Boolean).join(' · ')}
                </p>
              )}
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {entry.summary}
              </p>
            </div>
          </div>

          {/* First Impression */}
          {entry.first_impression && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
                First Impression
              </h3>
              <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {entry.first_impression.what_recruiter_sees}
                </p>
                {entry.first_impression.recommended_title !== entry.first_impression.current_title && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{entry.first_impression.current_title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
                    <span style={{ fontSize: 11, color: 'var(--score-high)', fontWeight: 600 }}>{entry.first_impression.recommended_title}</span>
                  </div>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: entry.first_impression.passes_7_second_test ? '#16A34A' : '#DC2626',
                  alignSelf: 'flex-start',
                }}>
                  {entry.first_impression.passes_7_second_test ? '✓ Passes 7-second test' : '✗ Fails 7-second test'}
                </span>
              </div>
            </div>
          )}

          {/* Red Flags */}
          {entry.red_flags && entry.red_flags.length > 0 && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
                Red Flags
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entry.red_flags.map((flag, i) => {
                  const c = severityColor(flag.severity)
                  return (
                    <div key={i} style={{ padding: '12px 14px', background: `${c}08`, borderRadius: 'var(--radius-md)', border: `1px solid ${c}25` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isPro && flag.how_to_fix ? 8 : 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: c, padding: '2px 7px', borderRadius: 4, background: `${c}14` }}>
                          {flag.severity}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{flag.flag}</span>
                      </div>
                      {isPro && flag.how_to_fix && (
                        <div style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${c}` }}>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{flag.how_to_fix}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top 3 Actions */}
          {entry.top_3_actions && entry.top_3_actions.length > 0 && (
            <div style={{ position: 'relative' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
                Top Actions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: isPro ? 'none' : 'blur(4px)', userSelect: isPro ? 'auto' : 'none', pointerEvents: isPro ? 'auto' : 'none' }}>
                {entry.top_3_actions.map((action, i) => (
                  <div key={i} style={{
                    padding: '14px 16px', background: 'var(--bg)',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--text-primary)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', background: 'var(--bg-muted)', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{action.action}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0 }}>{action.why_it_matters}</p>
                    {isPro && action.how && (
                      <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How</p>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{action.how}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!isPro && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <a href="/" style={{ padding: '10px 20px', background: 'var(--text-primary)', color: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    Unlock full analysis — €2
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Career Story */}
          {entry.career_story && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
                Career Story
              </h3>
              <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {entry.career_story.trajectory_detected}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    color: entry.career_story.progression_clear ? '#16A34A' : '#CA8A04',
                    padding: '2px 7px', borderRadius: 4,
                    background: entry.career_story.progression_clear ? 'rgba(34,197,94,0.1)' : 'rgba(202,138,4,0.1)',
                  }}>
                    {entry.career_story.progression_clear ? '✓ Clear progression' : '⚠ Unclear progression'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    color: 'var(--text-tertiary)', padding: '2px 7px', borderRadius: 4, background: 'var(--bg-muted)',
                  }}>
                    {entry.career_story.seniority_match}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>No analyses yet</p>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 24px' }}>
        Run your first analysis and it will appear here.
      </p>
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '10px 20px',
        background: 'var(--text-primary)', color: 'var(--bg)',
        borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600,
        textDecoration: 'none',
      }}>
        Analyze something
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<HistoryEntry | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); router.replace('/'); return }

    const supabase = createSupabaseBrowser()

    supabase
      .from('roasts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setEntries(data as HistoryEntry[])
        setLoading(false)
      })
  }, [user, authLoading, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 860, margin: '0 auto',
          padding: '0 32px',
          height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 13,
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
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              CVCheck
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {user.email?.split('@')[0]}
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', width: '100%', padding: '40px 32px' }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
            Analysis history
          </h1>
          {!loading && entries.length > 0 && (
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
              {entries.length} {entries.length === 1 ? 'analysis' : 'analyses'} saved
            </p>
          )}
        </div>

        {/* Loading skeleton */}
        {(loading && !authLoading) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 90, borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                animation: 'pulse 1.5s ease-in-out infinite',
                opacity: 1 - i * 0.15,
              }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && !authLoading && entries.length === 0 && <EmptyState />}

        {/* Entries */}
        {!loading && !authLoading && entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map(entry => (
              <HistoryCard key={entry.id} entry={entry} onClick={() => setSelected(entry)} />
            ))}
          </div>
        )}

      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 860, width: '100%', margin: '0 auto' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          © 2026 Dulgheru Stefan. All rights reserved.
        </span>
      </footer>

      {/* Detail drawer */}
      {selected && <DetailDrawer entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
