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

    const GAP = 28
    const DOT_R = 1.5
    const GLOW_RADIUS = 120
    const ACCENT = { r: 168, g: 255, b: 62 }

    let raf: number
    let cols: number, rows: number

    function resize() {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      cols = Math.ceil(canvas.width / GAP) + 1
      rows = Math.ceil(canvas.height / GAP) + 1
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const { x: mx, y: my } = mouseRef.current

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * GAP
          const y = r * GAP
          const dist = Math.hypot(x - mx, y - my)
          const influence = Math.max(0, 1 - dist / GLOW_RADIUS)

          if (influence > 0) {
            const alpha = 0.18 + influence * 0.72
            const size = DOT_R + influence * 1.8
            ctx.beginPath()
            ctx.arc(x, y, size, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${alpha})`
            ctx.fill()
          } else {
            ctx.beginPath()
            ctx.arc(x, y, DOT_R, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.18)'
            ctx.fill()
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    resize()
    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
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
