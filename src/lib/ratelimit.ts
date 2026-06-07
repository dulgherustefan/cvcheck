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
 * Falls back to a conservative in-memory limiter if Redis is unavailable.
 * The in-memory fallback resets on cold start — it is NOT a substitute for
 * Redis in production, but it is far safer than fail-open.
 */

import { Redis }     from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ── Config ────────────────────────────────────────────────────────────────────

const WINDOW   = '1 h' as const
const ANON_MAX = 10               // requests per hour for anonymous IPs
const AUTH_MAX = 30               // requests per hour for authenticated users

// In-memory fallback limits (more conservative than Redis limits)
// Resets on cold start — meant to prevent obvious abuse, not precise accounting
const FALLBACK_ANON_MAX = 5
const FALLBACK_AUTH_MAX = 15
const FALLBACK_WINDOW_MS = 60 * 60 * 1000  // 1 hour

const MAX_IDENTIFIER_LENGTH = 256

// ── In-memory fallback limiter ─────────────────────────────────────────────────

interface FallbackEntry { count: number; resetAt: number }
const fallbackStore = new Map<string, FallbackEntry>()

// Cleanup stale entries every 10 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of fallbackStore) {
    if (now > entry.resetAt) fallbackStore.delete(key)
  }
}, 10 * 60 * 1000)

function checkFallback(id: string, max: number): RateLimitResult {
  const now = Date.now()
  const entry = fallbackStore.get(id)

  if (!entry || now > entry.resetAt) {
    // New window
    fallbackStore.set(id, { count: 1, resetAt: now + FALLBACK_WINDOW_MS })
    return { allowed: true, remaining: max - 1, resetAt: now + FALLBACK_WINDOW_MS, limit: max }
  }

  entry.count++
  const allowed   = entry.count <= max
  const remaining = Math.max(0, max - entry.count)
  return { allowed, remaining, resetAt: entry.resetAt, limit: max }
}

// ── Redis client ──────────────────────────────────────────────────────────────

function makeRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[ratelimit] Redis env vars missing in production — using conservative in-memory fallback')
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
  const limiter      = isAuthed ? limitAuth      : limitAnon
  const limit        = isAuthed ? AUTH_MAX        : ANON_MAX
  const fallbackMax  = isAuthed ? FALLBACK_AUTH_MAX : FALLBACK_ANON_MAX

  const safeId = identifier.slice(0, MAX_IDENTIFIER_LENGTH).replace(/[^\w:.-]/g, '_')

  // No Redis configured → conservative in-memory fallback
  if (!limiter) {
    return checkFallback(safeId, fallbackMax)
  }

  try {
    const { success, remaining, reset } = await limiter.limit(safeId)
    return {
      allowed:   success,
      remaining: Math.max(0, remaining),
      resetAt:   reset,
      limit,
    }
  } catch (err) {
    // Redis temporarily down → fall back to in-memory limiter, NOT open
    console.error('[ratelimit] Redis error — falling back to in-memory limiter:', err instanceof Error ? err.message : err)
    return checkFallback(safeId, fallbackMax)
  }
}

/**
 * Build the identifier string used as the Redis key.
 * Authenticated users are keyed by user ID (stable across IPs).
 * Anonymous users are keyed by IP (best-effort).
 */
export function makeIdentifier(userId: string | null, ip: string): string {
  if (userId) {
    return `user:${userId.slice(0, 36)}`
  }
  const safeIp = ip.replace(/[^\d.:/a-fA-F[\]]/g, '').slice(0, 45)
  return `ip:${safeIp || 'unknown'}`
}
