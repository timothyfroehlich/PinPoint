# PBM Shared Foundation Implementation Plan (PP-o355.16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared DB schema (`pinballmap_state` singleton + `machines.pinballmap_lmx_id` + constraints) and the one shared read path (`fetchLocation` → persist snapshot) that PP-o355.11 (snapshot sync) and PP-o355.12 (list/unlist) both build on, so those two can then proceed in parallel without colliding on the same migration.

**Architecture:** Recover the schema + `sync.ts` intent from the reverted commit `b6eb7dca` (it was authored then dropped before PP-o355.3's squash merge to keep C minimal). Regenerate the migration FRESH (it becomes `0052`, not the old `0046`). Add the new `pinballmap_lmx_id` column + its constraints that did NOT exist in `b6eb7dca`. Correct the stale "ephemeral lmx" doc comment. This bead ships schema + `getPinballMapState()` + `syncLocationSnapshot()` ONLY — no cron, no Sync-now action, no permission, no status derivation, no vault, no UI (those belong to `.11`/`.12`).

**Tech Stack:** Drizzle ORM (Postgres), drizzle-kit migrations, PGlite (worker-scoped) + Vitest for integration tests, the existing PinballMap client seam (`getPinballMapClient()` / mock).

## Global Constraints

- **Drizzle migrations only** (CORE-ARCH-009): `pnpm run db:generate` then `pnpm run db:migrate`. Never hand-edit `drizzle/meta/`. Never `drizzle-kit push`.
- **Regenerate migration FRESH** — do NOT cherry-pick `b6eb7dca`'s `0046_purple_vision.sql`. On `origin/main`, `0046` is a different migration (RLS on `pinballmap_catalog`); the chain is at `0051`. The generated file must be `0052`.
- **No side effects inside DB transactions** (CORE-ARCH-011): the `fetchLocation` HTTP call happens OUTSIDE any `db.transaction`; persist the result after it returns.
- **Test what we own / never reach pinballmap.com** (CORE-TEST-006, CORE-PBM-001): integration tests pin the PBM client to the in-memory mock via `vi.mock("~/lib/pinballmap/client", () => ({ getPinballMapClient: () => getMockClient() }))`.
- **Worker-scoped PGlite** (CORE-TEST-001): use the shared `getTestDb()` seam; no per-test DB instances.
- **Type safety** (CORE-TS-007): ts-strictest, no `any`/`!`/unsafe `as`. **Path aliases** (`~/…`).
- **Run `pnpm run preflight` before pushing** (this is a migration + schema change).

---

### Task 1: Schema — `pinballmap_state` singleton + `machines.pinballmap_lmx_id` + constraints

**Files:**

- Modify: `src/server/db/schema.ts` (add `pinballmapState` table near the other pinballmap tables ~`:220`; add one column + constraints to the existing `machines` table `:167-204`)
- Modify: `src/lib/pinballmap/types.ts:23-30` (correct the stale "ephemeral" comment)

**Interfaces:**

- Consumes: `LocationSnapshot` (already exported from `src/lib/pinballmap/types.ts:40`); existing drizzle imports in `schema.ts` (`pgTable, text, integer, boolean, jsonb, timestamp, uuid, check, sql, index`).
- Produces: `pinballmapState` table export (columns below); `machines.pinballmapLmxId` column. Consumed by Task 2 and by PP-o355.11/.12.

- [ ] **Step 1: Add the `pinballmapState` table to `schema.ts`.**

Insert after the `pinballmapCatalog` table (~`:220`). This is recovered verbatim from `b6eb7dca` (confirmed columns), which already includes the `outbound_email`/`outbound_token_vault_id` Vault reference columns PP-o355.12 needs — so the whole shared table lands here once:

```ts
export const pinballmapState = pgTable(
  "pinballmap_state",
  {
    id: text("id").primaryKey().default("singleton"),
    enabled: boolean("enabled").notNull().default(false),
    // Austin Pinball Collective's PBM location (see APC_LOCATION_ID in config).
    locationId: integer("location_id").notNull().default(26454),
    // The whole LocationSnapshot from the last sync (raw PBM payload included).
    // Typed via $type so reads come back as LocationSnapshot without a cast.
    snapshotJson: jsonb("snapshot_json").$type<LocationSnapshot>(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status", {
      enum: ["unknown", "ok", "error"],
    })
      .notNull()
      .default("unknown"),
    lastSyncError: text("last_sync_error"),
    // Outbound operator creds (PP-o355.12). Token lives in Supabase Vault; this
    // is only the UUID reference to vault.secrets.id (no FK — cross-schema).
    outboundEmail: text("outbound_email"),
    outboundTokenVaultId: uuid("outbound_token_vault_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // UUID reference to auth.users.id — no FK (Drizzle cannot cross-schema).
    updatedBy: uuid("updated_by"),
  },
  (_t) => ({
    singletonCheck: check("pinballmap_state_singleton", sql`id = 'singleton'`),
    syncStatusCheck: check(
      "pinballmap_state_sync_status_check",
      sql`last_sync_status IN ('unknown', 'ok', 'error')`
    ),
  })
);
```

Ensure `LocationSnapshot` is imported at the top of `schema.ts` (it is used by `$type`): `import type { LocationSnapshot } from "~/lib/pinballmap/types";` — add only if not already present. Add any missing drizzle column-builder imports (`jsonb`, `uuid`, `timestamp`) to the existing import.

- [ ] **Step 2: Add `pinballmapLmxId` + constraints to the `machines` table.**

In the `machines` `pgTable` columns block (near the other `pinballmap*` columns, after `:182`):

```ts
    // The durable captured PBM listing handle (location_machine_xref id).
    // Populated by PP-o355.12 (addMachine return / link-existing-entry) and
    // healed by PP-o355.11 on drift. Nullable: a machine can be linked to a
    // catalog title (pinballmap_machine_id) and even listed on PBM without us
    // having captured its lmx yet (the pre-alignment fleet).
    pinballmapLmxId: integer("pinballmap_lmx_id"),
```

In the `machines` table's constraints callback (where `machines_pinballmap_link_exclusive` and `machines_pinballmap_listed_requires_link` live, `:195`/`:201`), add three constraints:

```ts
    pinballmapLmxRequiresLink: check(
      "machines_pinballmap_lmx_requires_link",
      sql`NOT (pinballmap_lmx_id IS NOT NULL AND pinballmap_machine_id IS NULL)`
    ),
    pinballmapLmxRequiresListed: check(
      "machines_pinballmap_lmx_requires_listed",
      sql`NOT (pinballmap_lmx_id IS NOT NULL AND pinballmap_listed = false)`
    ),
    // One PinPoint machine may own the PBM listing for a given catalog title at
    // our location: PBM create is find-or-create on (location, machine_id), so
    // duplicate same-title cabinets share ONE lmx (PbmApiAudit finding #1).
    pinballmapOneListerPerTitle: uniqueIndex(
      "machines_pinballmap_one_lister_per_title"
    )
      .on(t.pinballmapMachineId)
      .where(sql`pinballmap_listed`),
```

Add `uniqueIndex` to the drizzle imports if not already present. Confirm the constraints callback uses `t` (the table param) — match the existing callback's param name; if it uses `(t) =>` keep `t`, if `(table) =>` use `table`.

- [ ] **Step 3: Correct the stale "ephemeral lmx" comment in `types.ts:23-30`.**

Replace the `PbmLmx` doc comment (currently claims the lmx "is ephemeral … resolved from the latest snapshot at action time and never cached"):

```ts
/**
 * A location_machine_xref — "this machine at this location". The `id` (lmx id)
 * is durable in normal operation: it changes only when a machine is fully
 * removed and re-added on PBM *outside* PBM's 7-day resurrection window (within
 * it, a re-add reuses the same lmx row + id, and its comments). PinPoint stores
 * the captured id (machines.pinballmap_lmx_id) and heals it from the hourly
 * snapshot on drift, rather than re-resolving it on every action.
 *
 * Note: PBM's location payload carries only `machineId` here, not the machine
 * name — names come from the catalog mirror (bead B).
 */
```

- [ ] **Step 4: Generate the migration.**

Run: `pnpm run db:generate`
Expected: a new `drizzle/0052_<random_name>.sql` + `drizzle/meta/0052_snapshot.json` are created. Open the `.sql` and confirm it: `CREATE TABLE "pinballmap_state" (...)`, `ALTER TABLE "machines" ADD COLUMN "pinballmap_lmx_id" integer`, the three new machine constraints, and the two `pinballmap_state` CHECKs. It must NOT alter unrelated tables. If it tries to, stop — the local schema drifted from main; re-sync `git merge origin/main` first.

- [ ] **Step 5: Apply the migration locally.**

Run: `pnpm run db:migrate`
Expected: migration `0052` applies with no error; the `pinballmap_state` table and `pinballmap_lmx_id` column now exist locally.

- [ ] **Step 6: Typecheck.**

Run: `pnpm run typecheck`
Expected: PASS (no errors from the `$type<LocationSnapshot>()` or the new column).

- [ ] **Step 7: Commit.**

```bash
git add src/server/db/schema.ts src/lib/pinballmap/types.ts drizzle/
git commit -m "feat(db): PBM shared foundation schema — pinballmap_state + pinballmap_lmx_id (PP-o355.16)"
```

---

### Task 2: Sync service — `getPinballMapState()` + `syncLocationSnapshot()`

**Files:**

- Create: `src/lib/pinballmap/sync.ts`
- Test: `src/test/integration/pinballmap-foundation.test.ts`

**Interfaces:**

- Consumes: `pinballmapState` (Task 1); `getPinballMapClient()` from `./client`; `APC_LOCATION_ID` from `./config`; the generated `PinballmapState` row type from `~/lib/types/database`.
- Produces:
  - `getPinballMapState(): Promise<PinballmapState | null>`
  - `syncLocationSnapshot(opts?: { updatedBy?: string }): Promise<SyncResult>` where `SyncResult = { ok: true; machineCount: number; syncedAt: Date } | { ok: false; error: string }`
  - These are consumed by PP-o355.11 (cron + Sync-now wrap `syncLocationSnapshot`) and PP-o355.12 (link/verify read `getPinballMapState().snapshotJson`).

- [ ] **Step 1: Write the failing integration test.**

Create `src/test/integration/pinballmap-foundation.test.ts`. Mirror the mock-seam + PGlite setup from `src/test/integration/pinballmap-linking.test.ts:24-53` (same `vi.mock` of `~/server/db` via `getTestDb()`, and `~/lib/pinballmap/client` pinned to `getMockClient()`).

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb } from "~/test/helpers/integration-db"; // match the exact path used by pinballmap-linking.test.ts
import { getMockClient, resetMockClient } from "~/lib/pinballmap/client-mock"; // confirm reset helper name in client-mock.ts

