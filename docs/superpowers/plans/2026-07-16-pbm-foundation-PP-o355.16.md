# PinballMap Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the shared DB schema + snapshot read path that PP-o355.11 (inbound sync) and PP-o355.12 (list/unlist) both build on, as one PR, so those two then proceed in parallel adding zero schema.

**Architecture:** A `pinballmap_state` singleton table (full proven shape ported from unmerged `b6eb7dca`, mirroring the `discord_integration_config` singleton pattern) plus net-new `machines` columns for the store-and-heal lmx model. One server module `state.ts` exposes `getPinballMapState()` + `syncLocationSnapshot()`: fetch our location through the client seam **outside any transaction**, then upsert the whole snapshot + health fields. The PBM client is pinned to the in-memory mock at its seam in tests.

**Tech Stack:** Drizzle ORM + drizzle-kit (migration 0052), Postgres (Supabase/PGlite), Vitest integration (PGlite worker-scoped), TypeScript strictest.

**Spec:** `docs/superpowers/specs/2026-07-16-pbm-foundation-design.md`

## Global Constraints

- **Drizzle migrations only** (CORE-ARCH-009): `pnpm run db:generate` + `pnpm run db:migrate`. Never `drizzle-kit push`.
- **Migration is fresh `0052`** — chain is at 0051. NEVER cherry-pick `b6eb7dca`'s `0046_purple_vision.sql`. Verify `drizzle/meta/_journal.json` chains 0051 → 0052.
- **No side effects inside DB transactions** (CORE-ARCH-011): the `fetchLocation` call runs before/outside any `db.transaction`.
- **Test what we own** (CORE-TEST-006): PBM client pinned to the mock at the seam; never reach `pinballmap.com`.
- **Type safety** (CORE-TS-007): ts-strictest, no `any`/`!`/unsafe `as`. **Path aliases** (CORE-TS-008): always `~/`.
- **Worker-scoped PGlite** (CORE-TEST-001): use `setupTestDb()` / `getTestDb()`; no per-test DB instances.
- `pnpm run preflight` before pushing (this touches DB schema + a migration).
- **No `force-db-reset.mjs` change** — it auto-discovers public tables since PP-wv4p (#1638).

---

### Task 1: Schema + Migration 0052

**Files:**

- Modify: `src/server/db/schema.ts` (add import; add `pinballmapState` table; add `machines` lmx column + 2 CHECKs + partial unique index)
- Modify: `src/lib/types/database.ts` (export `PinballmapState`, `NewPinballmapState`)
- Generate: `drizzle/0052_*.sql` + `drizzle/meta/0052_snapshot.json` + `_journal.json` (via `db:generate`)

**Interfaces:**

- Produces: `pinballmapState` table export (columns: `id`, `enabled`, `locationId`, `snapshotJson` typed `LocationSnapshot`, `lastSyncedAt`, `lastSyncStatus`, `lastSyncError`, `outboundEmail`, `outboundTokenVaultId`, `updatedAt`, `updatedBy`); `machines.pinballmapLmxId`; types `PinballmapState` / `NewPinballmapState`. Task 2 consumes all of these.

- [ ] **Step 1: Import `LocationSnapshot` into schema.ts**

Add to the type-imports block near the top of `src/server/db/schema.ts` (after the existing `~/lib/...` type imports, e.g. after line 25):

```ts
import type { LocationSnapshot } from "~/lib/pinballmap/types";
```

- [ ] **Step 2: Add the `pinballmapState` singleton table**

Add after the `discordIntegrationConfig` table definition in `src/server/db/schema.ts` (it mirrors that pattern — id-singleton CHECK, enum health CHECK, vault UUID with no cross-schema FK):

```ts
/**
 * PinballMap integration state (singleton).
 *
 * Exactly one row (id = 'singleton'), enforced by a CHECK constraint. Holds the
 * whole last-fetched location snapshot (`snapshotJson`) plus sync health, so every
 * downstream surface reads the stored snapshot rather than hitting PBM per request
 * (PBM's "one call per hour" conduct, CORE-PBM-001). Outbound creds (email + vault
 * token id) are written by the connect flow (PP-o355.12). Shared foundation for
 * PP-o355.11 (cron sync) and PP-o355.12 (list/unlist) — PP-o355.16.
 *
 * `outboundTokenVaultId` references `vault.secrets.id` and `updatedBy` references
 * `auth.users.id` — no FK (Drizzle cannot express cross-schema references).
 */
export const pinballmapState = pgTable(
  "pinballmap_state",
  {
    id: text("id").primaryKey().default("singleton"),
    enabled: boolean("enabled").notNull().default(false),
    locationId: integer("location_id").notNull().default(26454),
    snapshotJson: jsonb("snapshot_json").$type<LocationSnapshot>(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status", {
      enum: ["unknown", "ok", "error"],
    })
      .notNull()
      .default("unknown"),
    lastSyncError: text("last_sync_error"),
    outboundEmail: text("outbound_email"),
    outboundTokenVaultId: uuid("outbound_token_vault_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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

- [ ] **Step 3: Add the `machines` lmx column + constraints**

In the `machines` table (`src/server/db/schema.ts`), add the column after `pinballmapListed` (around line 182):

```ts
    // Durable captured PBM listing handle (the location_machine_xref id). We
    // STORE AND HEAL this rather than re-resolving it per push (PP-o355.16 /
    // .12). Nullable: only set once a machine is actually listed on PBM. An lmx
    // implies both a catalog link and pinballmap_listed (CHECKs below).
    pinballmapLmxId: integer("pinballmap_lmx_id"),
```

Then add to the table's constraint object `(t) => ({ ... })` (alongside the existing `pinballmapListedRequiresLinkCheck`):

```ts
    // An lmx handle presupposes a catalog link.
    pinballmapLmxRequiresLinkCheck: check(
      "machines_pinballmap_lmx_requires_link",
      sql`NOT (pinballmap_lmx_id IS NOT NULL AND pinballmap_machine_id IS NULL)`
    ),
    // An lmx handle presupposes we consider the machine listed.
    pinballmapLmxRequiresListedCheck: check(
      "machines_pinballmap_lmx_requires_listed",
      sql`NOT (pinballmap_lmx_id IS NOT NULL AND NOT pinballmap_listed)`
    ),
    // One PBM lister per catalog title at our location — duplicate cabinets of
    // the same title share one PBM lmx (PbmApiAudit finding #1). Partial: only
    // listed rows participate.
    pinballmapListedUnique: uniqueIndex("machines_pinballmap_listed_unique")
      .on(t.pinballmapMachineId)
      .where(sql`pinballmap_listed`),
```

(`uniqueIndex`, `check`, `integer`, `boolean`, `text`, `jsonb`, `timestamp`, `uuid` are already imported in schema.ts.)

- [ ] **Step 4: Export the row types**

In `src/lib/types/database.ts`, alongside the existing `PinballmapCatalogEntry` exports (~line 67), add:

```ts
export type PinballmapState = InferSelectModel<typeof pinballmapState>;
export type NewPinballmapState = InferInsertModel<typeof pinballmapState>;
```

Ensure `pinballmapState` is in the schema import at the top of that file (it re-imports table objects from `~/server/db/schema`; add `pinballmapState` to that import list).

- [ ] **Step 5: Generate the migration**

Run: `pnpm run db:generate`
Expected: creates `drizzle/0052_<random>.sql` containing `CREATE TABLE "pinballmap_state"` (with both CHECKs), `ALTER TABLE "machines" ADD COLUMN "pinballmap_lmx_id"`, both machines CHECKs, and `CREATE UNIQUE INDEX "machines_pinballmap_listed_unique" ... WHERE "pinballmap_listed"`. Also updates `drizzle/meta/`.

- [ ] **Step 6: Inspect the generated SQL**

Run: `cat drizzle/0052_*.sql` and confirm: fresh 0052 (not a re-add of 0046), the partial index has the `WHERE "pinballmap_listed"` clause, and `_journal.json` chains 0051 → 0052. If drizzle emitted an unexpected `pgTable`/enum artifact, stop and fix the schema before proceeding.

- [ ] **Step 7: Apply the migration locally**

Run: `pnpm run db:migrate`
Expected: applies cleanly, no error. (If local Supabase is down: `supabase start` from this worktree first.)

- [ ] **Step 8: Verify no schema drift**

Run: `pnpm run db:generate`
Expected: "No schema changes, nothing to migrate" (or equivalent no-op). If it emits a new migration, the schema and generated SQL disagree — fix and delete the stray migration.

- [ ] **Step 9: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS (0 errors). Confirms `$type<LocationSnapshot>()` and the new type exports compile.

- [ ] **Step 10: Commit**

```bash
git add src/server/db/schema.ts src/lib/types/database.ts drizzle/
git commit -m "feat(pbm): migration 0052 — pinballmap_state singleton + store-and-heal lmx columns (PP-o355.16)"
```

---

### Task 2: Shared read path (`state.ts`) + comment fix + integration test

**Files:**

- Create: `src/lib/pinballmap/state.ts`
- Modify: `src/lib/pinballmap/types.ts:23-30` (rewrite the stale ephemeral-lmx `PbmLmx` comment)
- Create: `src/test/integration/pinballmap-state.test.ts`

**Interfaces:**

- Consumes (from Task 1): `pinballmapState` table, `PinballmapState` type.
- Produces: `getPinballMapState(): Promise<PinballmapState | null>`; `syncLocationSnapshot(opts?: { updatedBy?: string }): Promise<SyncResult>` where `SyncResult = { ok: true; machineCount: number; syncedAt: Date } | { ok: false; error: string }`. PP-o355.11 (cron) and PP-o355.12 (link/verify) consume these.

- [ ] **Step 1: Write the failing integration test**

Create `src/test/integration/pinballmap-state.test.ts` (ported from `b6eb7dca`'s `pinballmap-sync.test.ts`, dropping the action/permission block and pointing at `state`; `state.ts` imports only db + client + config + types, so only those two mocks are needed):

```ts
/**
 * Integration Test: PinballMap shared read path (PP-o355.16)
 *
 * Covers the foundation read path against PGlite:
 *  - syncLocationSnapshot(): stores the whole snapshot on the singleton, sets
 *    sync health (ok/error), upserts (one row), records the error path
 *  - getPinballMapState(): reads the singleton
 */

import { describe, it, expect, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { pinballmapState } from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Pin the PinballMap client to the in-memory mock at the seam (CORE-TEST-006),
// so the sync can never reach pinballmap.com regardless of PINBALLMAP_MODE.
vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => getMockClient() };
});

