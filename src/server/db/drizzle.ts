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

  // Create postgres-js connection with Supabase-optimized settings
  const sql = postgres(connectionString, {
    max: 1, // Serverless optimization - single connection
    idle_timeout: 20, // Close idle connections quickly
    connect_timeout: 10, // Fast connection timeout
    ssl: "require", // Supabase requires SSL
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

    const sql = postgres(connectionString, {
      max: 1, // Single connection for development
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: "require",
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
