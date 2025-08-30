import type { NextConfig } from "next";
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Vercel-specific configurations
  output: 'standalone',
  // Next.js 15: moved from experimental.serverComponentsExternalPackages
  serverExternalPackages: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/modifiers', '@dnd-kit/utilities'],
  // Reduce serverless function bundle size
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons', 
      'lucide-react',
      'framer-motion',
      'recharts',
      '@tabler/icons-react'
    ],
  },
  // Webpack optimization for smaller bundles
  webpack: (config, { isServer }) => {
    
    // Split chunks for better caching (client-side only)
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: 'recharts',
              chunks: 'async',
              priority: 30,
            },
            framer: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'async',
              priority: 30,
            },
            icons: {
              test: /[\\/]node_modules[\\/](@tabler\/icons-react|lucide-react)[\\/]/,
              name: 'icons',
              chunks: 'async',
              priority: 25,
            }
          }
        }
      };
    }
    
    return config;
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

export default withBundleAnalyzer(nextConfig);
