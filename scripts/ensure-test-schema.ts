#!/usr/bin/env tsx
/**
 * Ensures test schema is up-to-date with src/server/db/schema.ts
 * Regenerates when schema.ts's content hash differs from the one that produced
 * the current schema.sql (see schemaNeedsRegeneration for why not mtime)
 *
 * Concurrency safety: writes to a temp file in the SAME directory as
 * schema.sql, then renames it over schema.sql. The rename is atomic (POSIX
 * rename(2)) and stays within one filesystem, so readers never see a partial
 * file and we avoid EXDEV cross-device-rename failures (PP-3vdr.5). Two
 * processes that regenerate at once both write identical content, so no lock
 * is needed — an earlier lockfile went stale whenever a run was interrupted
 * and then cost every later regeneration a 60s wait.
 */
import {
  existsSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  readFileSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "..");
const SCHEMA_TS = resolve(ROOT, "src/server/db/schema.ts");
const SCHEMA_DIR = resolve(ROOT, "src/test/setup");
const SCHEMA_SQL = resolve(SCHEMA_DIR, "schema.sql");
// Sidecar recording which schema.ts produced the current schema.sql. Gitignored
// alongside it — it is a derived artifact, not a source of truth to review.
const SCHEMA_HASH = resolve(SCHEMA_DIR, ".schema.hash");

/**
 * Regenerate schema.sql atomically:
 * 1. Run drizzle-kit export and capture stdout.
 * 2. Write output to a uniquely-named temp file in the schema directory.
 * 3. Rename the temp file over schema.sql (atomic, same filesystem).
 */
function regenerateSchemaAtomic(hash: string): void {
  const suffix = randomBytes(6).toString("hex");
  const tmpFile = resolve(SCHEMA_DIR, `.schema.${suffix}.sql.tmp`);

  try {
    const sql = execSync(
      "pnpm exec drizzle-kit export --dialect=postgresql --schema=./src/server/db/schema.ts",
      { cwd: ROOT }
    );
    writeFileSync(tmpFile, sql);
    renameSync(tmpFile, SCHEMA_SQL);
    // AFTER the rename, so a crash between the two leaves no sidecar and the
    // next run regenerates. The reverse order could record a hash for a
    // schema.sql that was never written.
    writeFileSync(SCHEMA_HASH, hash);
  } catch (error) {
    // Clean up temp file on failure
    try {
      unlinkSync(tmpFile);
    } catch {
      // ignore
    }
    throw error;
  }
}

/**
 * Whether schema.sql is missing, or was generated from a different schema.ts.
 *
 * Content hash, not mtime. The mtime version had a failure mode that produced
 * a confident wrong answer on any machine that receives `schema.ts` over rsync:
 *
 *   - `src/test/setup/schema.sql` is gitignored, so it is never synced. The
 *     remote runner keeps whatever it generated on its last run.
 *   - rsync PRESERVES mtimes, so `schema.ts` arrives stamped with the time it
 *     was edited on the laptop — which is EARLIER than the runner's last suite.
 *   - `schemaTsTime > mtime(schema.sql)` is therefore false, and the check
 *     prints "✓ Test schema up-to-date" over a schema.sql that predates the
 *     column you just added.
 *
 * The symptom is `column "model_name" of relation "machines" does not exist`
 * from PGlite, hundreds of tests in, on a branch whose migration is obviously
 * present — and it survives a `git pull` on an out-of-tree runner, because the
 * stale file is not in git. Twice in one session on PP-o355.21 before the cause
 * was found; advice to "reset the runner when you touch migrations" was a
 * workaround for exactly this.
 *
 * A hash of `schema.ts` written beside `schema.sql` cannot drift the same way:
 * it is derived from content, so it does not care what any clock says.
 * CI is unaffected either way — a fresh clone has no schema.sql, so it always
 * regenerated.
 */
function schemaTsHash(): string {
  try {
    return createHash("sha256").update(readFileSync(SCHEMA_TS)).digest("hex");
  } catch {
    // Unreadable schema.ts is not this script's error to report — fall through
    // to regeneration, where drizzle-kit will fail with a real message.
    return "";
  }
}

function recordedHash(): string | null {
  try {
    return readFileSync(SCHEMA_HASH, "utf8").trim();
  } catch {
    return null;
  }
}

function schemaNeedsRegeneration(hash: string): boolean {
  if (!existsSync(SCHEMA_SQL)) {
    return true;
  }
  // No sidecar means the file predates this check. Regenerate once to
  // establish it rather than trusting an unverifiable schema.sql.
  return recordedHash() !== hash;
}

function main(): void {
  const hash = schemaTsHash();

  if (!schemaNeedsRegeneration(hash)) {
    console.log("✓ Test schema up-to-date");
    return;
  }

  console.log(
    existsSync(SCHEMA_SQL)
      ? "⚠️  Test schema stale, regenerating..."
      : "⚠️  Test schema missing, generating..."
  );

  try {
    regenerateSchemaAtomic(hash);
    console.log("✅ Test schema updated");
  } catch (error) {
    console.error("❌ Failed to ensure test schema:");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}

main();
