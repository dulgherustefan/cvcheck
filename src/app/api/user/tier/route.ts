import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createSupabaseServer()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ tier: 'free' })
    }

    const { data, error } = await supabase
      .from('credits')
      .select('plan, subscription_end, used')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ tier: 'free', roast_count: 0 })
    }

    return NextResponse.json({
      tier: data.plan ?? 'free',
      subscription_end: data.subscription_end ?? null,
      roast_count: data.used ?? 0,
    })
  } catch {
    return NextResponse.json({ tier: 'free' })
  }
}
