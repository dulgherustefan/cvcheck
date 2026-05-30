'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('cvcheck-theme')
    const current = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(current as 'light' | 'dark')
  }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('cvcheck-theme', next)
  }

  if (!mounted) return <div style={{ width: 36, height: 36 }} />

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-strong)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--accent-subtle)'
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.color = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      {theme === 'light' ? (
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      ) : (
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      )}
    </button>
  )
}
