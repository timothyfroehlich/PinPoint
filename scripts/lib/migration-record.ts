import { createHash } from "node:crypto";

export interface JournalEntry {
  when: number;
  tag: string;
}

export interface MigrationRecord {
  hash: string;
  createdAt: number;
}

/**
 * The `drizzle.__drizzle_migrations` row drizzle's migrator writes for a
 * migration: the sha256 of the file and the journal's `when`.
 *
 * The migrator applies only journal entries newer than the newest recorded
 * `created_at`, so marking a migration with the current time would make it
 * skip every later entry with no record.
 */
export function migrationRecord(
  entry: JournalEntry,
  migrationSql: string
): MigrationRecord {
  return {
    hash: createHash("sha256").update(migrationSql).digest("hex"),
    createdAt: entry.when,
  };
}