vi.mock("~/server/db", async () => ({ db: (await getTestDb()).db }));
vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () => getMockClient(),
}));

import {
  getPinballMapState,
  syncLocationSnapshot,
} from "~/lib/pinballmap/sync";

describe("pinballmap foundation — state singleton + snapshot persist", () => {
  beforeEach(() => {
    resetMockClient(); // if the mock singleton needs resetting between tests; else seed via its API
  });

  it("returns null before any sync", async () => {
    expect(await getPinballMapState()).toBeNull();
  });

  it("persists a fetched snapshot and marks health ok", async () => {
    const result = await syncLocationSnapshot();
    expect(result.ok).toBe(true);
    const state = await getPinballMapState();
    expect(state).not.toBeNull();
    expect(state?.lastSyncStatus).toBe("ok");
    expect(state?.snapshotJson?.locationId).toBe(26454);
    expect(state?.lastSyncError).toBeNull();
  });

  it("upserts the same singleton row on a second sync (no duplicate)", async () => {
    await syncLocationSnapshot();
    await syncLocationSnapshot();
    // singleton: a second sync updates, not inserts — assert exactly one row.
    const rows = await (await getTestDb()).db.query.pinballmapState.findMany();
    expect(rows).toHaveLength(1);
  });
});
```

Note for the implementer: confirm the exact helper names by reading `pinballmap-linking.test.ts` (the `getTestDb` import path and how it mocks `~/server/db`) and `client-mock.ts` (the reset/seed API) — match them exactly rather than guessing. The mock's `fetchLocation` returns a `LocationSnapshot` for `APC_LOCATION_ID`; if it needs a machine seeded to have a non-zero `machineCount`, use the mock's documented seeding API.

- [ ] **Step 2: Run the test to verify it fails.**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run src/test/integration/pinballmap-foundation.test.ts`
Expected: FAIL — `sync.ts` does not exist yet (import error).

