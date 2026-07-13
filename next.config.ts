import { withSentryConfig } from "@sentry/nextjs";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Central registry of production-required env vars (CORE-SEC-009). Fails the
// Vercel build (rather than deploy and 500 / silently degrade at runtime) when
// a required secret is missing. Skipped on local builds and vercel-dev because
// VERCEL_ENV is only set in Vercel build/runtime environments. Preview deploys
// are validated too because Tim mirrors prod secrets into both Production and
// Preview scopes.
//
// Each entry is a group of one or more names that is satisfied if ANY of its
// names is present — this models the documented alias pairs (Supabase docs vs
// the Vercel integration naming) without false-failing when the alias is the
// one that's set. Full catalog + scope matrix: docs/ENV_VARS.md.
//
// When you add a new production-required env var, add it here (CORE-SEC-009).
type RequiredEnvGroup = readonly [primary: string, ...aliases: string[]];

// Required in every deployment scope (Production AND Preview).
const REQUIRED_ALL_DEPLOYMENTS: readonly RequiredEnvGroup[] = [
  ["UNSUBSCRIBE_SIGNING_SECRET"],
  ["POSTGRES_URL"],
  ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
  ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
];

// Required in Production only. Preview resolves the canonical site URL from
// VERCEL_URL (see src/lib/url.ts getSiteUrl), so it is not required there.
const REQUIRED_PRODUCTION_ONLY: readonly RequiredEnvGroup[] = [
  ["NEXT_PUBLIC_SITE_URL"],
];

function assertVercelDeploymentEnv(): void {
  const env = process.env["VERCEL_ENV"];
  if (env !== "production" && env !== "preview") return;

  const groups =
    env === "production"
      ? [...REQUIRED_ALL_DEPLOYMENTS, ...REQUIRED_PRODUCTION_ONLY]
      : REQUIRED_ALL_DEPLOYMENTS;

  // A group is missing only when NONE of its alias names is set.
  const missing = groups
    .filter((group) => !group.some((name) => process.env[name]))
    .map((group) => group.join(" | "));
  if (missing.length === 0) return;

  throw new Error(
    `Deployment aborted: missing required ${env} env var(s): ${missing.join(", ")}. ` +
      "Set them in Vercel → Project Settings → Environment Variables for the affected scope. " +
      "See docs/ENV_VARS.md (CORE-SEC-009)."
  );
}

assertVercelDeploymentEnv();

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Image uploads are sent through Server Actions as multipart FormData.
      // Set above 10MB app-level validation limit (BLOB_CONFIG.MAX_FILE_SIZE_BYTES)
      // to account for multipart FormData overhead (~20% buffer) and avoid 413s at 1MB default.
      bodySizeLimit: "12mb",
    },
  },
  typescript: {
    // App-source project. The root tsconfig.json is references-only after the
    // PP-4k76 solution-style split, so Next reads the concrete app config here.
    tsconfigPath: "./tsconfig.app.json",
  },
  // Keep pino and its worker dependency external so Turbopack doesn't try to bundle their test fixtures.
  serverExternalPackages: ["pino", "thread-stream"],
  turbopack: {
    resolveAlias: {
      "~/*": "./src/*",
      "@/*": "./src/*",
      "@content/*": "./content/*",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Wildcard for Vercel Blob storage subdomains which may vary across regions/deployments
        hostname: "**.public.blob.vercel-storage.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  async redirects() {
    return [
      // Shortlink for the quick report grid (PP-sn34). Temporary (307) so the
      // canonical target can move without browsers hard-caching the redirect.
      {
        source: "/rq",
        destination: "/report/quick",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX();

export default withSentryConfig(withMDX(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "pinpoint-nc",
  project: "pinpoint",

  // Source maps still upload to Sentry; silent only suppresses verbose CLI output
  silent: true,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  // @ts-ignore - treeshake is a valid but potentially untyped property in some versions
  treeshake: {
    removeDebugLogging: true,
  },
});
