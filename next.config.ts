import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel-specific configurations
  output: 'standalone',
  // Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons', 
      'lucide-react',
      '@tabler/icons-react'
    ],
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
