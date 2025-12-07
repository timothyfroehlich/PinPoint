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
  // Suppresses source map upload logs during build
  silent: true,
};

// Only set org and project if defined (for source map uploads)
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
