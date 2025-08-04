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
  const sslConfig = isLocalhost && isDevelopment() ? false : "require";

  // Create postgres-js connection with environment-optimized settings
  const sql = postgres(connectionString, {
    max: 1, // Serverless optimization - single connection
    idle_timeout: isDevelopment() ? 60 : 20, // Longer timeout for development
    connect_timeout: isDevelopment() ? 30 : 10, // More generous timeout for dev
    ssl: sslConfig, // Conditional SSL based on environment
  });

  return drizzle(sql, {
    schema,
    logger: isDevelopment(), // Match Prisma logging behavior
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
    const sslConfig = isLocalhost && isDevelopment() ? false : "require";

    const sql = postgres(connectionString, {
      max: 1, // Single connection for development
      idle_timeout: isDevelopment() ? 60 : 20, // Longer timeout for development
      connect_timeout: isDevelopment() ? 30 : 10, // More generous timeout for dev
      ssl: sslConfig, // Conditional SSL based on environment
    });

    global.__sql = sql;
    global.__drizzle = drizzle(sql, {
      schema,
      logger: isDevelopment(),
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
