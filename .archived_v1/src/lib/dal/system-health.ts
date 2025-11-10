/**
 * System Health Data Access Layer
 * Health check operations for monitoring
 */

import "server-only";

import { cache } from "react";
import { sql } from "drizzle-orm";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { getVersion } from "~/utils/version";
import type { HealthStatus } from "~/lib/types";
import { getErrorMessage } from "~/lib/utils/type-guards";

/**
 * Perform database connectivity check
 * Returns health status with version and timestamp
 */
export const checkSystemHealth = cache(async (): Promise<HealthStatus> => {
  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient();

  try {
    // Check database connectivity with simple query
    await db.execute(sql`SELECT 1`);

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      version: getVersion(),
    };
  } catch (error) {
    console.error("Health check failed:", error);

    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      version: getVersion(),
      error: getErrorMessage(error),
    };
  } finally {
    await dbProvider.disconnect();
  }
});
