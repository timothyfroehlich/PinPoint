import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";

import * as schema from "./schema";

/**
 * Create a Drizzle client with consistent options across drivers.
 * Tries the PGlite drizzle factory first, falls back to Postgres-js drizzle.
 */
export function createDrizzle(adapter: unknown, loggerEnabled?: boolean) {
  const options = {
    schema,
    casing: "snake_case" as const,
    logger: loggerEnabled,
  };

  // Try pglite first (for in-memory test adapters), fall back to postgres-js
  try {
    return pgliteDrizzle(adapter as any, options as any);
  } catch {
    return pgDrizzle(adapter as any, options as any);
  }
}
