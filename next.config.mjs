/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");


/** @type {import("next").NextConfig} */
const config = {
  env: {
    // Only expose VERCEL_ENV if it actually exists (i.e., running on Vercel)
    // Don't artificially create this variable - let client code handle undefined case
    ...(process.env.VERCEL_ENV ? { NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV } : {}),
  },
  
  // Fix pino logging worker thread issues with Turbopack
  serverExternalPackages: [
    'pino',
    'pino-pretty', 
    'thread-stream',
    'pino-abstract-transport',
    'on-exit-leak-free'
  ],

  // React Compiler for automatic optimization (2025)
  // In Next.js 16, reactCompiler is now a top-level option
  reactCompiler: true,
  
  experimental: {
    // optimizeCss: true, // Temporarily disabled while Tailwind v4 is stabilizing
  },
};

export default config;
