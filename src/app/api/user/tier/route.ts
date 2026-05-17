import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createSupabaseServer()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ tier: 'free' })
    }

    // Fetch from credits table (or users/subscriptions table — adjust to your schema)
    const { data, error } = await supabase
      .from('credits')
      .select('tier, subscription_end, roast_count')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ tier: 'free', roast_count: 0 })
    }

    return NextResponse.json({
      tier: data.tier ?? 'free',
      subscription_end: data.subscription_end ?? null,
      roast_count: data.roast_count ?? 0,
    })
  } catch {
    return NextResponse.json({ tier: 'free' })
  }
}