- [ ] **Step 3: Write `src/lib/pinballmap/sync.ts`.**

This is recovered from `b6eb7dca`'s `sync.ts` but **trimmed to the foundation only** — it must NOT re-export `shouldBeListedOnPbm`/`derivePbmMachineStatus` (those belong to PP-o355.11's `status.ts`, not created here).

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import { APC_LOCATION_ID } from "./config";
import type { PinballmapState } from "~/lib/types/database";

/**
 * PinballMap location-snapshot sync — shared foundation (PP-o355.16).
 *
 * The integration keeps one `pinballmap_state` singleton row. A sync fetches our
 * location's full JSON through the client seam and stores the WHOLE snapshot, so
 * every downstream surface (status card, desync view, comment ingestion,
 * list/unlist link-resolution) reads the stored snapshot rather than hitting PBM
 * per request — PBM's "one call per hour" conduct. The fetch is a side effect
 * performed OUTSIDE any transaction (CORE-ARCH-011); we persist after it returns.
 */

const SINGLETON_ID = "singleton";

/** Read the integration-state singleton (null when never initialized). */
export async function getPinballMapState(): Promise<PinballmapState | null> {
  const [row] = await db
    .select()
    .from(pinballmapState)
    .where(eq(pinballmapState.id, SINGLETON_ID))
    .limit(1);
  return row ?? null;
}

