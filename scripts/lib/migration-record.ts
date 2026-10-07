import { readMigrationFiles } from "drizzle-orm/migrator";

export interface MigrationRecord {
  hash: string;
  createdAt: number;
}

/**
 * The `drizzle.__drizzle_migrations` row drizzle's migrator writes for the
 * journal entry at `position`, taken from drizzle's own `readMigrationFiles` so
 * the hash and timestamp match by construction.
 *
 * The migrator applies only journal entries newer than the newest recorded
 * `created_at`, so a row stamped with the current time would make it skip
 * every later entry with no record.
 */
export function migrationRecord(
  migrationsFolder: string,
  position: number
): MigrationRecord {
  const meta = readMigrationFiles({ migrationsFolder })[position];
  if (!meta) {
    throw new Error(
      `No journal entry at position ${position} in ${migrationsFolder}`
    );
  }
  return { hash: meta.hash, createdAt: meta.folderMillis };
}

/**
 * A journal entry that marking `target` would hide, or undefined.
 *
 * Marking writes created_at = target.when, and the migrator then skips every
 * unapplied entry whose `when` is not newer (drizzle applies only when
 * created_at < when). Entries with a `when` at or below
 * `newestApplied` are already applied or already skipped; entries newer than
 * the target still run. What marking hides is any other entry, wherever it
 * sits in the journal, with newestApplied < when <= target.when (the journal
 * is not in `when` order everywhere: 0012 predates 0011).
 */
export function entryHiddenByMarking<T extends { tag: string; when: number }>(
  entries: readonly T[],
  target: T,
  newestApplied: number
): T | undefined {
  return entries.find(
    (entry) =>
      entry.tag !== target.tag &&
      entry.when > newestApplied &&
      entry.when <= target.when
  );
}
