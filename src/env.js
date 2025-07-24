import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env["NODE_ENV"] === "production"
        ? z.string()
        : z.string().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
    GOOGLE_CLIENT_ID:
      process.env["NODE_ENV"] === "development"
        ? z.string().optional()
        : z.string(),
    GOOGLE_CLIENT_SECRET:
      process.env["NODE_ENV"] === "development"
        ? z.string().optional()
        : z.string(),
    OPDB_API_URL: z.string().url().default("https://opdb.org/api"),
    DEFAULT_ORG_SUBDOMAIN: z.string().default("apc"),
    // Additional environment variables that were accessed directly via process.env
    VERCEL_URL: z.string().optional(),
    PORT: z.string().optional(),
    // Future API keys mentioned in the issue (optional for now)
    PINBALL_MAP_API_KEY: z.string().optional(),
    OPDB_API_KEY: z.string().optional(),
    // Image storage configuration
    IMAGE_STORAGE_PROVIDER: z.enum(["local", "vercel-blob"]).default("local"),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    // Seed configuration
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_NAME: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Next.js automatically exposes NODE_ENV to the client, no need to manually expose it
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env["AUTH_SECRET"],
    DATABASE_URL: process.env["DATABASE_URL"],
    NODE_ENV: process.env["NODE_ENV"],
    GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"],
    GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"],
    OPDB_API_URL: process.env["OPDB_API_URL"],
    DEFAULT_ORG_SUBDOMAIN: process.env["DEFAULT_ORG_SUBDOMAIN"],
    VERCEL_URL: process.env["VERCEL_URL"],
    PORT: process.env["PORT"],
    PINBALL_MAP_API_KEY: process.env["PINBALL_MAP_API_KEY"],
    OPDB_API_KEY: process.env["OPDB_API_KEY"],
    IMAGE_STORAGE_PROVIDER: process.env["IMAGE_STORAGE_PROVIDER"],
    BLOB_READ_WRITE_TOKEN: process.env["BLOB_READ_WRITE_TOKEN"],
    SEED_ADMIN_EMAIL: process.env["SEED_ADMIN_EMAIL"],
    SEED_ADMIN_NAME: process.env["SEED_ADMIN_NAME"],
    VERCEL_ENV: process.env["VERCEL_ENV"],
    // Next.js automatically exposes NODE_ENV to the client
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env["SKIP_ENV_VALIDATION"],
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
