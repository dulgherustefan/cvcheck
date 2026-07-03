// src/app/share/[token]/page.tsx
// Public share page — no auth required
// Next.js 15: params must be awaited (Promise<{ token: string }>)

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { RATING_LABELS, RATING_COLORS, SCORE_DIMENSIONS } from '@/lib/constants'
import type { Rating } from '@/lib/types'
import { ThemeScript } from '@/components/ThemeScript'

interface SharePageProps {
  params: Promise<{ token: string }>
}

async function getRoast(token: string) {
  const { createClient } = await import('@supabase/supabase-js')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[share] Missing env vars — SUPABASE_URL:', !!supabaseUrl, 'SERVICE_KEY:', !!serviceKey)
    return null
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: roast, error } = await admin
    .from('roasts')
    .select(`
      id, total_score, rating, summary,
      detected_domain, detected_level,
      scores, first_impression, red_flags,
      top_3_actions, share_token
    `)
    .eq('share_token', token)
    .single()

  if (error) {
    console.error('[share] Supabase error:', JSON.stringify(error))
    return null
  }
  if (!roast) {
    console.error('[share] No roast found for token:', token)
    return null
  }
  return roast
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params
  const roast = await getRoast(token)
  if (!roast) return { title: 'CVCheck' }

  const rating = RATING_LABELS[roast.rating as Rating] ?? roast.rating
  const domain = roast.detected_domain ?? 'Professional'
  const level  = roast.detected_level  ?? ''

  return {
    title: `${roast.total_score}/100 CV Score · ${domain}${level ? ` · ${level}` : ''} | CVCheck`,
    description: `This ${domain} CV scored ${roast.total_score}/100 (${rating}). See the full breakdown and check your own CV free.`,
    openGraph: {
      title: `CV Score: ${roast.total_score}/100 · ${rating}`,
      description: `${domain}${level ? ` · ${level}` : ''} · See the full AI analysis and check yours free on CVCheck.`,
      url: `https://cvcheck.app/share/${token}`,
      siteName: 'CVCheck',
      type: 'website',
      images: [{ url: `/api/og?score=${roast.total_score}&rating=${roast.rating}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `CV Score: ${roast.total_score}/100 · ${rating}`,
      description: `${domain}${level ? ` · ${level}` : ''} · Check your own CV free on CVCheck.`,
      images: [`/api/og?score=${roast.total_score}&rating=${roast.rating}`],
    },
  }
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRingStatic({ score, rating }: { score: number; rating: Rating }) {
  const R = 52
  const C = 2 * Math.PI * R
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const dash = pct * C
  const color = score >= 80 ? 'var(--score-high)' : score >= 60 ? 'var(--score-mid)' : 'var(--score-low)'
  const ratingLabel = RATING_LABELS[rating] ?? rating

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ overflow: 'visible' }}>
        <circle cx="65" cy="65" r={R} fill="none" stroke="var(--border)" strokeWidth="6"/>
        <circle
          cx="65" cy="65" r={R} fill="none"
          stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(-90 65 65)"
        />
        <text x="65" y="60" textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 32, fontWeight: 800, fill: 'var(--text-primary)', fontFamily: 'DM Serif Display, serif', letterSpacing: '-1px' }}>
          {score}
        </text>
        <text x="65" y="80" textAnchor="middle"
          style={{ fontSize: 11, fill: 'var(--text-tertiary)', fontFamily: 'DM Sans, sans-serif' }}>
          out of 100
        </text>
      </svg>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
        padding: '4px 12px', borderRadius: 3,
        color: RATING_COLORS[rating],
        background: `${RATING_COLORS[rating]}18`,
        border: `0.5px solid ${RATING_COLORS[rating]}40`,
      }}>
        {ratingLabel}
      </span>
    </div>
  )
}

// ─── Dimension bar ────────────────────────────────────────────────────────────
function DimBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.round((score / max) * 100)
  const color = pct >= 75 ? 'var(--score-high)' : pct >= 50 ? 'var(--score-mid)' : 'var(--score-low)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-muted)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, opacity: 0.85 }}/>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SharePage({ params }: SharePageProps) {
  noStore()
  const { token } = await params
  const roast = await getRoast(token)
  if (!roast) notFound()

  const rating    = roast.rating as Rating
  const score     = roast.total_score as number
  const domain    = roast.detected_domain ?? 'Professional'
  const level     = roast.detected_level  ?? ''
  const scores    = (roast.scores as Record<string, number>) ?? {}
  const fi        = roast.first_impression as { what_recruiter_sees?: string; passes_7_second_test?: boolean } | null
  const redFlags  = (roast.red_flags as Array<{ severity: string; flag?: string }>) ?? []
  const dealbreakers = redFlags.filter(f => f.severity === 'dealbreaker').length
  const warnings     = redFlags.filter(f => f.severity === 'warning').length
  const scoreColor   = score >= 80 ? 'var(--score-high)' : score >= 60 ? 'var(--score-mid)' : 'var(--score-low)'

  return (
    <>
      <ThemeScript/>
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column' as const,
      }}>

        {/* Header */}
        <header style={{
          borderBottom: '0.5px solid var(--border)',
          padding: '0 28px',
          height: 52,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-primary)' }}>
            <img src="/logo.svg" width="24" height="24" alt="CVCheck" style={{ display: 'block', borderRadius: 5 }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px' }}>CVCheck</span>
          </Link>
          <Link href="/" style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--bg)', background: 'var(--text-primary)',
            borderRadius: 4, padding: '6px 14px',
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}>
            Check my CV free →
          </Link>
        </header>

        {/* Main */}
        <main style={{ flex: 1, padding: '52px 24px 80px', maxWidth: 600, margin: '0 auto', width: '100%' }}>

          {/* Eyebrow */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 20 }}>
            CV Analysis · Shared Result
          </p>

          {/* Domain + level */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 36, flexWrap: 'wrap' as const }}>
            {domain && (
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, padding: '3px 10px', borderRadius: 3, background: 'var(--accent-subtle)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)' }}>
                {domain}
              </span>
            )}
            {level && (
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, padding: '3px 10px', borderRadius: 3, background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}>
                {level}
              </span>
            )}
          </div>

          {/* Hero — score + bars */}
          <div style={{ display: 'flex', gap: 44, alignItems: 'center', marginBottom: 40, flexWrap: 'wrap' as const }}>
            <ScoreRingStatic score={score} rating={rating}/>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {SCORE_DIMENSIONS.map(dim => (
                <DimBar key={dim.key} label={dim.label} score={scores[dim.key] ?? 0} max={dim.max}/>
              ))}
            </div>
          </div>

          <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 32 }}/>

          {/* Quick stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 32 }}>
            {/* Score stat */}
            <div style={{ padding: '16px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)' }}>Score</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-1px', color: scoreColor, fontFamily: 'DM Serif Display, serif' }}>{score}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>out of 100</span>
            </div>
            {/* Red flags stat */}
            <div style={{ padding: '16px', borderRadius: 7, border: `0.5px solid ${redFlags.length > 0 ? 'rgba(220,38,38,0.2)' : 'var(--border)'}`, background: redFlags.length > 0 ? 'rgba(220,38,38,0.04)' : 'var(--bg-subtle)', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)' }}>Issues</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-1px', color: redFlags.length > 0 ? 'var(--score-low)' : 'var(--score-high)', fontFamily: 'DM Serif Display, serif' }}>{redFlags.length}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{dealbreakers > 0 ? `${dealbreakers} critical` : 'red flags'}</span>
            </div>
            {/* 7s test stat */}
            <div style={{ padding: '16px', borderRadius: 7, border: `0.5px solid ${fi?.passes_7_second_test ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`, background: fi?.passes_7_second_test ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)' }}>7-sec test</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-1px', color: fi?.passes_7_second_test ? 'var(--score-high)' : 'var(--score-low)', fontFamily: 'DM Serif Display, serif' }}>
                {fi?.passes_7_second_test ? '✓' : '✗'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fi?.passes_7_second_test ? 'passes' : 'fails'}</span>
            </div>
          </div>

          {/* First impression quote */}
          {fi?.what_recruiter_sees && (
            <>
              <div style={{ marginBottom: 32, padding: '18px 20px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--bg-subtle)', position: 'relative' as const }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 10 }}>What a recruiter sees in 7 seconds</p>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
                  &ldquo;{fi.what_recruiter_sees}&rdquo;
                </p>
              </div>
            </>
          )}

          {/* Red flags preview */}
          {redFlags.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                Issues found
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {redFlags.slice(0, 3).map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 14px', borderRadius: 6,
                    background: f.severity === 'dealbreaker' ? 'rgba(220,38,38,0.04)' : f.severity === 'warning' ? 'rgba(202,138,4,0.04)' : 'var(--bg-subtle)',
                    border: `0.5px solid ${f.severity === 'dealbreaker' ? 'rgba(220,38,38,0.2)' : f.severity === 'warning' ? 'rgba(202,138,4,0.2)' : 'var(--border)'}`,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                      background: f.severity === 'dealbreaker' ? 'var(--score-low)' : f.severity === 'warning' ? 'var(--score-mid)' : 'var(--text-tertiary)',
                    }}/>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: f.severity === 'dealbreaker' ? 'var(--score-low)' : f.severity === 'warning' ? 'var(--score-mid)' : 'var(--text-tertiary)', display: 'block', marginBottom: 3 }}>
                        {f.severity}
                      </span>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                        {f.flag}
                      </p>
                    </div>
                  </div>
                ))}
                {redFlags.length > 3 && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '4px 0 0 2px' }}>
                    +{redFlags.length - 3} more issues, full breakdown in the complete analysis
                  </p>
                )}
              </div>
            </div>
          )}

          <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 32 }}/>

          {/* CTA */}
          <div style={{
            padding: '28px 28px 24px',
            borderRadius: 8,
            border: '0.5px solid var(--accent-border)',
            background: 'var(--accent-subtle)',
            display: 'flex', flexDirection: 'column' as const, gap: 16,
          }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--accent)', marginBottom: 8 }}>
                Free · No account needed
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.6px', margin: '0 0 6px', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                How does your CV score?
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Get your score, full breakdown, ATS check, and rewrite suggestions in 30 seconds.
              </p>
            </div>
            <Link href="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 13, fontWeight: 700, alignSelf: 'flex-start' as const,
              color: 'var(--bg)', background: 'var(--text-primary)',
              borderRadius: 4, padding: '10px 20px',
              textDecoration: 'none', letterSpacing: '-0.01em',
            }}>
              Analyze my CV free
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          </div>

        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '0.5px solid var(--border)',
          padding: '16px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>CVCheck © 2026</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/privacy" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms"   style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Terms</Link>
          </div>
        </footer>

      </div>
    </>
  )
}
