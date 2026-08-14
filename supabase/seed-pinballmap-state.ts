#!/usr/bin/env tsx
/**
 * Seed the PinballMap location snapshot — the "we have read their lineup" state.
 *
 * In production `syncLocationSnapshot()` fills `pinballmap_state.snapshot_json`
 * from PinballMap's live API on an hourly cron. Dev and preview never run that
 * cron and must never reach the real service (CORE-PBM-001 / CORE-TEST-006), so
 * without this step the singleton row does not exist and EVERY machine derives
 * to `unsynced` — "PinPoint hasn't read Pinball Map's lineup yet". That is the
 * honest answer for an empty database, but it leaves the listing control with
 * exactly one reachable state locally, so the six that carry the feature cannot
 * be seen, reviewed, or screenshotted.
 *
 * The snapshot is the SAME offline fixture the mock client serves
 * (`fixtures/location-26454.json`, a real capture of APC's location with 101
 * lineup entries), so what dev renders is what the cron would have produced.
 *
 * ## Why this is .ts and runs under tsx
 *
 * `snapshot_json` does NOT hold the raw API payload. `parseLocation()`
 * normalizes it — `location_machine_xrefs` becomes `lmxes`, snake_case becomes
 * camelCase — and `derivePbmMachineStatus()` reads `snapshot.lmxes[].machineId`.
 * Writing the raw fixture would produce a row that looks populated and matches
 * nothing, which derives every machine to `missing_on_pbm`: a plausible state,
 * silently wrong, on every page. Importing the real parser is the only version
 * of this that cannot drift from what the cron writes. (The sibling catalog seed
 * re-implements its mapping in SQL and accepts that risk; this payload is too
 * structured for that trade.)
 *
 * ## Why this also links machines
 *
 * A snapshot alone still leaves every seeded machine `unmatched` — the derived
 * state is a function of BOTH the snapshot and the machine's own columns. Five
 * seeded machines have genuine entries in the captured lineup and five do not,
 * which is enough of a natural spread to reach every state without inventing
 * data. Each id below was verified against both fixtures; see the table in
 * `MACHINE_PLAN`.
 *
 * Idempotent: singleton upsert plus per-machine updates keyed on initials.
 *
 * Usage: pnpm run db:_seed-pinballmap-state
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// Relative, not `~/`: seed scripts run under tsx outside the Next build, where
// the path alias is not resolved.
import { parseLocation } from "../src/lib/pinballmap/parse";
import { assertNotPinPointProduction } from "../scripts/lib/db-target.mjs";
import { createScriptClient } from "../scripts/lib/pg-client.mjs";

const POSTGRES_URL = process.env["POSTGRES_URL"];
if (!POSTGRES_URL) {
  console.error("❌ Missing POSTGRES_URL");
  process.exit(1);
}

// Refuses production outright rather than taking a force flag, unlike
// seed-pinballmap-creds.mjs. Prod's snapshot is live data from the cron;
// overwriting it with a fixture capture would make every machine's derived
// listing state wrong at once, and the only repair would be waiting for the
// next cron. There is no legitimate reason to point this at prod.
assertNotPinPointProduction(POSTGRES_URL, "POSTGRES_URL");

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/lib/pinballmap/fixtures"
);
const rawLocation: unknown = JSON.parse(
  readFileSync(join(fixturesDir, "location-26454.json"), "utf8")
);

const snapshot = parseLocation(rawLocation, new Date().toISOString());

/** Catalog ids, each verified present in `catalog-apc.json`. */
const TITLE = {
  godzillaPremium: 3416, // in the lineup
  spiderManVault: 2565, // in the lineup
  blackKnight: 1055, // in the lineup
  medievalMadness: 642, // in the catalog, NOT in the lineup
} as const;

/**
 * The lmx handle the captured lineup gives a title.
 *
 * Read out of the snapshot rather than hardcoded so that a
 * `scripts/pinballmap/refresh-fixture.ts` run cannot silently leave this seed
 * pointing at handles the lineup no longer contains — which is itself one of
 * the states being seeded (`missing_on_pbm`) and would be indistinguishable
 * from the real thing.
 */
