'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { Rating, CVScores, ImprovementTip, Observation } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string
  created_at: string
  source: string | null
  total_score: number
  rating: Rating
  summary: string
  scores: CVScores
  observations: Observation[]
  improvements: ImprovementTip[]
  top_priority: string
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
    // Likely a filename (PDF)
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
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)'
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
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {entry.summary}
              </p>
            </div>
          </div>

          {/* Observations */}
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
              Observations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entry.observations.map((obs, i) => {
                const isStrength = obs.type === 'strength'
                const color = isStrength ? '#16A34A' : '#DC2626'
                const bg = isStrength ? 'rgba(34,197,94,0.06)' : 'rgba(220,38,38,0.06)'
                const border = isStrength ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)'
                return (
                  <div key={i} style={{ padding: '12px 14px', background: bg, borderRadius: 'var(--radius-md)', border: `1px solid ${border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color, padding: '2px 7px', borderRadius: 4, background: isStrength ? 'rgba(34,197,94,0.12)' : 'rgba(220,38,38,0.12)' }}>
                        {isStrength ? '✓ Strength' : '✗ Weakness'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{obs.title}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{obs.detail}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Improvements */}
          {entry.improvements.length > 0 && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
                How to improve
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entry.improvements.map((tip, i) => {
                  const impColors: Record<string, string> = { high: '#DC2626', medium: '#CA8A04', low: '#6B7280' }
                  const ic = impColors[tip.impact] ?? '#6B7280'
                  return (
                    <div key={i} style={{
                      padding: '14px 16px', background: 'var(--bg)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                          color: ic, background: `${ic}14`, border: `1px solid ${ic}30`,
                          padding: '2px 7px', borderRadius: 20,
                        }}>{tip.impact}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tip.area}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 10px' }}>{tip.problem}</p>
                      <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How to fix it</p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{tip.fix}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Priority */}
          <div style={{
            padding: '16px 18px',
            background: 'color-mix(in srgb, var(--accent) 6%, var(--bg))',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <svg width="13" height="13" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Do this first</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{entry.top_priority}</p>
          </div>

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
        background: 'var(--accent)', color: '#fff',
        borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600,
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
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<HistoryEntry | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/'); return }

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
        background: 'var(--bg-elevated)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 720, margin: '0 auto',
          padding: '0 24px',
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
      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', width: '100%', padding: '40px 24px' }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Analysis history
          </h1>
          {!loading && entries.length > 0 && (
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
              {entries.length} {entries.length === 1 ? 'analysis' : 'analyses'} saved
            </p>
          )}
        </div>

        {/* Loading skeleton */}
        {(loading || authLoading) && (
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

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          © 2026 Dulgheru Stefan. All rights reserved.
        </span>
      </footer>

      {/* Detail drawer */}
      {selected && <DetailDrawer entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
