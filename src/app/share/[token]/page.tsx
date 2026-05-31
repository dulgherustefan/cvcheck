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
    title: `${roast.total_score}/100 CV Score — ${domain}${level ? ` · ${level}` : ''} | CVCheck`,
    description: `This ${domain} CV scored ${roast.total_score}/100 (${rating}). See the full breakdown and check your own CV free.`,
    openGraph: {
      title: `CV Score: ${roast.total_score}/100 — ${rating}`,
      description: `${domain}${level ? ` · ${level}` : ''} · See the full AI analysis and check yours free on CVCheck.`,
      url: `https://cvcheck.app/share/${token}`,
      siteName: 'CVCheck',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `CV Score: ${roast.total_score}/100 — ${rating}`,
      description: `${domain}${level ? ` · ${level}` : ''} · Check your own CV free on CVCheck.`,
    },
  }
}

// ─── Score ring (pure SVG, no client hooks) ───────────────────────────────────
function ScoreRingStatic({ score, rating }: { score: number; rating: Rating }) {
  const R = 54
  const C = 2 * Math.PI * R
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const dash = pct * C
  const color = score >= 80 ? 'var(--score-high)' : score >= 60 ? 'var(--score-mid)' : 'var(--score-low)'
  const ratingLabel = RATING_LABELS[rating] ?? rating

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ overflow: 'visible' }}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--border)" strokeWidth="7"/>
        <circle
          cx="70" cy="70" r={R} fill="none"
          stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="67" textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 28, fontWeight: 800, fill: 'var(--text-primary)', fontFamily: 'DM Serif Display, serif', letterSpacing: '-1px' }}>
          {score}
        </text>
        <text x="70" y="87" textAnchor="middle"
          style={{ fontSize: 11, fill: 'var(--text-tertiary)', fontFamily: 'DM Sans, sans-serif' }}>
          / 100
        </text>
      </svg>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
        padding: '3px 10px', borderRadius: 3,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          {score}<span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>/{max}</span>
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: color }}/>
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

  const rating   = roast.rating as Rating
  const score    = roast.total_score as number
  const domain   = roast.detected_domain ?? 'Professional'
  const level    = roast.detected_level  ?? ''
  const scores   = (roast.scores as Record<string, number>) ?? {}
  const fi       = roast.first_impression as { verdict?: string; summary?: string } | null
  const redFlags = (roast.red_flags as Array<{ severity: string }>) ?? []
  const highFlags = redFlags.filter(f => f.severity === 'high').length
  const midFlags  = redFlags.filter(f => f.severity === 'medium').length
  const lowFlags  = redFlags.length - highFlags - midFlags

  return (
    <>
      <ThemeScript/>
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <header style={{
          borderBottom: '0.5px solid var(--border)',
          padding: '0 24px',
          height: 52,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-primary)' }}>
            <div style={{ width: 26, height: 26, borderRadius: 5, background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" fill="none" stroke="var(--bg)" strokeWidth="2.4" viewBox="0 0 24 24">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px' }}>CVCheck</span>
          </Link>
          <Link href="/" style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--bg)', background: 'var(--text-primary)',
            borderRadius: 4, padding: '6px 14px',
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}>
            Check your CV free →
          </Link>
        </header>

        {/* Main */}
        <main style={{ flex: 1, padding: '48px 24px 80px', maxWidth: 640, margin: '0 auto', width: '100%' }}>

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 24 }}>
            CV Analysis · Shared Result
          </p>

          {/* Domain + level pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' as const }}>
            {domain && (
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '3px 10px', borderRadius: 3, background: 'var(--accent-subtle)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)' }}>
                {domain}
              </span>
            )}
            {level && (
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '3px 10px', borderRadius: 3, background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}>
                {level}
              </span>
            )}
          </div>

          {/* Score ring + dimension bars */}
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap' as const }}>
            <ScoreRingStatic score={score} rating={rating}/>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {SCORE_DIMENSIONS.map(dim => (
                <DimBar key={dim.key} label={dim.label} score={scores[dim.key] ?? 0} max={dim.max}/>
              ))}
            </div>
          </div>

          <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 28 }}/>

          {/* First impression */}
          {fi?.summary && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                7-Second Test
              </p>
              {fi.verdict && (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.2px' }}>
                  {fi.verdict}
                </p>
              )}
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                {fi.summary}
              </p>
            </div>
          )}

          {/* Red flags */}
          {redFlags.length > 0 && (
            <>
              <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 28 }}/>
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  Red Flags Found
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                  {highFlags > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 5, background: 'rgba(220,38,38,0.06)', border: '0.5px solid rgba(220,38,38,0.2)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--score-low)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--score-low)' }}>{highFlags} high severity</span>
                    </div>
                  )}
                  {midFlags > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 5, background: 'rgba(202,138,4,0.06)', border: '0.5px solid rgba(202,138,4,0.2)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--score-mid)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--score-mid)' }}>{midFlags} medium severity</span>
                    </div>
                  )}
                  {lowFlags > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 5, background: 'var(--bg-subtle)', border: '0.5px solid var(--border)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{lowFlags} low severity</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.5 }}>
                  Full breakdown with how-to-fix instructions available in the complete analysis.
                </p>
              </div>
            </>
          )}

          <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 32 }}/>

          {/* CTA */}
          <div style={{
            padding: '28px',
            borderRadius: 8,
            border: '0.5px solid var(--accent-border)',
            background: 'var(--accent-subtle)',
            display: 'flex', flexDirection: 'column' as const, gap: 14, alignItems: 'flex-start',
          }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--accent)', marginBottom: 6 }}>
                Free · No credit card
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.8px', margin: 0, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                How does your CV score?
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.55 }}>
                Get your full AI analysis — score, dimension breakdown, ATS check, and actionable rewrites.
              </p>
            </div>
            <Link href="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 13.5, fontWeight: 700,
              color: 'var(--bg)', background: 'var(--text-primary)',
              borderRadius: 4, padding: '10px 20px',
              textDecoration: 'none', letterSpacing: '-0.01em',
            }}>
              Analyze my CV free
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          </div>

        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '0.5px solid var(--border)',
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>CVCheck © 2026</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/privacy" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms"   style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Terms</Link>
          </div>
        </footer>

      </div>
    </>
  )
}
