import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel-specific configurations
  output: 'standalone',
  // Next.js 15: moved from experimental.serverComponentsExternalPackages
  serverExternalPackages: [],
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // Handle API proxy for Python backend in development
  async rewrites() {
    return [
      {
        source: '/api/rag/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:8058/api/:path*'
          : '/api/:path*',
      },
    ];
  },
  // Environment variables that should be available at build time
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
};

export default nextConfig;
