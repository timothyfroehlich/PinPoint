import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";

export interface MigrationRecord {
  hash: string;
  createdAt: number;
}

/**
 * The `drizzle.__drizzle_migrations` row drizzle's migrator writes for the
 * migration with this tag, taken from drizzle's own `readMigrationFiles` so
 * the hash and timestamp match by construction.
 *
 * The migrator applies only journal entries newer than the newest recorded
 * `created_at`, so a row stamped with the current time would make it skip
 * every later entry with no record.
 */
export function migrationRecord(
  migrationsFolder: string,
  tag: string
): MigrationRecord {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf-8")
  ) as { entries: { tag: string }[] };
  const position = journal.entries.findIndex((entry) => entry.tag === tag);
  const meta =
    position === -1
      ? undefined
      : readMigrationFiles({ migrationsFolder })[position];
  if (!meta) {
    throw new Error(`Migration ${tag} is not in ${migrationsFolder}`);
  }
  return { hash: meta.hash, createdAt: meta.folderMillis };
}
