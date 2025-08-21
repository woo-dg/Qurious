/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  eslint: {
    // ✅ allow production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },

  typescript: {
    // ✅ allow production builds to complete even with type errors
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
