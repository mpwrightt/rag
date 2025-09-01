import type { NextConfig } from "next";

const isStandalone = process.env.NEXT_OUTPUT_STANDALONE === 'true' || !!process.env.VERCEL;

const nextConfig: NextConfig = {
  // Prefer standalone only on Vercel or when explicitly enabled to avoid Windows symlink issues
  output: isStandalone ? 'standalone' : undefined,
  // Reduce potential build-time blockers on Windows CI
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Avoid type-checking from blocking builds; CI can run `tsc --noEmit` separately
    ignoreBuildErrors: true,
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // No API proxy needed - backend runs on Replit
  // Environment variables that should be available at build time
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
};

export default nextConfig;
