import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Environment Detection Helper
 * Uses VERCEL_ENV for proper deployment environment detection
 * SECURITY: Defaults to production mode for fail-secure behavior
 */
function getEnvironmentType() {
  // Test environment - set by test runners
  if (process.env["NODE_ENV"] === "test") return "test";

  // Use VERCEL_ENV if available (Vercel deployments)
  if (process.env["VERCEL_ENV"]) return process.env["VERCEL_ENV"];

  // Local development - must be explicitly set
  if (process.env["NODE_ENV"] === "development") return "development";

  // SECURITY: Default to production mode (fail-secure)
  // This prevents accidentally enabling dev features in production
  console.warn(
    "[env] WARNING: Defaulting to 'production' environment because neither NODE_ENV nor VERCEL_ENV are set. " +
      "This may indicate a misconfiguration in your development environment. " +
      "Set NODE_ENV to 'development' or VERCEL_ENV appropriately to avoid this warning.",
  );
  return "production";
}

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      getEnvironmentType() === "production"
        ? z.string()
        : z.string().optional(),
    DATABASE_URL:
      getEnvironmentType() === "test"
        ? z.string().url().optional()
        : z.string().url(),
    DIRECT_URL:
      getEnvironmentType() === "test"
        ? z.string().url().optional()
        : z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
    GOOGLE_CLIENT_ID:
      getEnvironmentType() === "production"
        ? z.string()
        : z.string().optional(),
    GOOGLE_CLIENT_SECRET:
      getEnvironmentType() === "production"
        ? z.string()
        : z.string().optional(),
    OPDB_API_URL: z.string().url().default("https://opdb.org/api"),
    // DEFAULT_ORG_SUBDOMAIN has been removed for security: organization context
    // must be derived from the request subdomain (middleware-verified) rather
    // than a silent global fallback. Handle any marketing or default routes at
    // the application level explicitly.
    // Additional environment variables that were accessed directly via process.env
    VERCEL_URL: z.string().optional(),
    PORT: z.string().optional(),
    // Supabase Authentication Configuration
    SUPABASE_URL:
      getEnvironmentType() === "test"
        ? z.string().url().optional()
        : z.string().url("Supabase URL must be a valid URL"),
    SUPABASE_SECRET_KEY:
      getEnvironmentType() === "test"
        ? z.string().optional()
        : z.string().min(1, "Supabase secret key is required"),
    SUPABASE_JWT_SECRET:
      getEnvironmentType() === "test"
        ? z.string().optional()
        : z.string().min(1, "Supabase JWT secret is required"),
    SUPABASE_DB_URL:
      getEnvironmentType() === "test"
        ? z.string().url().optional()
        : z.string().url().optional(), // Direct database connection URL
    // Future API keys mentioned in the issue (optional for now)
    PINBALL_MAP_API_KEY: z.string().optional(),
    OPDB_API_KEY: z.string().optional(),
    // Image storage configuration
    IMAGE_STORAGE_PROVIDER: z.enum(["local", "vercel-blob"]).default("local"),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    // Seed configuration
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_NAME: z.string().optional(),
    // Temporary override for production deployment
    FORCE_PREVIEW_BEHAVIOR: z.string().optional(),
    // Logging configuration
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .optional(),
    // Test environment variables
    VITEST: z.string().optional(), // Set by Vitest test runner
    CI: z.string().optional(), // Set by CI environments
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Environment Detection (client-safe)
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .optional(),
    // Dev features toggle (client-safe)
    NEXT_PUBLIC_ENABLE_DEV_FEATURES: z
      .string()
      .transform((s) => s === "true")
      .default(false),
    // Supabase Public Configuration
    NEXT_PUBLIC_SUPABASE_URL:
      getEnvironmentType() === "test"
        ? z.string().url().optional()
        : z.string().url("Public Supabase URL must be valid"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      getEnvironmentType() === "test"
        ? z.string().optional()
        : z.string().min(1, "Public anon key is required"),
    // Next.js automatically exposes NODE_ENV to the client, no need to manually expose it
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env["AUTH_SECRET"],
    DATABASE_URL: process.env["DATABASE_URL"],
    DIRECT_URL: process.env["DIRECT_URL"],
    NODE_ENV: process.env["NODE_ENV"],
    GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"],
    GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"],
    OPDB_API_URL: process.env["OPDB_API_URL"],
    VERCEL_URL: process.env["VERCEL_URL"],
    PORT: process.env["PORT"],
    PINBALL_MAP_API_KEY: process.env["PINBALL_MAP_API_KEY"],
    OPDB_API_KEY: process.env["OPDB_API_KEY"],
    IMAGE_STORAGE_PROVIDER: process.env["IMAGE_STORAGE_PROVIDER"],
    BLOB_READ_WRITE_TOKEN: process.env["BLOB_READ_WRITE_TOKEN"],
    SEED_ADMIN_EMAIL: process.env["SEED_ADMIN_EMAIL"],
    SEED_ADMIN_NAME: process.env["SEED_ADMIN_NAME"],
    VERCEL_ENV: process.env["VERCEL_ENV"],
    FORCE_PREVIEW_BEHAVIOR: process.env["FORCE_PREVIEW_BEHAVIOR"],
    // Supabase Configuration
    SUPABASE_URL: process.env["SUPABASE_URL"],
    SUPABASE_SECRET_KEY: process.env["SUPABASE_SECRET_KEY"],
    SUPABASE_JWT_SECRET: process.env["SUPABASE_JWT_SECRET"],
    SUPABASE_DB_URL: process.env["SUPABASE_DB_URL"],
    // Client-side environment variables
    NEXT_PUBLIC_VERCEL_ENV: process.env["NEXT_PUBLIC_VERCEL_ENV"],
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    // Logging configuration
    LOG_LEVEL: process.env["LOG_LEVEL"],
    // Test environment variables
    VITEST: process.env["VITEST"],
    CI: process.env["CI"],
    NEXT_PUBLIC_ENABLE_DEV_FEATURES:
      process.env["NEXT_PUBLIC_ENABLE_DEV_FEATURES"],
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
