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

/**
 * A journal entry that marking `target` would hide, or undefined.
 *
 * Marking writes created_at = target.when, and the migrator then skips every
 * unapplied entry with an older `when`. Entries with a `when` at or below
 * `newestApplied` are already applied or already skipped; entries newer than
 * the target still run. What marking hides is any other entry, wherever it
 * sits in the journal, with newestApplied < when < target.when (the journal
 * is not in `when` order everywhere: 0012 predates 0011).
 */
export function entryHiddenByMarking<T extends { when: number }>(
  entries: readonly T[],
  target: T,
  newestApplied: number
): T | undefined {
  return entries.find(
    (entry) =>
      entry !== target && entry.when > newestApplied && entry.when < target.when
  );
}
