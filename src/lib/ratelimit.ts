/**
 * Rate limiting via Upstash Redis.
 *
 * Setup (one-time):
 *   1. https://console.upstash.com → Create Database → copy REST URL + token
 *   2. Add to .env.local (and Vercel env vars):
 *        UPSTASH_REDIS_REST_URL=https://...upstash.io
 *        UPSTASH_REDIS_REST_TOKEN=...
 *   3. npm install @upstash/redis @upstash/ratelimit
 *
 * Falls back to allow-all if env vars are missing (dev without Redis).
 * WARNING: the fallback is intentionally permissive for local dev only.
 * Ensure Redis is configured in all production environments.
 */

import { Redis }     from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ── Config ────────────────────────────────────────────────────────────────────

const WINDOW   = '1 h' as const  // sliding window duration
const ANON_MAX = 10               // requests per window for anonymous IPs
const AUTH_MAX = 30               // requests per window for authenticated users

// Max length for identifier strings stored in Redis — prevent oversized keys
const MAX_IDENTIFIER_LENGTH = 256

// ── Client (lazy — only instantiated when env vars are present) ───────────────

function makeRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    // Warn loudly in production — silent allow-all is dangerous
    if (process.env.NODE_ENV === 'production') {
      console.warn('[ratelimit] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set in production — rate limiting is DISABLED')
    }
    return null
  }
  return new Redis({ url, token })
}

const redis = makeRedis()

const limitAnon = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(ANON_MAX, WINDOW), prefix: 'rl:anon' })
  : null

const limitAuth = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(AUTH_MAX, WINDOW), prefix: 'rl:auth' })
  : null

// ── Public API ────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   number  // unix ms
  limit:     number
}

/**
 * Check rate limit for a request.
 * @param identifier  "user:<uuid>" for authed users, "ip:<addr>" for anon
 * @param isAuthed    selects the higher authed limit when true
 */
export async function checkRateLimit(
  identifier: string,
  isAuthed:   boolean,
): Promise<RateLimitResult> {
  const limiter = isAuthed ? limitAuth : limitAnon
  const limit   = isAuthed ? AUTH_MAX  : ANON_MAX

  // No Redis configured — allow everything (local dev only)
  if (!limiter) {
    return { allowed: true, remaining: limit - 1, resetAt: Date.now() + 3_600_000, limit }
  }

  // Sanitize identifier before using as Redis key
  const safeId = identifier.slice(0, MAX_IDENTIFIER_LENGTH).replace(/[^\w:.-]/g, '_')

  try {
    const { success, remaining, reset } = await limiter.limit(safeId)
    return {
      allowed:   success,
      remaining: Math.max(0, remaining),
      resetAt:   reset,
      limit,
    }
  } catch (err) {
    // If Redis is temporarily down, fail open (allow request) but log loudly
    console.error('[ratelimit] Redis error — failing open:', err instanceof Error ? err.message : err)
    return { allowed: true, remaining: 0, resetAt: Date.now() + 3_600_000, limit }
  }
}

/**
 * Build the identifier string used as the Redis key.
 * Authenticated users are keyed by user ID (stable across IPs).
 * Anonymous users are keyed by IP (best-effort).
 */
export function makeIdentifier(userId: string | null, ip: string): string {
  if (userId) {
    // UUID format only — prevent arbitrary strings as Redis keys
    return `user:${userId.slice(0, 36)}`
  }
  // IP: allow only valid chars, cap length
  const safeIp = ip.replace(/[^\d.:/a-fA-F[\]]/g, '').slice(0, 45)
  return `ip:${safeIp || 'unknown'}`
}