function lmxFor(machineId: number): number {
  const lmx = snapshot.lmxes.find((l) => l.machineId === machineId);
  if (!lmx) {
    throw new Error(
      `location-26454.json has no lineup entry for catalog id ${String(machineId)}. ` +
        `The fixture was probably refreshed and this title left APC's lineup — ` +
        `pick a different one in supabase/seed-pinballmap-state.ts.`
    );
  }
  return lmx.id;
}

/**
 * An lmx handle deliberately absent from the lineup: the shape of "somebody
 * removed our entry on pinballmap.com". Far outside PBM's real id range so it
 * cannot collide with a refreshed fixture.
 */
const DEPARTED_LMX_ID = 999_000_001;

interface MachinePlan {
  initials: string;
  pinballmapMachineId: number | null;
  pinballmapListed: boolean;
  pinballmapLmxId: number | null;
  pinballmapExcluded: boolean;
  modelName: string | null;
  /** The state this row exists to produce. */
  state: string;
}

/**
 * | machine                | catalog | lineup | listed | derives to       |
 * |------------------------|---------|--------|--------|------------------|
 * | GDZ Godzilla (Premium) | 3416    | yes    | yes    | listed           |
 * | SM  Spider-Man (Vault) | 2565    | yes    | yes    | listed           |
 * | BK  Black Knight       | 1055    | yes    | no     | unclaimed_on_pbm*|
 * | MM  Medieval Madness   | 642     | no     | yes    | missing_on_pbm   |
 * | FB  Fireball           | none    | —      | no     | not_on_pbm       |
 * | AFM, EBD, TAF, HD, SC  | —       | —      | no     | unmatched        |
 *
 * `*` Black Knight is the one state here that a sync erases — auto-link claims
 * it. See the note on its entry; a `listed` Black Knight is the product
 * working, not a broken seed.
 *
 * `unclaimed_on_pbm` needs the machine LINKED to the title while not holding
 * the listing — an unlinked machine short-circuits to `unmatched` before the
 * snapshot is ever consulted (`derivePbmMachineStatus` returns `unlinked` on a
 * null `pinballmapMachineId`). So leaving Black Knight alone would NOT have
 * produced it, despite the lineup carrying Black Knight; it has to be linked
 * with `listed: false`. Verified by rendering, not by reading the code.
 *
 * AFM, EBD and TAF have no entry in `catalog-apc.json` at all, so linking them
 * would mean inventing a title or pointing them at another game's. HD and SC
 * do have entries but are left unlinked so `unmatched` — the state every newly
 * added machine starts in — is not a one-machine case.
 *
 * `not_listed` (matched, lineup does not carry the title) has no honest row
 * here. It needs a machine whose real title is in the catalog but off the
 * lineup, and Medieval Madness is the only one — already spent on
 * `missing_on_pbm`, the state that has a control attached. Covering both would
 * mean linking a machine to a game it is not. Left uncovered rather than faked;
 * `status.test.ts` covers the derivation.
 */
