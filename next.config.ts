import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  // Keep pino and its worker dependency external so Turbopack doesn't try to bundle their test fixtures.
  serverExternalPackages: ["pino", "thread-stream"],
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

// Wrap config with Sentry for error tracking and source maps
const sentryOptions: Parameters<typeof withSentryConfig>[1] = {
  org: "pinpoint-nc",
  project: "pinpoint",

  // Only print logs for uploading source maps in CI
  silent: !process.env["CI"],

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors.
  automaticVercelMonitors: false,
};

// Override org and project if defined in env vars
if (process.env["SENTRY_ORG"]) {
  sentryOptions.org = process.env["SENTRY_ORG"];
}
if (process.env["SENTRY_PROJECT"]) {
  sentryOptions.project = process.env["SENTRY_PROJECT"];
}

// Conditionally apply Sentry wrapper
const SentryWrappedNextConfig = process.env["NEXT_PUBLIC_SENTRY_DSN"]
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;

export default SentryWrappedNextConfig;
