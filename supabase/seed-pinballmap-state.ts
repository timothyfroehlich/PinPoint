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
 * Fail loudly if the captured lineup stopped matching what the plan below
 * assumes about it.
 *
 * Every state here is a comparison between intent and the lineup, so a fixture
 * refresh that drops Godzilla — or adds Medieval Madness — silently turns
 * Shared into Missing and Missing into On. That is indistinguishable from the
 * real thing on the page, which is exactly why it is asserted rather than
 * commented.
 */
function assertLineup(machineId: number, expected: boolean): void {
  const present = snapshot.lmxes.some((l) => l.machineId === machineId);
  if (present === expected) return;
  throw new Error(
    `location-26454.json ${present ? "now carries" : "no longer carries"} ` +
      `catalog id ${String(machineId)}, which this seed assumes it does ` +
      `${expected ? "" : "not "}. The fixture was probably refreshed — pick a ` +
      `different title in supabase/seed-pinballmap-state.ts.`
  );
}

assertLineup(TITLE.godzillaPremium, true);
assertLineup(TITLE.spiderManVault, true);
assertLineup(TITLE.blackKnight, true);
assertLineup(TITLE.medievalMadness, false);

interface MachinePlan {
  initials: string;
  pinballmapMachineId: number | null;
  pinballmapIntent: "on" | "off" | "no_sync";
  pinballmapExcluded: boolean;
  presenceStatus: string | null;
  modelName: string | null;
  /** The state this row exists to produce (spec 4.2 names). */
  state: string;
}

/**
 * One machine per control state, so every frame of the two-line control can be
 * walked locally before a review (spec §4).
 *
 * | machine                | catalog | on lineup | intent   | availability | renders as |
 * |------------------------|---------|-----------|----------|--------------|------------|
 * | GDZ Godzilla (Premium) | 3416    | yes       | on       | on the floor | on         |
 * | SM  Spider-Man (Vault) | 2565    | yes       | on       | on loan      | flag       |
 * | BK  Black Knight       | 1055    | yes       | off      | on the floor | lingering  |
 * | MM  Medieval Madness   | 642     | no        | on       | on the floor | missing    |
 * | TAF Addams Family      | 3416    | yes       | off      | on the floor | covered    |
 * | HD  High Deposit       | 3416    | yes       | on       | on the floor | shared     |
 * | EBD Eight Ball Deluxe  | 1055    | yes       | no_sync  | on the floor | sync_off   |
 * | SC  Scared Stiff       | 642     | no        | off      | removed      | blocked    |
 * | FB  Fireball           | none    | —         | off      | on the floor | uncataloged|
 *
 * **The Shared / Covered pair is why GDZ, TAF and HD all point at title 3416.**
 * Coverage is a property of a same-title GROUP, so those two states cannot be
 * produced by any single machine — three cabinets of one title is the smallest
 * fixture that shows a covering sibling (HD, GDZ) and a covered one (TAF) at
 * once. TAF and HD are not really Godzillas; the alternative was inventing
 * catalog rows, and a wrong title on a dev fixture is cheaper than a wrong
 * catalog.
 *
 * Two states are deliberately not here. **Waiting** needs no stored lineup at
 * all, which would take out every other row — clear `snapshot_json` by hand to
 * see it. **Alert** needs intent On with an availability of Removed or Pending
 * arrival, which the seed cannot write: `setPinballmapIntentAction` refuses
 * that combination going in (spec 6.2), so the only honest way to reach it is
 * the way a person does — set intent On, then change availability.
 *
 * **No machine here survives being edited into a different state and back.**
 * Re-run the seed rather than reasoning about what the fixture became.
 */
const MACHINE_PLAN: MachinePlan[] = [
  {
    initials: "GDZ",
    pinballmapMachineId: TITLE.godzillaPremium,
    pinballmapIntent: "on",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "shared (with TAF off, HD on)",
  },
  {
    initials: "HD",
    pinballmapMachineId: TITLE.godzillaPremium,
    pinballmapIntent: "on",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "shared",
  },
  {
    initials: "TAF",
    pinballmapMachineId: TITLE.godzillaPremium,
    pinballmapIntent: "off",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "covered (by GDZ and HD)",
  },
  {
    initials: "SM",
    pinballmapMachineId: TITLE.spiderManVault,
    pinballmapIntent: "on",
    pinballmapExcluded: false,
    // The advise tier: in sync, green check, plus the quiet note (spec 6.5).
    presenceStatus: "on_loan",
    modelName: null,
    state: "flag",
  },
  {
    initials: "BK",
    pinballmapMachineId: TITLE.blackKnight,
    // Intent Off with the entry present and nobody covering it — the mirror of
    // Missing, and the state that offers Remove.
    pinballmapIntent: "off",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "lingering",
  },
  {
    initials: "EBD",
    pinballmapMachineId: TITLE.blackKnight,
    // Same title as BK, so its entry IS on the lineup — which is the point:
    // sync off still shows the observed fact, it just never flags it.
    pinballmapIntent: "no_sync",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "sync_off",
  },
  {
    initials: "MM",
    pinballmapMachineId: TITLE.medievalMadness,
    pinballmapIntent: "on",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "missing",
  },
  {
    initials: "SC",
    pinballmapMachineId: TITLE.medievalMadness,
    pinballmapIntent: "off",
    pinballmapExcluded: false,
    // Availability disallows the On position, with the reason beside it (6.2).
    presenceStatus: "removed",
    modelName: null,
    state: "blocked",
  },
  {
    initials: "FB",
    // The PP-3bbr shape: a cabinet with no catalog title, identified by hand.
    // `machines_model_name_requires_excluded` makes link + hand-entry mutually
    // exclusive, so this row also asserts the constraint holds.
    pinballmapMachineId: null,
    pinballmapIntent: "off",
    pinballmapExcluded: true,
    presenceStatus: "on_the_floor",
    modelName: "Fireball (home-brew conversion)",
    state: "uncataloged",
  },
  {
    initials: "AFM",
    pinballmapMachineId: null,
    pinballmapIntent: "off",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "no_model",
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
    // Every column in one UPDATE: the CHECK constraints
    // (`..._link_exclusive`, `..._intent_requires_link`,
    // `..._model_name_requires_excluded`) are row-level, so a clear-then-set
    // pair would have to pass through a legal intermediate state anyway. One
    // statement removes the need to reason about order.
    const rows = await sql`
      UPDATE machines SET
        pinballmap_machine_id = ${m.pinballmapMachineId},
        pinballmap_intent = ${m.pinballmapIntent},
        pinballmap_excluded = ${m.pinballmapExcluded},
        presence_status = COALESCE(${m.presenceStatus}, presence_status),
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
