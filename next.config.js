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
    ]
  },
}

module.exports = nextConfig
