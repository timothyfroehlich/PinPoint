#!/usr/bin/env node
/**
 * Seed the stored OPDB copy for local dev and preview branches (PP-wqit.12).
 *
 * In production the daily `/api/cron/refresh-opdb` job fills `opdb_machines`
 * from OPDB's export. Dev and preview never run that cron, so this seeds the
 * table from the committed fixture (`src/lib/opdb/fixtures/opdb-apc.json`),
 * which covers every OPDB ID in the PinballMap catalog fixture. No network.
 *
 * Mirrors `parseOpdbEntry` (src/lib/opdb/parse.ts): machine and alias entries
 * only, people renamed to PinPoint's shape and sorted by OPDB's index. The
 * table's CHECK constraints reject any type or display outside the vocabulary.
 * Idempotent upsert keyed on opdb_id.
 *
 * Usage: pnpm run db:_seed-opdb  (also wired into preview seed)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertNotPinPointProduction } from "../scripts/lib/db-target.mjs";
import { createScriptClient } from "../scripts/lib/pg-client.mjs";

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error("❌ Missing POSTGRES_URL");
  process.exit(1);
}

// Remote-capable (preview-migrate-seed.sh runs it against a preview branch),
// but never production: prod's copy comes from the full export, and this
// fixture would not shrink it (upsert only) but would stamp stale values.
assertNotPinPointProduction(POSTGRES_URL, "POSTGRES_URL");

const fixture = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../src/lib/opdb/fixtures/opdb-apc.json"
    ),
    "utf8"
  )
);

// Same vocabularies as src/lib/opdb/types.ts; a value outside them becomes null,
// as the parser does, instead of failing the table's CHECK constraints.
const MACHINE_TYPES = new Set(["em", "ss", "me"]);
const DISPLAY_TYPES = new Set([
  "reels",
  "lights",
  "alphanumeric",
  "cga",
  "dmd",
  "lcd",
]);

const rows = fixture.entries
  .filter((e) => typeof e.opdbId === "string" && e.opdbId.includes("-M"))
  .map((e) => ({
    opdb_id: e.opdbId,
    name: e.name,
    type: MACHINE_TYPES.has(e.type) ? e.type : null,
    display: DISPLAY_TYPES.has(e.display) ? e.display : null,
    player_count:
      Number.isSafeInteger(e.playerCount) && e.playerCount > 0
        ? e.playerCount
        : null,
    people: (e.people ?? [])
      .map((p) => ({
        personId: p.opdbPersonId,
        name: p.name,
        role: p.role,
        index: p.index,
      }))
      .sort((a, b) => a.index - b.index),
  }));

const sql = createScriptClient(POSTGRES_URL);
try {
  console.log(`🌱 Seeding ${rows.length} OPDB rows...`);
  // sql.json() for the jsonb column: an interpolated JSON.stringify(...)::jsonb
  // would store a jsonb string, not an array (see seed-machine-settings.mjs).
  for (const row of rows) {
    await sql`
      INSERT INTO opdb_machines (opdb_id, name, type, display, player_count, people)
      VALUES (${row.opdb_id}, ${row.name}, ${row.type}, ${row.display},
              ${row.player_count}, ${sql.json(row.people)})
      ON CONFLICT (opdb_id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        display = excluded.display,
        player_count = excluded.player_count,
        people = excluded.people,
        refreshed_at = now()
    `;
  }
  console.log(`✅ OPDB copy seeded: ${rows.length} machines.`);
} catch (err) {
  console.error("❌ OPDB seed failed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
