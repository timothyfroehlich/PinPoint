import type { NextConfig } from "next";

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
};

export default nextConfig;