describe("PinballMap shared read path (PGlite)", () => {
  setupTestDb();

  it("syncLocationSnapshot stores the snapshot and marks health ok", async () => {
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/state");

    const result = await syncLocationSnapshot();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.machineCount).toBeGreaterThan(0);

    const state = await getPinballMapState();
    expect(state).not.toBeNull();
    expect(state?.lastSyncStatus).toBe("ok");
    expect(state?.lastSyncError).toBeNull();
    expect(state?.lastSyncedAt).toBeInstanceOf(Date);
    // The whole LocationSnapshot is stored as JSON.
    expect(state?.snapshotJson?.locationId).toBe(state?.locationId);
    expect(state?.snapshotJson?.lmxes.length ?? 0).toBeGreaterThan(0);
  });

  it("is a singleton — a second sync updates the same row", async () => {
    const db = await getTestDb();
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");

    await syncLocationSnapshot();
    await syncLocationSnapshot();

    const rows = await db.select().from(pinballmapState);
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe("singleton");
  });

  it("records the error path without throwing when the fetch fails", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/state");
    const spy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("PBM unreachable"));

    const result = await syncLocationSnapshot();
    expect(result).toEqual({ ok: false, error: "PBM unreachable" });

    const state = await getPinballMapState();
    expect(state?.lastSyncStatus).toBe("error");
    expect(state?.lastSyncError).toBe("PBM unreachable");
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/test/integration/pinballmap-state.test.ts`
Expected: FAIL — cannot resolve `~/lib/pinballmap/state` (module doesn't exist yet).

- [ ] **Step 3: Create `state.ts`**

Create `src/lib/pinballmap/state.ts` (ported from `b6eb7dca`'s `sync.ts`, module renamed and the `./status` re-exports dropped):

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import { APC_LOCATION_ID } from "./config";
import type { PinballmapState } from "~/lib/types/database";

/**
 * PinballMap location-snapshot read path (foundation — PP-o355.16).
 *
 * The integration keeps one `pinballmap_state` singleton row. A sync fetches our
 * location's full JSON through the client seam and stores the WHOLE snapshot, so
 * every downstream surface (status card, desync view, link/verify) reads the
 * stored snapshot rather than hitting PBM per request — PBM's "one call per hour"
 * conduct (CORE-PBM-001). The fetch is a side effect performed OUTSIDE any
 * transaction (CORE-ARCH-011); we persist the result after it returns.
 *
 * PP-o355.11 schedules `syncLocationSnapshot` on a cron; PP-o355.12 reuses the
 * persisted snapshot to resolve/verify lmx handles.
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
 * sync health. Never throws on a PBM/network failure: it records the error on the
 * singleton and returns `{ ok: false }` so callers (cron, "Sync now") can surface
 * it without a 500.
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/test/integration/pinballmap-state.test.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 5: Fix the stale ephemeral-lmx comment**

In `src/lib/pinballmap/types.ts`, replace the `PbmLmx` doc comment (lines 23-30) — the current text says the lmx "is ephemeral … resolved from the latest snapshot at action time and never cached," which contradicts the locked store-and-heal model. Replace with:

```ts
/**
 * A location_machine_xref — "this machine at this location". The `id` (lmx id)
 * is the durable listing handle: we capture it when a machine is listed and
 * STORE it on `machines.pinballmap_lmx_id`, healing it from the latest snapshot
 * when PBM re-mints one (removing + re-adding a machine changes the id). We do
 * not re-resolve it per push — see the store-and-heal model (PP-o355.16 / .12).
 *
 * Note: PBM's location payload carries only `machineId` here, not the machine
 * name — names come from the catalog mirror (bead B).
 */
```

- [ ] **Step 6: Re-run the test + typecheck**

Run: `pnpm exec vitest run src/test/integration/pinballmap-state.test.ts && pnpm run typecheck`
Expected: test PASS, typecheck PASS (the comment change is doc-only; this confirms nothing regressed).

- [ ] **Step 7: Commit**

```bash
git add src/lib/pinballmap/state.ts src/lib/pinballmap/types.ts src/test/integration/pinballmap-state.test.ts
git commit -m "feat(pbm): shared snapshot read path + store-and-heal lmx comment fix (PP-o355.16)"
```

---

### Task 3: Preflight + PR

- [ ] **Step 1: Run preflight** (this touches DB schema + a migration — preflight is required, not just `check`)

Run: `pnpm run preflight`
Expected: check + build + integration all green. Fix anything red before proceeding.

- [ ] **Step 2: Push and open the PR ready-for-review**

```bash
git push -u origin worktree-pbm-foundation-PP-o355.16
```

Then open the PR (title references PP-o355.16; body summarizes: migration 0052, state.ts read path, comment fix; notes it unblocks parallel .11 + .12). Follow `pinpoint-pr-workflow` for CI + Copilot review handling. Update the bead `--design` with the plan path + branch and `--notes` with the PR number.

## Self-Review

**Spec coverage:**

- Migration 0052 (pinballmap_state full shape + machines lmx + 2 CHECKs + partial unique) → Task 1 ✓
- `getPinballMapState()` + `syncLocationSnapshot()` (fetch outside txn, never throws, health fields) → Task 2 ✓
- `PinballmapState` type export → Task 1 Step 4 ✓
- `types.ts` ephemeral-lmx comment fix → Task 2 Step 5 ✓
- Integration test (upsert + persist + error path, mock at seam) → Task 2 Steps 1-4 ✓
- Fresh-0052 / never-reapply-0046 landmine → Global Constraints + Task 1 Steps 5-6 ✓
- Partial-unique-on-existing-data risk → verified by `db:migrate` on local seed (Task 1 Step 7); low risk (listing default false, backfill is PP-h059)
- Explicitly-out items (cron/status/action/UI/vault-write) → not present in any task ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; all commands have expected output.

**Type consistency:** `pinballmapState`, `PinballmapState`, `SyncResult { ok; machineCount; syncedAt } | { ok; error }`, `getPinballMapState`, `syncLocationSnapshot` — names/signatures match across Task 1 (produces) and Task 2 (consumes) and the test.
