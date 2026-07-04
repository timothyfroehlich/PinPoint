#!/usr/bin/env node
/**
 * Seed the PinballMap catalog mirror for local dev + preview branches.
 *
 * In production the weekly `/api/cron/refresh-catalog` job fills
 * `pinballmap_catalog` from PinballMap's live API. Dev and preview never run
 * that cron, so the linking picker would have nothing to search. This seeds the
 * mirror from the SAME offline fixtures the mock PBM client uses
 * (`src/lib/pinballmap/fixtures`), so the family→edition picker works out of the
 * box with realistic data — including two real multi-edition families (Godzilla,
 * Jurassic Park) — and never touches pinballmap.com (CORE-PBM-001 / CORE-TEST-006).
 *
 * Idempotent upsert keyed on pinballmap_machine_id, so re-running refreshes
 * rows rather than duplicating them. Mirrors refreshCatalog()'s group-name
 * denormalization (src/lib/pinballmap/catalog.ts) in plain SQL.
 *
 * Usage: pnpm run db:_seed-pinballmap-catalog  (also wired into preview seed)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createScriptClient } from "../scripts/lib/pg-client.mjs";

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error("❌ Missing POSTGRES_URL");
  process.exit(1);
}

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/lib/pinballmap/fixtures"
);
const readFixture = (file) =>
  JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));

const catalog = readFixture("catalog-apc.json");
const groups = readFixture("machine-groups.json");
const groupNames = new Map(groups.map((g) => [g.id, g.name]));

const rows = catalog.map((m) => ({
  pinballmap_machine_id: m.id,
  name: m.name,
  manufacturer: m.manufacturer ?? null,
  year: m.year ?? null,
  opdb_id: m.opdb_id ?? null,
  ipdb_id: m.ipdb_id ?? null,
  machine_group_id: m.machine_group_id ?? null,
  group_name:
    m.machine_group_id != null
      ? (groupNames.get(m.machine_group_id) ?? null)
      : null,
}));

const cols = [
  "pinballmap_machine_id",
  "name",
  "manufacturer",
  "year",
  "opdb_id",
  "ipdb_id",
  "machine_group_id",
  "group_name",
];

const sql = createScriptClient(POSTGRES_URL);
try {
  console.log(`🌱 Seeding ${rows.length} PinballMap catalog rows...`);
  await sql`
    INSERT INTO pinballmap_catalog ${sql(rows, ...cols)}
    ON CONFLICT (pinballmap_machine_id) DO UPDATE SET
      name = excluded.name,
      manufacturer = excluded.manufacturer,
      year = excluded.year,
      opdb_id = excluded.opdb_id,
      ipdb_id = excluded.ipdb_id,
      machine_group_id = excluded.machine_group_id,
      group_name = excluded.group_name,
      refreshed_at = now()
  `;
  const families = new Set(
    rows.map((r) => r.machine_group_id ?? `m${r.pinballmap_machine_id}`)
  );
  console.log(
    `✅ PinballMap catalog seeded: ${rows.length} editions across ${families.size} families.`
  );
} catch (err) {
  console.error("❌ PinballMap catalog seed failed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
