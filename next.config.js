/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['playwright', 'pdf-parse'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle playwright for client
      config.externals = [...(config.externals || []), 'playwright']
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/share/:token*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
