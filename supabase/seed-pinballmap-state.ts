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
 * (`fixtures/location-26454.json`, a capture of APC's location — 101 entries as
 * captured, plus one seed-added row (Attack from Mars) so the AFM cabinet can
 * render its correct match as `on`; see MACHINE_PLAN), so what dev renders is
 * what the cron would have produced.
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
 * state is a function of BOTH the snapshot and the machine's own columns. Every
 * cabinet is matched to its OWN real title (so the machine header reads
 * correctly); the spread across the listing states comes from intent and
 * availability, not from mismatched titles. Of the twelve: seven are matched to
 * a title the captured lineup carries, three to a title it does not, one is
 * matched to nothing (the no-model fixture), and one is hand-entered (the
 * uncataloged fixture). Each id below was verified against both fixtures; see
 * the table in `MACHINE_PLAN`.
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
  godzillaPremium: 3416, // on the lineup → shared / covered
  slickChick: 1513, // on the lineup → alert
  blackKnight: 1055, // on the lineup → lingering
  spiderManVault: 2565, // on the lineup → flag
  medievalMadness: 642, // in the catalog, NOT on the lineup → missing
  addamsFamily: 90002, // added to the mirror, NOT on the lineup → sync_off
  eightBallDeluxe: 90003, // added to the mirror, NOT on the lineup → blocked
  attackFromMars: 90001, // added to the mirror AND the lineup → on
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
assertLineup(TITLE.slickChick, true);
assertLineup(TITLE.blackKnight, true);
assertLineup(TITLE.spiderManVault, true);
assertLineup(TITLE.medievalMadness, false);
assertLineup(TITLE.addamsFamily, false);
assertLineup(TITLE.eightBallDeluxe, false);
// Attack from Mars is not in APC's real capture; the seed adds it to
// location-26454.json so the AFM cabinet renders its correct match as `on`.
// refresh-fixture.ts rewrites that file verbatim from the live API, so a future
// refresh would drop this entry — at which point this assertion fails loudly at
// db:reset (which is what it is for) and AFM must be re-pointed or re-added.
assertLineup(TITLE.attackFromMars, true);

interface MachinePlan {
  initials: string;
  pinballmapMachineId: number | null;
  pinballmapIntent: "on" | "off" | "no_sync";
  pinballmapExcluded: boolean;
  presenceStatus: string | null;
  modelName: string | null;
  /**
   * Hand-entered model metadata, for the uncataloged rows only. A MATCHED row
   * leaves these unset — the seed copies them from the catalog mirror, the same
   * way `resolveCore` does on a real link, so seeded machines and machines
   * linked through the form carry identical columns. Setting them by hand here
   * would let the seed drift from the catalog it is seeded beside.
   */
  manufacturer?: string;
  year?: number;
  /** The state this row exists to produce (spec 4.2 names). */
  state: string;
}

