'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { Tier } from '@/lib/types'

export function useTier(userId: string | null | undefined): { tier: Tier; loading: boolean } {
  const [tier, setTier]       = useState<Tier>('free')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) { setTier('free'); return }

    let cancelled = false
    setLoading(true)

    const supabase = createSupabaseBrowser()

    // Race the DB query against a 5s timeout — if Supabase is slow, default to 'free'
    // NOTE: useTier drives UI display only. All actual gating is enforced server-side.
    const timeout = new Promise<{ data: null }>((resolve) =>
      setTimeout(() => resolve({ data: null }), 5000),
    )
    const query = supabase
      .from('credits')
      .select('plan')
      .eq('user_id', userId)
      .single()

    Promise.race([query, timeout]).then((result) => {
      if (cancelled) return
      const plan = result?.data?.plan
      if (plan === 'premium' || plan === 'pro') setTier(plan)
      else setTier('free')
      setLoading(false)
    }).catch(() => {
      if (!cancelled) { setTier('free'); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [userId])

  return { tier, loading }
}
