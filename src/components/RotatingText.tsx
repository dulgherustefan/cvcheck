'use client'

import { useState, useEffect, useRef } from 'react'

interface RotatingTextProps {
  texts: string[]
  interval?: number
}

export function RotatingText({ texts, interval = 2400 }: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const trackRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (texts.length <= 1) return
    const id = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setIndex(i => (i + 1) % texts.length)
        setAnimating(false)
      }, 240)
    }, interval)
    return () => clearInterval(id)
  }, [texts.length, interval])

  return (
    <span
      className={`rotating-text-outer${animating ? ' rotating-text-exit' : ''}`}
      aria-label={texts[index]}
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
