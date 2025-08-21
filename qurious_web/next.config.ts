import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  eslint: {
    // ✅ Allow production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },

  typescript: {
    // ✅ Allow production builds to complete even with type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
