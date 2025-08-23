import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { Sql } from "postgres";
import type { PGlite } from "@electric-sql/pglite";

import * as schema from "./schema";

/**
 * Create a Drizzle client with consistent options across drivers.
 * Determines the appropriate driver based on the adapter type.
 */
export function createDrizzle(
  adapter: Sql | PGlite,
  loggerEnabled?: boolean,
): PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema> {
  const options = {
    schema,
    ...(loggerEnabled !== undefined && { logger: loggerEnabled }),
  };

  // Check if adapter is PGlite instance (has .exec method)
  if ("exec" in adapter && typeof adapter.exec === "function") {
    return pgliteDrizzle(adapter as PGlite, options);
  }

  // Otherwise, use postgres-js
  return pgDrizzle(adapter as Sql, options);
}