/** Outcome of a sync attempt. */
export type SyncResult =
  | { ok: true; machineCount: number; syncedAt: Date }
  | { ok: false; error: string };

/**
 * Fetch the configured location's snapshot from PBM and store it whole, updating
 * sync health. Never throws on a PBM/network failure: it records the error on
 * the singleton and returns `{ ok: false }` so callers can surface it without a
 * 500.
 */
export async function syncLocationSnapshot(opts?: {
  updatedBy?: string;
}): Promise<SyncResult> {
  const state = await getPinballMapState();
  const locationId = state?.locationId ?? APC_LOCATION_ID;
  const syncedAt = new Date();

  try {
    const snapshot = await getPinballMapClient().fetchLocation(locationId);
    await db
      .insert(pinballmapState)
      .values({
        id: SINGLETON_ID,
        locationId,
        snapshotJson: snapshot,
        lastSyncedAt: syncedAt,
        lastSyncStatus: "ok",
        lastSyncError: null,
        updatedAt: syncedAt,
        ...(opts?.updatedBy ? { updatedBy: opts.updatedBy } : {}),
      })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: {
          snapshotJson: snapshot,
          lastSyncedAt: syncedAt,
          lastSyncStatus: "ok",
          lastSyncError: null,
          updatedAt: syncedAt,
          ...(opts?.updatedBy ? { updatedBy: opts.updatedBy } : {}),
        },
      });
    return { ok: true, machineCount: snapshot.machineCount, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await db
      .insert(pinballmapState)
      .values({
        id: SINGLETON_ID,
        locationId,
        lastSyncedAt: syncedAt,
        lastSyncStatus: "error",
        lastSyncError: message,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: {
          lastSyncedAt: syncedAt,
          lastSyncStatus: "error",
          lastSyncError: message,
          updatedAt: syncedAt,
        },
      });
    return { ok: false, error: message };
  }
}
```

Note: confirm `PinballmapState` is exported from `~/lib/types/database` after Task 1's schema change (it is generated from the drizzle schema — regenerate types if the repo has a `db:types` step; otherwise the drizzle `$inferSelect` type is available as `typeof pinballmapState.$inferSelect` and can be used directly instead of the `~/lib/types/database` import if that module isn't auto-generated). Verify which pattern the repo uses by checking how `pinballmapCatalog`'s row type is imported elsewhere.

- [ ] **Step 4: Run the test to verify it passes.**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run src/test/integration/pinballmap-foundation.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/pinballmap/sync.ts src/test/integration/pinballmap-foundation.test.ts
git commit -m "feat(pinballmap): shared snapshot-sync service — getPinballMapState + syncLocationSnapshot (PP-o355.16)"
```

