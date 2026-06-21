// Shared request-auth helpers.
// Centralizes JWT extraction + length validation so every route validates the
// token the same way before hitting Supabase (avoids inconsistent checks).

import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MIN_TOKEN_LEN = 20
const MAX_TOKEN_LEN = 2048

/** Extracts and validates the Bearer token, returning the user id or null. */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const auth = await getUserFromRequest(req)
  return auth?.userId ?? null
}

/** Like getUserIdFromRequest but also returns the user's email when present. */
export async function getUserFromRequest(
  req: NextRequest,
): Promise<{ userId: string; email: string | null } | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.slice('Bearer '.length)
    // Sanity-check token length before hitting Supabase
    if (token.length < MIN_TOKEN_LEN || token.length > MAX_TOKEN_LEN) return null
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return { userId: user.id, email: user.email ?? null }
  } catch {
    return null
  }
}
