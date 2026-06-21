import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '24px', background: 'var(--bg)', color: 'var(--text-primary)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '16px',
      }}>
        404
      </div>
      <h1 style={{
        fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 600, lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--text-heading)', marginBottom: '12px',
      }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '28px' }}>
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link href="/" className="btn-primary" style={{
        display: 'inline-block', background: 'var(--accent)', color: 'var(--text-inverse)',
        fontWeight: 600, padding: '12px 24px', borderRadius: 'var(--radius-md)', textDecoration: 'none',
      }}>
        Back to CVCheck
      </Link>
    </main>
  )
}
