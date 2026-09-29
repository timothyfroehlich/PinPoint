#!/usr/bin/env node
/**
 * Seed the stored PinTips copy for local dev and preview branches (PP-a0be).
 *
 * In production the daily `/api/cron/refresh-pintips` job fills `pintips` from
 * Match Play's export. Dev and preview never run that cron, so this writes
 * placeholder tips — invented text, not Match Play's — for the OPDB games in
 * the PinballMap catalog fixture. Every fifth game gets none, so the hidden
 * state (spec pintips 3.6) is reachable too. No network.
 *
 * Replaces the table's contents, as the refresh does.
 *
 * Usage: pnpm run db:_seed-pintips  (also wired into preview seed)
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

// Never production: prod's copy is Match Play's export, and this would
// replace it with placeholders.
assertNotPinPointProduction(POSTGRES_URL, "POSTGRES_URL");

const catalog = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../src/lib/pinballmap/fixtures/catalog-apc.json"
    ),
    "utf8"
  )
);

const groupIds = [
  ...new Set(
    catalog
      .map((m) =>
        typeof m.opdb_id === "string" ? m.opdb_id.split("-")[0] : null
      )
      .filter((g) => typeof g === "string" && /^G[a-zA-Z0-9]+$/.test(g))
  ),
].sort();

const TEMPLATES = [
  [
    "general",
    12,
    "Placeholder tip: the left ramp feeds the upper flipper, so a clean ramp shot sets up the next one.",
  ],
  [
    "multiball",
    7,
    "Placeholder tip: lock balls early; the add-a-ball shot is lit for the first ten seconds of multiball.",
  ],
  [
    "skillshot",
    4,
    "Placeholder tip: a soft plunge to the middle lane lights the skill shot bonus.",
  ],
  [
    "general",
    2,
    "Placeholder tip: nudge gently toward the outlane post to save a ball headed for the left drain.",
  ],
  [
    "wizard",
    0,
    "Placeholder tip: finishing every mode lights the wizard mode at the scoop.",
  ],
  [
    "secret",
    1,
    "Placeholder tip: holding both flipper buttons during the ball search shows a hidden message.",
  ],
];

const rows = [];
let tipId = 1;
groupIds.forEach((groupId, g) => {
  if (g % 5 === 4) return;
  const count = 2 + (g % (TEMPLATES.length - 1));
  for (let i = 0; i < count; i++) {
    const [category, voteTotal, text] = TEMPLATES[(g + i) % TEMPLATES.length];
    rows.push({
      tip_id: tipId++,
      opdb_group_id: groupId,
      category,
      vote_total: voteTotal,
      text,
    });
  }
});

const sql = createScriptClient(POSTGRES_URL);
try {
  console.log(`🌱 Seeding ${rows.length} placeholder PinTips...`);
  await sql.begin(async (tx) => {
    await tx`DELETE FROM pintips`;
    if (rows.length > 0) {
      await tx`INSERT INTO pintips ${tx(rows, "tip_id", "opdb_group_id", "category", "vote_total", "text")}`;
    }
  });
  console.log(`✅ PinTips copy seeded: ${rows.length} tips.`);
} catch (err) {
  console.error("❌ PinTips seed failed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
