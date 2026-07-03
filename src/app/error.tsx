'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error to the console / monitoring; never render raw details.
    console.error('[app-error]', error)
  }, [error])

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '24px', background: 'var(--bg)', color: 'var(--text-primary)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--score-low)', marginBottom: '16px',
      }}>
        Something broke
      </div>
      <h1 style={{
        fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 600, lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--text-heading)', marginBottom: '12px',
      }}>
        Unexpected error
      </h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '28px' }}>
        Something went wrong on our end. Try again, and refresh the page if it keeps happening.
      </p>
      <button onClick={reset} className="btn-primary" style={{
        background: 'var(--accent)', color: 'var(--text-inverse)',
        fontWeight: 600, padding: '12px 24px', borderRadius: 'var(--radius-md)',
      }}>
        Try again
      </button>
    </main>
  )
}
