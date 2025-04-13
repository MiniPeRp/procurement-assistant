/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
  compiler: {
    styledComponents: true,
  },
  images: {
    domains: ['vercel.com'],
  },
  env: {
    // Add any environment variables you need here
  },
  experimental: {
    optimizeFonts: true,
  },
};

module.exports = nextConfig; 