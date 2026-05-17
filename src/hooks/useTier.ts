'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { Tier } from '@/lib/types'

export function useTier(userId: string | null | undefined): { tier: Tier; loading: boolean } {
  const [tier, setTier] = useState<Tier>('free')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) { setTier('free'); return }

    setLoading(true)
    const supabase = createSupabaseBrowser()
    supabase
      .from('credits')
      .select('plan')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        const plan = data?.plan
        if (plan === 'premium' || plan === 'pro') setTier(plan)
        else setTier('free')
        setLoading(false)
      })
  }, [userId])

  return { tier, loading }
}
