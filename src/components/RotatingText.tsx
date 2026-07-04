'use client'

import { useState, useEffect, useRef } from 'react'

interface RotatingTextProps {
  texts: string[]
  interval?: number
}

export function RotatingText({ texts, interval = 5000 }: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (texts.length <= 1 || paused) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setIndex(i => (i + 1) % texts.length)
        setAnimating(false)
      }, 240)
    }, interval)
    return () => clearInterval(id)
  }, [texts.length, interval, paused])

  return (
    <span
      className={`rotating-text-outer${animating ? ' rotating-text-exit' : ''}`}
      aria-label={texts[index]}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span
        ref={trackRef}
        className="rotating-text-item"
        aria-hidden="true"
      >
        {texts[index]}
      </span>
    </span>
  )
}
