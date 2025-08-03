/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");


/** @type {import("next").NextConfig} */
const config = {
  env: {
    // Automatically expose VERCEL_ENV as a client-accessible variable
    // This enables client-side environment detection without manual configuration
    // Fallback hierarchy: VERCEL_ENV → NODE_ENV → 'development'
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default config;
