'use client'

import { useEffect, useRef } from 'react'

export function HeroDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const c = canvas
    const context = ctx

    const GAP = 28
    const DOT_R = 1.5
    const GLOW_RADIUS = 120
    const ACCENT = { r: 210, g: 106, b: 74 }

    let raf: number
    let cols: number, rows: number

    function resize() {
      c.width = c.offsetWidth
      c.height = c.offsetHeight
      cols = Math.ceil(c.width / GAP) + 1
      rows = Math.ceil(c.height / GAP) + 1
    }

    function draw() {
      context.clearRect(0, 0, c.width, c.height)
      const { x: mx, y: my } = mouseRef.current

      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = col * GAP
          const y = r * GAP
          const dist = Math.hypot(x - mx, y - my)
          const influence = Math.max(0, 1 - dist / GLOW_RADIUS)

          if (influence > 0) {
            const alpha = 0.18 + influence * 0.72
            const size = DOT_R + influence * 1.8
            context.beginPath()
            context.arc(x, y, size, 0, Math.PI * 2)
            context.fillStyle = `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${alpha})`
            context.fill()
          } else {
            context.beginPath()
            context.arc(x, y, DOT_R, 0, Math.PI * 2)
            context.fillStyle = 'rgba(42,37,31,0.12)'
            context.fill()
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }

    function onMouseMove(e: MouseEvent) {
      const rect = c.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    resize()
    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(c)
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="hero-dot-grid"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
