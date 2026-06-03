/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['playwright', 'pdf-parse'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'playwright']
    }
    return config
  },
  async headers() {
    return [
      // ── Security headers — applied to every route ──────────────────────────
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking — disallow embedding in iframes
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME sniffing attacks
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't send full URL as referrer to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser features not needed by this app
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Force HTTPS for 1 year (enable only after confirming HTTPS works everywhere)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Basic CSP — allows self + Supabase + Stripe + Resend CDN
          // Tighten this further once you confirm no inline scripts are needed
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com",   // unsafe-inline needed for Next.js inline scripts
              "style-src 'self' 'unsafe-inline'",                           // unsafe-inline needed for CSS-in-JS / inline styles
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.adzuna.com https://remotive.com https://api.resend.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },

      // ── Share pages — no caching (existing, preserved) ────────────────────
      {
        source: '/share/:token*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Surrogate-Control', value: 'no-store' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        ],
      },

      // ── API routes — no caching + stricter frame policy ───────────────────
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
