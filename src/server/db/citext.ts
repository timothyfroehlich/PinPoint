import { customType } from "drizzle-orm/pg-core";

/**
 * PostgreSQL CITEXT (case-insensitive text) custom type for Drizzle ORM.
 *
 * Requires the `citext` extension: CREATE EXTENSION IF NOT EXISTS "citext";
 * Stores strings as-is but compares case-insensitively, enabling standard
 * B-tree indexes for case-insensitive lookups without lower() wrappers.
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});
