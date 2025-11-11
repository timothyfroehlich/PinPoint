import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  turbopack: {
    resolveAlias: {
      "~/*": "./src/*",
      "@/*": "./src/*",
    },
  },
};

export default nextConfig;
