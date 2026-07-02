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
  if (score >= 75) return '#1E9E5A'
  if (score >= 50) return '#C7871B'
  return '#D14343'
}

function ratingColor(rating: string): string {
  if (['strong', 'excellent'].includes(rating)) return '#1E9E5A'
  if (['good', 'average'].includes(rating))     return '#C7871B'
  return '#D14343'
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

// The pinwheel logo as a data-URI (vector trace, mint). Rendered via <img> so
// Satori rasterizes it directly — avoids transform-handling quirks.
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">' +
  '<g transform="translate(0,500) scale(0.1,-0.1)" fill="#D26A4A">' +
  '<path d="M1739 4226 c-2 -2 -26 -7 -53 -10 -113 -15 -297 -93 -412 -172 -74 -52 -202 -185 -248 -257 -43 -68 -83 -148 -107 -217 -24 -68 -59 -257 -59 -320 0 -65 36 -259 60 -322 32 -84 32 -84 76 -43 170 159 358 254 614 311 111 25 365 22 490 -4 224 -48 433 -153 587 -295 43 -39 45 -40 56 -22 40 68 81 281 76 402 -4 125 -39 303 -59 303 -5 0 -7 6 -4 14 5 12 -59 159 -76 176 -3 3 -12 18 -19 33 -22 42 -121 152 -182 203 -138 114 -302 188 -476 213 -69 11 -255 15 -264 7z"/>' +
  '<path d="M2935 4214 c-56 -13 -91 -24 -140 -44 -11 -5 -28 -11 -38 -14 -15 -5 -7 -18 48 -81 76 -87 122 -157 176 -264 39 -80 98 -239 103 -281 2 -14 8 -55 15 -92 18 -106 14 -288 -8 -412 -11 -60 -18 -113 -15 -118 3 -4 0 -8 -5 -8 -6 0 -11 -8 -11 -18 0 -10 -4 -22 -8 -27 -4 -6 -14 -28 -21 -50 -32 -98 -122 -250 -208 -352 -23 -28 -43 -55 -43 -60 0 -4 -10 -14 -21 -21 -20 -13 -21 -14 -3 -26 30 -20 173 -60 259 -72 41 -5 205 -6 235 0 34 6 125 18 125 17 0 -1 34 10 75 24 248 87 434 238 548 448 30 54 82 195 97 262 4 17 9 39 11 50 16 71 16 239 0 336 -38 227 -121 393 -272 543 -68 68 -200 160 -216 150 -6 -4 -8 -3 -5 3 5 8 -38 31 -118 62 -43 17 -123 40 -173 50 -75 16 -315 12 -387 -5z"/>' +
  '<path d="M1660 2915 c-132 -27 -313 -104 -370 -157 -11 -10 -23 -18 -28 -18 -15 0 -189 -177 -222 -226 -132 -196 -207 -499 -169 -686 42 -206 81 -313 159 -428 50 -75 194 -222 260 -267 115 -78 278 -143 411 -164 88 -14 289 -6 369 15 59 14 170 52 177 60 3 3 -6 16 -20 30 -22 22 -76 88 -136 166 -30 40 -82 135 -114 210 -69 160 -99 311 -100 500 0 185 28 326 99 495 9 22 16 42 16 45 0 3 3 10 8 15 4 6 17 26 28 46 33 59 46 82 59 98 66 89 83 112 83 116 0 3 19 22 41 42 l41 38 -31 13 c-18 7 -37 9 -43 6 -6 -4 -8 -3 -5 3 7 10 -73 35 -172 53 -74 14 -263 11 -341 -5z"/>' +
  '<path d="M2240 2331 c0 -11 -4 -22 -9 -26 -19 -11 -42 -98 -62 -235 -21 -138 6 -359 56 -478 56 -131 168 -308 187 -295 6 3 8 2 5 -4 -6 -10 84 -102 143 -145 19 -14 73 -46 120 -71 234 -125 516 -149 763 -66 110 37 150 57 242 120 258 175 411 449 431 769 8 120 -4 211 -43 343 -17 56 -31 87 -40 87 -8 0 -40 -22 -71 -48 -52 -44 -223 -162 -236 -162 -3 0 -36 -15 -73 -33 -38 -18 -86 -38 -108 -45 -102 -30 -153 -43 -195 -48 -24 -3 -48 -8 -52 -10 -17 -11 -279 -3 -353 10 -160 29 -223 51 -399 138 -62 30 -230 147 -278 193 -26 24 -28 24 -28 6z"/>' +
  '</g></svg>'
const LOGO_URI = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`

// ── Shared chrome ──────────────────────────────────────────────────────────
const BG       = '#FBF8F2'
const ELEVATED = '#FFFFFF'
const MUTED    = '#EBE5D8'
const HEADING  = '#191510'
const SECOND   = '#6B6459'
const TERTIARY = '#9A9184'
const BORDER   = 'rgba(42,37,31,0.10)'
const ACCENT   = '#D26A4A'

function Logo({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_URI} width={size} height={size} alt="" style={{ display: 'flex' }} />
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hasScore = searchParams.has('score')

  const score  = Math.min(100, Math.max(0, Number(searchParams.get('score') ?? 0)))
  const rating = searchParams.get('rating') ?? 'average'
  const source = searchParams.get('source') ?? ''

  const displaySource = (() => {
    if (!source) return null
    try {
      const u = new URL(source.startsWith('http') ? source : `https://${source}`)
      return u.hostname.replace(/^www\./, '')
    } catch {
      return source.replace(/\.pdf$/i, '').slice(0, 40)
    }
  })()

  const frame = {
    width: 1200, height: 630,
    background: BG,
    display: 'flex', flexDirection: 'column' as const,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  }
  const accentStripe = { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 4, background: ACCENT, display: 'flex' }
  const dotGrid = {
    position: 'absolute' as const, inset: 0,
    backgroundImage: 'radial-gradient(circle, rgba(42,37,31,0.05) 1px, transparent 1px)',
    backgroundSize: '32px 32px', display: 'flex',
  }
  const glow = {
    position: 'absolute' as const, top: -200, right: -120, width: 560, height: 560,
    background: 'radial-gradient(circle, rgba(210,106,74,0.10) 0%, transparent 70%)', display: 'flex',
  }

  // ── Brand card (no score) — homepage / generic OG ──────────────────────────
  if (!hasScore) {
    return new ImageResponse(
      (
        <div style={frame}>
          <div style={accentStripe} />
          <div style={dotGrid} />
          <div style={glow} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 88px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
              <Logo size={46} />
              <span style={{ fontSize: 26, fontWeight: 700, color: HEADING, letterSpacing: '-0.03em' }}>CVCheck</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.04 }}>
              <span style={{ color: HEADING }}>Your CV, analyzed.</span>
              <span style={{ color: ACCENT }}>Brutally honest.</span>
            </div>
            <span style={{ fontSize: 24, color: SECOND, marginTop: 28, lineHeight: 1.4, maxWidth: 760 }}>
              A free AI score out of 100 — red flags, ATS gaps, and rewritten bullets in seconds.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '26px 88px', borderTop: `1px solid ${BORDER}`, position: 'relative' }}>
            <span style={{ fontSize: 17, color: TERTIARY }}>cvcheck.app</span>
            <div style={{ display: 'flex', padding: '12px 26px', background: ACCENT, borderRadius: 8, fontSize: 16, fontWeight: 700, color: BG }}>
              Check your CV free →
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    )
  }

  // ── Score card (share pages) ───────────────────────────────────────────────
  const color   = scoreColor(score)
  const rColor  = ratingColor(rating)
  const rLabel  = RATING_LABEL[rating] ?? rating
  const arcPath = describeArc(60, 60, 48, score / 100)
  const isDone  = score === 100

  return new ImageResponse(
    (
      <div style={frame}>
        <div style={accentStripe} />
        <div style={dotGrid} />
        <div style={glow} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '60px 80px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <Logo size={40} />
              <span style={{ fontSize: 22, fontWeight: 700, color: HEADING, letterSpacing: '-0.03em' }}>CVCheck</span>
            </div>
            {displaySource && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '7px 15px', background: ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, color: SECOND, fontFamily: 'monospace' }}>
                {displaySource}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 72, flex: 1 }}>
            <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0, display: 'flex' }}>
              <svg width="180" height="180" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="none" stroke={MUTED} strokeWidth="7" />
                {isDone
                  ? <circle cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="7" />
                  : <path d={arcPath} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 42, fontWeight: 800, color: HEADING, letterSpacing: '-0.04em', lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 13, color: TERTIARY, marginTop: 2 }}>/100</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: rColor, flexShrink: 0, display: 'flex' }} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: rColor }}>{rLabel}</span>
              </div>
              <div style={{ fontSize: 52, fontWeight: 800, color: HEADING, letterSpacing: '-0.04em', lineHeight: 1.05, display: 'flex', flexDirection: 'column' }}>
                <span>My CV scored</span>
                <span style={{ color }}>{score}/100</span>
              </div>
              <span style={{ fontSize: 18, color: SECOND, lineHeight: 1.5 }}>AI feedback on CVs, portfolios &amp; landing pages</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 32, borderTop: `1px solid ${BORDER}`, marginTop: 40 }}>
            <span style={{ fontSize: 15, color: TERTIARY }}>Check your CV for free at cvcheck.app</span>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px', background: ACCENT, borderRadius: 8, fontSize: 15, fontWeight: 700, color: BG, letterSpacing: '-0.01em' }}>
              Try CVCheck →
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
