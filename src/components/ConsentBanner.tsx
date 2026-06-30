'use client'

import { useEffect, useState } from 'react'

const KEY = 'cvcheck_analytics_consent'

type Gtag = (...args: unknown[]) => void

export function ConsentBanner() {
  const [show, setShow] = useState(false)

  // Decide visibility on the client only (avoids hydration mismatch). The banner
  // shows once, until the visitor makes a choice that we remember in localStorage.
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(KEY) } catch {}
    if (saved !== 'granted' && saved !== 'denied') setShow(true)
  }, [])

  const choose = (granted: boolean) => {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied') } catch {}
    const g = (window as unknown as { gtag?: Gtag }).gtag
    if (typeof g === 'function') {
      g('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' })
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="consent-banner" role="dialog" aria-label="Cookie consent">
      <p className="consent-text">
        We use Google Analytics to see how the site is used and make it better. No ads, and we never sell your data.{' '}
        <a href="/privacy" className="consent-link">Privacy</a>
      </p>
      <div className="consent-actions">
        <button className="consent-btn-reject" onClick={() => choose(false)}>Reject</button>
        <button className="consent-btn-accept" onClick={() => choose(true)}>Accept</button>
      </div>
    </div>
  )
}
