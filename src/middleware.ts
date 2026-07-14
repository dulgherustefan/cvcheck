import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddleware } from '@/lib/supabase'

// Flip to false to bring the site back up — no other change needed.
const SITE_CLOSED = true

const CLOSED_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>CVCheck</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#FBF8F2;color:#2A251F;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}main{max-width:420px}h1{font-size:20px;margin:0 0 8px}p{color:#6B6459;font-size:14px;line-height:1.5;margin:0}</style>
</head><body><main><h1>CVCheck is currently unavailable</h1><p>The site is offline right now. No analyses or payments are being processed.</p></main></body></html>`

export async function middleware(request: NextRequest) {
  if (SITE_CLOSED) {
    return new NextResponse(CLOSED_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '86400' },
    })
  }

  const response = NextResponse.next({ request })
  const supabase = createSupabaseMiddleware(request, response)

  // Refresh session — keeps auth cookies fresh automatically
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static files and _next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
