/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    styledComponents: true,
  },
  images: {
    domains: ['vercel.com'],
  },
  env: {
    // Add any environment variables you need here
  },
};

module.exports = nextConfig; 