/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright rulează server-side, nu în browser
  serverExternalPackages: ['playwright'],
}

module.exports = nextConfig
