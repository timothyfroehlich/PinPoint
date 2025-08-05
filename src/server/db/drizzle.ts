import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

import { env } from "~/env";
import { isDevelopment } from "~/lib/environment";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createDrizzleClientInternal() {
  const connectionString = env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_PRISMA_URL is required for Drizzle client");
  }

  // Determine SSL configuration based on environment
  const isLocalhost =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");
  const isCI = env.NODE_ENV === "test";
  // Disable SSL for localhost AND CI environments to prevent TLS connection failures
  const sslConfig = isLocalhost || isCI ? false : "require";

  // Create postgres-js connection with environment-optimized settings
  const sql = postgres(connectionString, {
    max: isCI ? 2 : 1, // Slightly higher pool for CI stability
    idle_timeout: isCI ? 30 : isDevelopment() ? 60 : 20,
    connect_timeout: isCI ? 20 : isDevelopment() ? 30 : 10,
    ssl: sslConfig, // Conditional SSL based on environment
    // CI-specific optimizations
    ...(isCI && {
      prepare: false, // Disable prepared statements in CI
      transform: { undefined: null }, // Handle undefined values
    }),
  });

  return drizzle(sql, {
    schema,
    logger: isDevelopment() && !isCI, // Disable logging in CI for performance
  });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClientInternal>;

// Global declaration for development singleton pattern
declare global {
  var __drizzle: DrizzleClient | undefined;
  var __sql: ReturnType<typeof postgres> | undefined;
}

/**
 * Creates Drizzle database client with singleton pattern for development hot-reload
 * Uses shared connection pool with existing Supabase infrastructure
 */
export const createDrizzleClient = (): DrizzleClient => {
  if (env.NODE_ENV === "production") {
    // Production: create fresh instance each time
    return createDrizzleClientInternal();
  }

  // Development: reuse connection across hot reloads to prevent connection exhaustion
  if (!global.__drizzle) {
    const connectionString = env.POSTGRES_PRISMA_URL;

    if (!connectionString) {
      throw new Error("POSTGRES_PRISMA_URL is required for Drizzle client");
    }

    // Determine SSL configuration based on environment
    const isLocalhost =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1");
    const isCI = env.NODE_ENV === "test";
    // Disable SSL for localhost AND CI environments to prevent TLS connection failures
    const sslConfig = isLocalhost || isCI ? false : "require";

    const sql = postgres(connectionString, {
      max: isCI ? 2 : 1, // Slightly higher pool for CI stability
      idle_timeout: isCI ? 30 : isDevelopment() ? 60 : 20,
      connect_timeout: isCI ? 20 : isDevelopment() ? 30 : 10,
      ssl: sslConfig, // Conditional SSL based on environment
      // CI-specific optimizations
      ...(isCI && {
        prepare: false, // Disable prepared statements in CI
        transform: { undefined: null }, // Handle undefined values
      }),
    });

    global.__sql = sql;
    global.__drizzle = drizzle(sql, {
      schema,
      logger: isDevelopment() && !isCI,
    });
  }

  return global.__drizzle;
};

/**
 * Cleanup function for graceful shutdown
 * Call this when the application is shutting down
 */
export const closeDrizzleConnection = async (): Promise<void> => {
  if (global.__sql) {
    await global.__sql.end();
    global.__sql = undefined;
    global.__drizzle = undefined;
  }
};
