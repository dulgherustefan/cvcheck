import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

const RATING_LABEL: Record<string, string> = {
  needs_work:    'Needs Work',
  below_average: 'Below Average',
  average:       'Average',
  good:          'Good',
  strong:        'Strong',
  excellent:     'Excellent',
}

function scoreColor(score: number): string {
  if (score >= 75) return '#3DFFA0'
  if (score >= 50) return '#FFD23F'
  return '#FF5F5F'
}

function ratingColor(rating: string): string {
  if (['strong', 'excellent'].includes(rating)) return '#3DFFA0'
  if (['good', 'average'].includes(rating))     return '#FFD23F'
  return '#FF5F5F'
}

// SVG circle arc for score ring
function describeArc(cx: number, cy: number, r: number, pct: number) {
  const angle  = pct * 360
  const rad    = (angle - 90) * (Math.PI / 180)
  const x      = cx + r * Math.cos(rad)
  const y      = cy + r * Math.sin(rad)
  const large  = angle > 180 ? 1 : 0
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const score  = Math.min(100, Math.max(0, Number(searchParams.get('score')  ?? 0)))
  const rating = searchParams.get('rating') ?? 'average'
  const source = searchParams.get('source') ?? ''

  // Clean source for display
  const displaySource = (() => {
    if (!source) return null
    try {
      const u = new URL(source.startsWith('http') ? source : `https://${source}`)
      return u.hostname.replace(/^www\./, '')
    } catch {
      // PDF filename — trim extension
      return source.replace(/\.pdf$/i, '').slice(0, 40)
    }
  })()

  const color     = scoreColor(score)
  const rColor    = ratingColor(rating)
  const rLabel    = RATING_LABEL[rating] ?? rating
  const pct       = score / 100
  const arcPath   = describeArc(60, 60, 48, pct)
  const isDone    = score === 100

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: '#F8F7F4',
          display: 'flex', flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top border accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#111110', display: 'flex' }} />

        {/* Background grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, #11111010 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          display: 'flex',
        }} />

        {/* Main content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: '60px 80px',
          position: 'relative',
        }}>

          {/* Header — logo + source */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 60 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: '#111110',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#111110', letterSpacing: '-0.03em' }}>
                CVCheck
              </span>
            </div>

            {displaySource && (
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '6px 14px',
                background: '#FFFFFF',
                border: '1px solid #E8E6DF',
                borderRadius: 8,
                fontSize: 14, color: '#484743',
                fontFamily: 'monospace',
              }}>
                {displaySource}
              </div>
            )}
          </div>

          {/* Score section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 72, flex: 1 }}>

            {/* Score ring */}
            <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0, display: 'flex' }}>
              <svg width="180" height="180" viewBox="0 0 120 120">
                {/* Track */}
                <circle cx="60" cy="60" r="48" fill="none" stroke="#E8E6DF" strokeWidth="7" />
                {/* Fill */}
                {isDone ? (
                  <circle cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="7" />
                ) : (
                  <path d={arcPath} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
                )}
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 42, fontWeight: 800, color: '#111110', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {score}
                </span>
                <span style={{ fontSize: 13, color: '#97958F', marginTop: 2 }}>/100</span>
              </div>
            </div>

            {/* Right side — rating + message */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

              {/* Rating badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: 'fit-content',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: rColor, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: rColor,
                }}>
                  {rLabel}
                </span>
              </div>

              {/* Headline */}
              <div style={{
                fontSize: 52, fontWeight: 800,
                color: '#111110', letterSpacing: '-0.04em',
                lineHeight: 1.05,
                display: 'flex', flexDirection: 'column',
              }}>
                <span>My CV scored</span>
                <span style={{ color }}>
                  {score}/100
                </span>
              </div>

              {/* Subtext */}
              <span style={{ fontSize: 18, color: '#484743', lineHeight: 1.5 }}>
                AI feedback on CVs, portfolios & landing pages
              </span>
            </div>
          </div>

          {/* Footer CTA */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 32, borderTop: '1px solid #E8E6DF',
            marginTop: 40,
          }}>
            <span style={{ fontSize: 15, color: '#97958F' }}>
              Check your CV for free at cvcheck.app
            </span>
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '10px 24px',
              background: '#111110',
              borderRadius: 8,
              fontSize: 15, fontWeight: 600, color: '#F8F7F4',
              letterSpacing: '-0.01em',
            }}>
              Try CVCheck →
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
