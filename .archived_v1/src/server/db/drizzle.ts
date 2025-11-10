import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzle } from "./client-factory";
import postgres from "postgres";

import type * as schema from "./schema";

import { env } from "~/env";
import { isDevelopment } from "~/lib/environment";

// Environment-specific database configuration
interface DatabaseConfig {
  max: number;
  idle_timeout: number;
  connect_timeout: number;
  prepare: boolean;
  application_name: string;
}

function getDatabaseConfig(): DatabaseConfig {
  const isTest = env.NODE_ENV === "test";

  if (isTest) {
    return {
      max: 2, // Conservative pool size for resource-constrained CI
      idle_timeout: 30, // Shorter idle timeout to free resources quickly
      connect_timeout: 20, // Faster timeout to fail fast in CI
      prepare: false, // Disable prepared statements for CI compatibility
      application_name: "pinpoint_ci_seeding",
    };
  }

  if (isDevelopment()) {
    return {
      max: 5, // Moderate pool size for local development
      idle_timeout: 60, // Longer timeout for debugging sessions
      connect_timeout: 30, // Generous timeout for local database startup
      prepare: true, // Enable prepared statements for better dev performance
      application_name: "pinpoint_seeding",
    };
  }

  // Production configuration
  return {
    max: 10, // Higher pool size for production load
    idle_timeout: 20, // Balanced timeout for resource management
    connect_timeout: 10, // Fast timeout for production responsiveness
    prepare: true, // Enable prepared statements for performance
    application_name: "pinpoint_seeding",
  };
}

function createDrizzleClientInternal(): DrizzleClient {
  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Drizzle client");
  }

  // Determine SSL configuration based on environment
  const isLocalhost =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");
  const isTest = env.NODE_ENV === "test";
  const sslConfig = isLocalhost || isTest ? false : "require";

  // Get environment-specific configuration
  const config = getDatabaseConfig();

  // Create postgres-js connection with environment-optimized settings
  const sql = postgres(connectionString, {
    max: config.max,
    idle_timeout: config.idle_timeout,
    connect_timeout: config.connect_timeout,
    ssl: sslConfig,
    prepare: config.prepare,
    transform: { undefined: null }, // Handle undefined values consistently
    connection: {
      application_name: config.application_name,
    },
  });

  return createDrizzle(sql, isDevelopment() && !isTest) as PostgresJsDatabase<
    typeof schema
  >;
}

export type DrizzleClient = PostgresJsDatabase<typeof schema>;

/**
 * Controlled singleton pattern for development hot-reload optimization.
 * Avoids global namespace pollution while maintaining connection reuse benefits.
 */
class DatabaseSingleton {
  private static instance: DatabaseSingleton | undefined;
  private _client: DrizzleClient | null = null;
  private _sql: ReturnType<typeof postgres> | null = null;

  private constructor() {
    // Private constructor ensures singleton pattern
  }

  static getInstance(): DatabaseSingleton {
    DatabaseSingleton.instance ??= new DatabaseSingleton();
    return DatabaseSingleton.instance;
  }

  getClient(): DrizzleClient {
    this._client ??= this.createClient();
    return this._client;
  }

  private createClient(): DrizzleClient {
    const connectionString = env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required for Drizzle client");
    }

    // Determine SSL configuration based on environment
    const isLocalhost =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1");
    const isTest = env.NODE_ENV === "test";
    const sslConfig = isLocalhost || isTest ? false : "require";

    // Get environment-specific configuration
    const config = getDatabaseConfig();

    const sql = postgres(connectionString, {
      max: config.max,
      idle_timeout: config.idle_timeout,
      connect_timeout: config.connect_timeout,
      ssl: sslConfig,
      prepare: config.prepare,
      transform: { undefined: null }, // Handle undefined values consistently
      connection: {
        application_name: config.application_name,
      },
    });

    this._sql = sql;
    return createDrizzle(sql, isDevelopment() && !isTest) as PostgresJsDatabase<
      typeof schema
    >;
  }

  async cleanup(): Promise<void> {
    if (this._sql) {
      try {
        await this._sql.end();
      } catch (error) {
        // Log cleanup errors but don't throw - we want cleanup to complete
        console.warn("Database cleanup error (non-fatal):", error);
      }
      this._sql = null;
      this._client = null;
    }
  }

  reset(): void {
    // For development hot-reload: reset without cleanup
    this._client = null;
    this._sql = null;
  }
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
  return DatabaseSingleton.getInstance().getClient();
};

/**
 * Cleanup function for graceful shutdown
 * Call this when the application is shutting down
 */
export const closeDrizzleConnection = async (): Promise<void> => {
  await DatabaseSingleton.getInstance().cleanup();
};
