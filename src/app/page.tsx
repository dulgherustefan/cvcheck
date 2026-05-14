'use client'
// src/app/page.tsx
// Landing page + formularul de input + afișarea rezultatelor
// Tot într-un singur fișier la MVP — simplu și ușor de înțeles

import { useState } from 'react'
import { RoastResult, VibeCheck } from '@/lib/types'

// ── Culori pentru fiecare vibe ───────────────────────────────────
const VIBE_COLORS: Record<VibeCheck, { bg: string; text: string; border: string }> = {
  nightmare: { bg: '#1a0000', text: '#ff4444', border: '#ff4444' },
  rough:     { bg: '#1a0800', text: '#ff8800', border: '#ff8800' },
  meh:       { bg: '#1a1500', text: '#ffcc00', border: '#ffcc00' },
  decent:    { bg: '#001a00', text: '#44ff88', border: '#44ff88' },
  solid:     { bg: '#001a1a', text: '#44ccff', border: '#44ccff' },
  impressive:{ bg: '#0a001a', text: '#aa44ff', border: '#aa44ff' },
}

const VIBE_EMOJI: Record<VibeCheck, string> = {
  nightmare: '💀', rough: '😬', meh: '😐', decent: '🙂', solid: '😎', impressive: '🔥'
}

// ── Componenta pentru bara de scor ──────────────────────────────
function ScoreBar({ label, score, max = 25 }: { label: string; score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = pct >= 70 ? '#44ff88' : pct >= 45 ? '#ffcc00' : '#ff4444'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: '#999' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{score}/{max}</span>
      </div>
      <div style={{ height: 4, background: '#222', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

// ── Componenta rezultat ──────────────────────────────────────────
function RoastCard({ result, url }: { result: RoastResult; url: string }) {
  const vibe = VIBE_COLORS[result.vibe_check]
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = `Got roasted by Roastd 🔥\n\nScore: ${result.total_score}/100 (${result.vibe_check})\n\n"${result.pull_quote}"\n\nRoast yours at roastd.com`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'monospace' }}>

      {/* Scor mare */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 80, fontWeight: 900, color: vibe.text, lineHeight: 1 }}>
          {result.total_score}
        </div>
        <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>din 100</div>
        <div style={{
          display: 'inline-block', marginTop: 12,
          padding: '4px 16px', borderRadius: 20,
          border: `1px solid ${vibe.border}`,
          color: vibe.text, fontSize: 13, fontWeight: 600,
        }}>
          {VIBE_EMOJI[result.vibe_check]} {result.vibe_check.toUpperCase()}
        </div>
      </div>

      {/* Pull quote - shareabil */}
      <div style={{
        border: `1px solid ${vibe.border}`,
        borderRadius: 8, padding: '20px 24px',
        marginBottom: 24, background: vibe.bg,
      }}>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>Verdict</div>
        <blockquote style={{ margin: 0, fontSize: 18, color: vibe.text, fontStyle: 'italic', lineHeight: 1.5 }}>
          "{result.pull_quote}"
        </blockquote>
      </div>

      {/* Sub-scoruri */}
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Breakdown</div>
        <ScoreBar label="Clarity" score={result.scores.clarity} />
        <ScoreBar label="Credibility" score={result.scores.credibility} />
        <ScoreBar label="Design & UX" score={result.scores.design} />
        <ScoreBar label="Conversion" score={result.scores.conversion} />
      </div>

      {/* Roast lines */}
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 2 }}>Roast</div>
        {result.roast_lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
            <span style={{ color: '#ff4444', flexShrink: 0, marginTop: 2 }}>→</span>
            <p style={{ margin: 0, fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{line}</p>
          </div>
        ))}
      </div>

      {/* Priority */}
      <div style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, padding: '16px 24px', marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#2a5a2a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>Fix this first</div>
        <p style={{ margin: 0, fontSize: 14, color: '#44ff88', lineHeight: 1.6 }}>{result.one_priority}</p>
      </div>

      {/* Share button */}
      <button
        onClick={handleCopy}
        style={{
          width: '100%', padding: '14px', borderRadius: 8,
          background: copied ? '#1a3a1a' : '#111',
          border: `1px solid ${copied ? '#44ff88' : '#333'}`,
          color: copied ? '#44ff88' : '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'monospace', transition: 'all 0.2s',
        }}
      >
        {copied ? '✓ Copiat în clipboard' : '↗ Distribuie roast-ul'}
      </button>
    </div>
  )
}

// ── Pagina principală ────────────────────────────────────────────
export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RoastResult | null>(null)
  const [roastedUrl, setRoastedUrl] = useState('')
  const [error, setError] = useState('')

  const handleRoast = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Ceva a mers prost')
      } else {
        setResult(data.result)
        setRoastedUrl(url.trim())
      }
    } catch {
      setError('Eroare de rețea. Verifică conexiunea și încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh', background: '#080808', color: '#fff',
      fontFamily: 'monospace', padding: '0 20px',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '80px 0 60px' }}>
        <div style={{ fontSize: 12, color: '#ff4444', letterSpacing: 4, marginBottom: 16 }}>
          BRUTALLY HONEST FEEDBACK
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 900, margin: '0 0 16px', letterSpacing: -2 }}>
          Roast<span style={{ color: '#ff4444' }}>d</span>
        </h1>
        <p style={{ fontSize: 16, color: '#666', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          Trimite-ți portofoliul, CV-ul sau landing page-ul.
          Primești un scor din 100 și feedback brutal în sub 60 de secunde.
        </p>
      </div>

      {/* Input */}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRoast()}
            placeholder="https://yourportfolio.com"
            disabled={loading}
            style={{
              flex: 1, padding: '14px 18px', borderRadius: 8,
              background: '#111', border: '1px solid #333', color: '#fff',
              fontSize: 15, fontFamily: 'monospace', outline: 'none',
            }}
          />
          <button
            onClick={handleRoast}
            disabled={loading || !url.trim()}
            style={{
              padding: '14px 24px', borderRadius: 8,
              background: loading ? '#1a0000' : '#ff4444',
              border: 'none', color: '#fff', fontSize: 15,
              fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'monospace', whiteSpace: 'nowrap',
              opacity: !url.trim() ? 0.5 : 1,
            }}
          >
            {loading ? '...' : 'Roast it →'}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔥</div>
            <p style={{ margin: 0 }}>Se analizează... (~20-40 secunde)</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8,
            background: '#1a0000', border: '1px solid #ff4444',
            color: '#ff8888', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Rezultat */}
        {result && <RoastCard result={result} url={roastedUrl} />}

        {/* Social proof placeholder */}
        {!result && !loading && (
          <div style={{ textAlign: 'center', marginTop: 60, color: '#333', fontSize: 13 }}>
            3 roast-uri gratuite · Fără cont necesar
          </div>
        )}
      </div>

    </main>
  )
}