---

### Task 3: Force-db-reset drop-list + preflight

**Files:**

- Modify: the force-db-reset script's pinballmap drop-list (search for where `pinballmap_catalog` is dropped — `rg "pinballmap_catalog" scripts/`). `b6eb7dca` noted "force-db-reset: drop pinballmap_state (same drop-list footgun as the catalog)."

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing importable — this keeps `db:reset`/force-reset coherent with the new table.

- [ ] **Step 1: Find the drop-list.**

Run: `rg -n "pinballmap_catalog" scripts/`
Expected: a force-db-reset / drop helper that lists pinballmap tables to drop.

- [ ] **Step 2: Add `pinballmap_state` alongside `pinballmap_catalog`.**

Add `pinballmap_state` to the same drop list, matching the existing idiom (order it so it drops without FK issues — it has no FKs, so placement is flexible).

- [ ] **Step 3: Run preflight (migration-class change).**

Run: `pnpm run preflight`
Expected: PASS — types, lint, format, unit, build, and integration all green (includes the new foundation test).

- [ ] **Step 4: Commit.**

```bash
git add scripts/
git commit -m "chore(db): drop pinballmap_state on force-reset (PP-o355.16)"
```

---

## Self-Review

**Spec coverage (against PP-o355.16 scope):**

- Migration 0052 fresh (not 0046) → Task 1 Step 4 (explicit guard in Global Constraints + step).
- `pinballmap_state` singleton with all shared columns (incl. `outbound_*` for .12) → Task 1 Step 1.
- `machines.pinballmap_lmx_id` + the two CHECKs + partial-unique → Task 1 Step 2.
- `getPinballMapState()` + `syncLocationSnapshot()`, fetch outside tx → Task 2 Step 3.
- Types corrected (ephemeral comment) → Task 1 Step 3.
- Mock-pinned integration test (upsert + persist + seam) → Task 2 Step 1.
- Explicitly-excluded items (cron, Sync-now, permission, status derivation, vault, UI) → none appear; `sync.ts` deliberately drops the `status` re-export.

**Placeholder scan:** No TBD/TODO; every code step shows the code; two implementer-verify notes (exact `getTestDb`/mock-reset helper names; `PinballmapState` type import vs `$inferSelect`) are explicit "confirm against this file" instructions, not placeholders — they exist because those are house-specific names the plan shouldn't guess.

**Type consistency:** `SyncResult`, `getPinballMapState`, `syncLocationSnapshot`, `pinballmapState`, `pinballmapLmxId` are used identically across Tasks 1–2. `LocationSnapshot` matches `types.ts:40`.

---

## Execution Handoff

Foundation plan complete. Because it's the unblocker for the parallel `.11`/`.12` work, the intended flow is: implement this → open its PR → merge → then fork `.11` and `.12`. Execution options (subagent-driven vs inline) to be chosen with Tim, after clearing the multi-agent scale gate (count + cost).