/**
 * One machine per control state, so every frame of the two-line control can be
 * walked locally before a review (spec §4). Every cabinet is matched to its own
 * real title — the states come from intent and availability, not wrong titles.
 *
 * | machine                | catalog | on lineup | intent  | availability | renders as  |
 * |------------------------|---------|-----------|---------|--------------|-------------|
 * | GDZ  Godzilla          | 3416    | yes       | on      | on the floor | shared      |
 * | GDZ2 Godzilla          | 3416    | yes       | on      | on the floor | shared      |
 * | GDZ3 Godzilla          | 3416    | yes       | off     | on the floor | covered     |
 * | SM   Spider-Man        | 2565    | yes       | on      | on loan      | flag        |
 * | BK   Black Knight      | 1055    | yes       | off     | on the floor | lingering   |
 * | AFM  Attack from Mars  | 90001   | yes       | on      | on the floor | on          |
 * | SC   Slick Chick       | 1513    | yes       | on      | removed      | alert       |
 * | MM   Medieval Madness  | 642     | no        | on      | on the floor | missing     |
 * | TAF  The Addams Family | 90002   | no        | no_sync | on the floor | sync_off    |
 * | EBD  Eight Ball Deluxe | 90003   | no        | off     | removed      | blocked     |
 * | HD   Humpty Dumpty     | none    | —         | off     | on the floor | no_model    |
 * | HB   Hyperball         | none    | —         | off     | on the floor | uncataloged |
 *
 * **Shared and Covered need three cabinets of one title**, so GDZ / GDZ2 / GDZ3
 * are three genuine Godzillas the club owns (all matched to 3416): two intent-On
 * cover each other (shared), the third intent-Off is covered by them (covered).
 * Coverage is a property of a same-title GROUP, so no single machine can produce
 * either state. Unlike the previous fixture these are not other games pretending
 * to be Godzilla — they are real duplicate cabinets, so every machine header
 * still reads its own correct title.
 *
 * **AFM renders `on` — the plain, healthy state** — because Attack from Mars was
 * added to the lineup fixture (see assertLineup above). MM stays `missing`:
 * matched, intent On, but its title is not on the lineup.
 *
 * **HD is the no-model fixture** (matched to nothing) and **HB the uncataloged
 * one** (hand-entered Williams / 1981 — Hyperball is a real flipperless Williams
 * title with no pinball catalog entry). These two are the deliberate exceptions
 * to "every game gets its correct match".
 *
 * **Alert is now seeded** (SC): intent On with availability Removed. Spec 6.2
 * blocks entering that from the intent side but allows it from the availability
 * side, and no CHECK constraint on `machines` mentions `presence_status`, so a
 * row written straight to the end state is exactly what a real machine reaches
 * by being marked Removed after intent was set On.
 *
 * **Two states are still not seeded.** `off` (intent Off, entry absent,
 * availability fine) and `waiting` (needs no stored lineup at all, which would
 * take out every other row — clear `snapshot_json` by hand to see it). Both are
 * trivial to reach by hand; neither had a spare cabinet.
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
    state: "shared (with GDZ3 off, GDZ2 on)",
  },
  {
    initials: "GDZ2",
    pinballmapMachineId: TITLE.godzillaPremium,
    pinballmapIntent: "on",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "shared",
  },
  {
    initials: "GDZ3",
    pinballmapMachineId: TITLE.godzillaPremium,
    pinballmapIntent: "off",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "covered (by GDZ and GDZ2)",
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
    initials: "AFM",
    pinballmapMachineId: TITLE.attackFromMars,
    // The plain, healthy state: matched, on the lineup, intent On, no same-title
    // sibling. Attack from Mars is on the lineup only because the seed put it
    // there (see assertLineup) — APC's real capture does not carry it.
    pinballmapIntent: "on",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "on",
  },
  {
    initials: "SC",
    pinballmapMachineId: TITLE.slickChick,
    // Intent On with availability Removed → Alert (spec 6.2, availability side).
    pinballmapIntent: "on",
    pinballmapExcluded: false,
    presenceStatus: "removed",
    modelName: null,
    state: "alert",
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
    initials: "TAF",
    pinballmapMachineId: TITLE.addamsFamily,
    // Matched but intent no_sync: PinPoint holds the link and simply stops
    // syncing this cabinet to PinballMap. Off-lineup here, but sync_off does not
    // depend on the lineup. TAF stays On-the-floor so its seeded issues stay in
    // the default issue list — much of the E2E suite (smoke/issue-list,
    // issue-list-extended) treats TAF as the live machine with major issues, and
    // a Removed machine drops out of that list entirely (filters-queries.ts).
    pinballmapIntent: "no_sync",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "sync_off",
  },
  {
    initials: "EBD",
    pinballmapMachineId: TITLE.eightBallDeluxe,
    // Off-lineup + intent Off + Removed → Blocked: availability disallows the On
    // position, with the reason beside it (6.2). EBD carries Blocked rather than
    // TAF because a Removed machine drops out of the default issue list, and the
    // suite leans on TAF's issues staying listed while nothing lists EBD's. The
    // reassign picker and direct /m/EBD routes ignore presence, so EBD stays
    // usable as machine-timeline's reassign target and responsive-overflow's
    // member-owned edit surface.
    pinballmapIntent: "off",
    pinballmapExcluded: false,
    presenceStatus: "removed",
    modelName: null,
    state: "blocked",
  },
  {
    initials: "HD",
    // The no-model fixture: a cabinet nobody has matched. "No model set" is the
    // honest state, and a 1947 EM is a plausible thing to leave unmatched.
    pinballmapMachineId: null,
    pinballmapIntent: "off",
    pinballmapExcluded: false,
    presenceStatus: "on_the_floor",
    modelName: null,
    state: "no_model",
  },
  {
    initials: "HB",
    // The PP-3bbr shape: a cabinet with no catalog title, identified by hand.
    // `machines_model_name_requires_excluded` makes link + hand-entry mutually
    // exclusive, so this row also asserts the constraint holds. Hyperball is a
    // real 1981 Williams title with no pinball catalog entry (it has no
    // flippers), so it is genuinely uncataloged rather than a stand-in.
    pinballmapMachineId: null,
    pinballmapIntent: "off",
    pinballmapExcluded: true,
    presenceStatus: "on_the_floor",
    modelName: "Hyperball",
    // The hand-entered half of PP-3bbr, and the only row that exercises it: a
    // manufacturer and year on a machine with no catalog row to derive them
    // from. The machine header reads these exactly as it reads a matched
    // machine's catalog-derived pair (PP-3bbr.1), so this row is what proves
    // the two sources render identically.
    manufacturer: "Williams",
    year: 1981,
    state: "uncataloged",
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
      (id, location_id, snapshot_json, last_synced_at,
       last_sync_attempt_at, last_sync_status, last_sync_error)
    VALUES
      ('singleton', ${snapshot.locationId}, ${JSON.stringify(snapshot)}::text::jsonb, now(),
       now(), 'ok', NULL)
    ON CONFLICT (id) DO UPDATE SET
      location_id = excluded.location_id,
      snapshot_json = excluded.snapshot_json,
      last_synced_at = excluded.last_synced_at,
      last_sync_attempt_at = excluded.last_sync_attempt_at,
      last_sync_status = excluded.last_sync_status,
      last_sync_error = excluded.last_sync_error,
      updated_at = now()
  `;

  // Read the row back rather than trusting the write.
  //
  // `${JSON.stringify(x)}::jsonb` — the obvious spelling, and what this used
  // to say — stores a jsonb *string*: postgres.js infers the parameter's type
  // from the cast that follows it, sends the already-serialized text as json,
  // and the server stores `"{\"lmxes\":…}"` rather than an object. Every
  // consumer then reads `snapshot.lmxes` as undefined. `::text::jsonb` pins
  // the parameter to text so the jsonb cast parses it, which is why the double
  // cast is deliberate and not redundant.
  //
  // Nothing about the failure is loud: the INSERT succeeds, this script prints
  // its success line, and the first symptom is a TypeError several layers away
  // in whichever page or spec touches the lineup first — it cost an E2E run to
  // find. The shape is cheap to assert here and expensive to diagnose
  // anywhere else.
  const [stored] = await sql`
    SELECT jsonb_typeof(snapshot_json) AS kind,
           jsonb_typeof(snapshot_json -> 'lmxes') AS entries
    FROM pinballmap_state WHERE id = 'singleton'
  `;
  if (stored?.["kind"] !== "object" || stored["entries"] !== "array") {
    throw new Error(
      `snapshot_json stored as ${String(stored?.["kind"])} with lmxes as ` +
        `${String(stored?.["entries"])} — expected object/array. The jsonb ` +
        `bind is double-encoding; keep the ::text::jsonb cast pair.`
    );
  }

  // Catalog metadata for every title the plan links to, read once.
  //
  // The seed used to leave `manufacturer` / `year` / `opdb_id` / `ipdb_id` null
  // on matched machines, which made local data disagree with production: a
  // machine linked through the edit form gets all four copied off the mirror by
  // `resolveCore`, so the seed was producing a row shape the app never creates.
  // Nothing noticed until the machine header started rendering those columns
  // (PP-3bbr.1) and every seeded machine showed a blank sub-line.
  //
  // Copied from the mirror rather than typed into the plan above, so the seed
  // cannot drift from the catalog it is seeded alongside.
  interface CatalogMeta {
    pinballmap_machine_id: number;
    manufacturer: string | null;
    year: number | null;
    opdb_id: string | null;
    ipdb_id: number | null;
  }
  const catalogIds = MACHINE_PLAN.map((m) => m.pinballmapMachineId).filter(
    (id): id is number => id !== null
  );
  const catalogRows =
    catalogIds.length > 0
      ? await sql<CatalogMeta[]>`
          SELECT pinballmap_machine_id, manufacturer, year, opdb_id, ipdb_id
          FROM pinballmap_catalog
          WHERE pinballmap_machine_id = ANY(${catalogIds})
        `
      : [];
  const catalogById = new Map<number, CatalogMeta>(
    catalogRows.map((r) => [r.pinballmap_machine_id, r])
  );

  let updated = 0;
  for (const m of MACHINE_PLAN) {
    // Matched reads the catalog; uncataloged reads the plan's hand-entered
    // pair. Never both — `machines_model_name_requires_excluded` makes that a
    // constraint rather than a convention (PP-3bbr).
    const catalog =
      m.pinballmapMachineId !== null
        ? catalogById.get(m.pinballmapMachineId)
        : undefined;
    if (m.pinballmapMachineId !== null && catalog === undefined) {
      throw new Error(
        `${m.initials} links to catalog title #${String(m.pinballmapMachineId)}, ` +
          `which is not in the mirror — run seed-pinballmap-catalog first.`
      );
    }
    // A matched row's metadata comes from the mirror, so a hand-entered pair on
    // one would be silently ignored — the ternary below never looks at it. Said
    // out loud rather than left as a convention in the interface comment,
    // because the failure is a plan row that looks like it configures something
    // and does not.
    if (
      m.pinballmapMachineId !== null &&
      (m.manufacturer !== undefined || m.year !== undefined)
    ) {
      throw new Error(
        `${m.initials} is matched to a catalog title AND carries a hand-entered ` +
          `manufacturer/year. Matched rows take both from the mirror — drop the ` +
          `hand-entered pair, or drop the match.`
      );
    }
    const manufacturer = catalog
      ? catalog.manufacturer
      : (m.manufacturer ?? null);
    const year = catalog ? catalog.year : (m.year ?? null);
    const opdbId = catalog ? catalog.opdb_id : null;
    const ipdbId = catalog ? catalog.ipdb_id : null;

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
        model_name = ${m.modelName},
        manufacturer = ${manufacturer},
        year = ${year},
        opdb_id = ${opdbId},
        ipdb_id = ${ipdbId}
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
