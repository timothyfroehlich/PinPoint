import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  // Keep pino and its worker dependency external so Turbopack doesn't try to bundle their test fixtures.
  serverExternalPackages: ["pino", "thread-stream"],
  // Enable Onlook visual editor in development mode only
  ...(isDevelopment && {
    experimental: {
      swcPlugins: [["@onlook/nextjs", { root: path.resolve(".") }]],
    },
  }),
  turbopack: {
    resolveAlias: {
      "~/*": "./src/*",
      "@/*": "./src/*",
    },
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
            value: "DENY",
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "pinpoint-nc",
  project: "pinpoint",

  // Only print logs for uploading source maps in CI
  silent: !process.env["CI"],

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
