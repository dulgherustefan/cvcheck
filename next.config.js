/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'pdf-parse'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle playwright for client
      config.externals = [...(config.externals || []), 'playwright']
    }
    return config
  },
}

module.exports = nextConfig
