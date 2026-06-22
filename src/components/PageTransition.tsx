'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // fill: 'backwards' applies the start frame before the run (no flash) but
    // does NOT retain the end frame afterwards. Critical: 'both' would leave a
    // lingering transform on this wrapper, and any transform on an ancestor
    // makes position:fixed descendants (every modal) resolve against THIS div
    // instead of the viewport — centering them far down a tall page, off-screen.
    const anim = el.animate(
      [
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 160, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
    )
    return () => anim.cancel()
  }, [pathname])

  return <div ref={ref}>{children}</div>
}
