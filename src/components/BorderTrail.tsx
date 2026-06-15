'use client'

import { motion } from 'framer-motion'

interface BorderTrailProps {
  /** Diameter of the travelling glow, in px. */
  size?: number
  /** Seconds for one full loop around the border. */
  duration?: number
}

/**
 * A soft accent light that travels around the inner edge of its parent.
 * Adapted from the shadcn "BorderTrail" effect to the project's CSS-variable
 * system (lime accent, no Tailwind). The parent must be `position: relative`.
 */
export function BorderTrail({ size = 120, duration = 6 }: BorderTrailProps) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <motion.div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(61,255,160,0.55) 0%, rgba(61,255,160,0) 70%)',
          // Travel the rectangular perimeter of the parent.
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ repeat: Infinity, duration, ease: 'linear' }}
      />
    </div>
  )
}