const MACHINE_PLAN: MachinePlan[] = [
  {
    initials: "GDZ",
    pinballmapMachineId: TITLE.godzillaPremium,
    pinballmapListed: true,
    pinballmapLmxId: lmxFor(TITLE.godzillaPremium),
    pinballmapExcluded: false,
    modelName: null,
    state: "listed",
  },
  {
    initials: "SM",
    pinballmapMachineId: TITLE.spiderManVault,
    pinballmapListed: true,
    pinballmapLmxId: lmxFor(TITLE.spiderManVault),
    pinballmapExcluded: false,
    modelName: null,
    state: "listed",
  },
  {
    initials: "BK",
    pinballmapMachineId: TITLE.blackKnight,
    // Linked but not holding the listing, while the lineup DOES carry the
    // title.
    //
    // THIS ONE DOES NOT SURVIVE A SYNC, and that is the product working. The
    // reconcile pass behind "Sync now" and the hourly cron runs auto-link
    // (PP-o355.20), which captures a lone eligible cabinet — so the first sync
    // after seeding flips Black Knight to `listed` and writes a `linked`
    // timeline event. Observed, not predicted: clicking Sync now during this
    // seed's own verification claimed both BK and TAF within the same second.
    //
    // So do not read a `listed` Black Knight as a broken seed. Re-run the seed
    // to get the state back. In production `unclaimed_on_pbm` survives only
    // where auto-link deliberately stands down — two same-title cabinets tied
    // at the top presence rank — which this fixture has no way to arrange
    // without a second Black Knight.
    pinballmapListed: false,
    pinballmapLmxId: null,
    pinballmapExcluded: false,
    modelName: null,
    state: "unclaimed_on_pbm (until the next sync auto-claims it)",
  },
  {
    initials: "MM",
    pinballmapMachineId: TITLE.medievalMadness,
    pinballmapListed: true,
    pinballmapLmxId: DEPARTED_LMX_ID,
    pinballmapExcluded: false,
    modelName: null,
    state: "missing_on_pbm",
  },
  {
    initials: "FB",
    // The PP-3bbr shape: a cabinet with no catalog title, identified by hand.
    // `machines_model_name_requires_excluded` makes link + hand-entry mutually
    // exclusive, so this row also asserts the constraint holds.
    pinballmapMachineId: null,
    pinballmapListed: false,
    pinballmapLmxId: null,
    pinballmapExcluded: true,
    modelName: "Fireball (home-brew conversion)",
    state: "not_on_pbm",
  },
];

const sql = createScriptClient(POSTGRES_URL);
try {
  console.log(
    `🌱 Seeding PinballMap snapshot for location ${String(snapshot.locationId)} ` +
      `(${String(snapshot.lmxes.length)} lineup entries)...`
  );

  await sql`
    INSERT INTO pinballmap_state
      (id, enabled, location_id, snapshot_json, last_synced_at,
       last_sync_attempt_at, last_sync_status, last_sync_error)
    VALUES
      ('singleton', true, ${snapshot.locationId}, ${JSON.stringify(snapshot)}::jsonb, now(),
       now(), 'ok', NULL)
    ON CONFLICT (id) DO UPDATE SET
      enabled = excluded.enabled,
      location_id = excluded.location_id,
      snapshot_json = excluded.snapshot_json,
      last_synced_at = excluded.last_synced_at,
      last_sync_attempt_at = excluded.last_sync_attempt_at,
      last_sync_status = excluded.last_sync_status,
      last_sync_error = excluded.last_sync_error,
      updated_at = now()
  `;

  let updated = 0;
  for (const m of MACHINE_PLAN) {
    // All five columns in one UPDATE: the CHECK constraints
    // (`..._link_exclusive`, `..._listed_requires_link`, `..._lmx_requires_
    // listed`, `..._model_name_requires_excluded`) are row-level, so a
    // clear-then-set pair would have to pass through a legal intermediate
    // state anyway. One statement removes the need to reason about order.
    const rows = await sql`
      UPDATE machines SET
        pinballmap_machine_id = ${m.pinballmapMachineId},
        pinballmap_listed = ${m.pinballmapListed},
        pinballmap_lmx_id = ${m.pinballmapLmxId},
        pinballmap_excluded = ${m.pinballmapExcluded},
        model_name = ${m.modelName}
      WHERE initials = ${m.initials}
      RETURNING initials
    `;
    if (rows.length > 0) {
      updated += 1;
      console.log(`   ${m.initials.padEnd(4)} → ${m.state}`);
    } else {
      // Not fatal — the machine seed owns which machines exist, and a rename
      // there should not break the reset chain. Still said out loud, because
      // the state it covered silently stops being reachable in dev.
      console.warn(
        `   ⚠️  ${m.initials} not found — "${m.state}" is now unreachable locally`
      );
    }
  }

  console.log(
    `✅ PinballMap state seeded: snapshot + ${String(updated)}/${String(MACHINE_PLAN.length)} machine links.`
  );
} catch (err) {
  console.error(
    "❌ PinballMap state seed failed:",
    err instanceof Error ? err.message : err
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
