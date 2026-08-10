# PinballMap Orphaned Listings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retitling a machine that is listed on PinballMap records the abandoned listing instead of silently discarding the handle that identifies it.

**Architecture:** A new side table holds one row per abandoned PinballMap entry, keyed to the machine that abandoned it. `resolvePbmLinkColumns` splits into a create entry point that cannot express listing state and an update entry point that takes the stored machine row, decides carry-over itself, and returns the abandonment alongside the columns so a caller cannot apply one without the other. The hourly reconcile pass deletes rows whose entry has disappeared from the synced lineup.

**Tech Stack:** Next.js App Router (Server Actions), Drizzle ORM, Postgres/Supabase, Vitest (PGlite for integration), React Server Components.

**Spec:** `docs/superpowers/specs/2026-08-09-pbm-orphaned-listing-design.md`
**Bead:** PP-l81u

## Global Constraints

- **Migrations only, never `drizzle-kit push`** (CORE-ARCH-009). Use `pnpm run db:generate` then `pnpm run db:migrate`. Main carries `0062` as of #1825, so the new migration is `0063`.
- **Worker-scoped PGlite** (CORE-TEST-001). Integration tests call `setupTestDb()` once per describe and `getTestDb()` inside tests. Never construct a PGlite instance per test.
- **No side effects inside DB transactions** (CORE-ARCH-011). Every write in this plan is local, so all of it may live inside `db.transaction`. Do not add an HTTP call, a Vault read, or a notification inside one.
- **Honest failure** (CORE-ARCH-012). A control or pass must never report an outcome it did not achieve.
- **Never reach pinballmap.com from tests** (CORE-PBM-001, CORE-TEST-006). Mock `~/lib/pinballmap/client` at its seam.
- **ts-strictest** (CORE-TS-007). No `any`, no `!` non-null assertion, no unsafe `as`.
- **Path alias `~/`** for every internal import (CORE-TS-008).
- **`pnpm run check` before every commit** (~9s). It does **not** run unit tests — run the unit suite too when a task touched testable logic.
- **`pnpm run test -- <path>` does NOT filter** in this repo — it runs all ~2100 unit tests regardless of the path. For a single file use `pnpm exec vitest run --project unit --no-color <path>`. (Found by the Task 2 implementer, 2026-08-09.)
- **Escape parens in shell paths**: `src/app/\(app\)/m/actions.ts`.
- **Heavy suites go to Bazzite.** Use the `crabbox` skill for `test:integration`; do not run E2E locally.

---

## File Structure

| File                                                            | Responsibility                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/db/schema.ts`                                       | Adds `pinballmapAbandonedListings` table + its relation.                                                                                                                                                                                                                                |
| `drizzle/0063_*.sql`                                            | Generated migration creating the table.                                                                                                                                                                                                                                                 |
| `src/lib/pinballmap/link-columns.ts`                            | Splits into `resolvePbmLinkColumnsForCreate` and `resolvePbmLinkColumnsForUpdate`; the update variant owns the carry-over decision and reports abandonments.                                                                                                                            |
| `src/lib/pinballmap/abandoned-listings.ts`                      | New. Data access for abandonment rows: record inside a transaction, list for a machine, clear against a snapshot.                                                                                                                                                                       |
| `src/lib/timeline/machine-event-types.ts`                       | Adds `"abandoned"` to the `pinballmap_listing` action union.                                                                                                                                                                                                                            |
| `src/app/(app)/m/actions.ts`                                    | Both resolver call sites move to the new entry points and the 12-line carry-over block is deleted; both `db.transaction` blocks in `updateMachineAction` write the abandonment beside the machine columns. (`src/services/machines.ts` is NOT involved — see the correction at Task 3.) |
| `src/lib/mcp/tools/add-machine.ts`                              | Moves to the create entry point.                                                                                                                                                                                                                                                        |
| `src/lib/pinballmap/sync.ts`                                    | `reconcileAfterSync` clears abandonment rows absent from the synced lineup.                                                                                                                                                                                                             |
| `src/app/(app)/m/[initials]/(tabs)/page.tsx`                    | Loads a machine's abandonments and passes them to the card.                                                                                                                                                                                                                             |
| `src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.tsx` | Renders a line naming what is still on the public map.                                                                                                                                                                                                                                  |

---

### Task 1: Abandoned-listings table and migration

**Files:**

- Modify: `src/server/db/schema.ts` (add table after `pinballmapCatalog`, near line 268)
- Create: `drizzle/0063_*.sql` (generated — do not hand-write)
- Test: `src/test/integration/pinballmap-abandoned-listings.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `pinballmapAbandonedListings` table with columns `id` (uuid pk), `machineId` (uuid, FK → `machines.id`, cascade), `lmxId` (integer, unique), `pinballmapMachineId` (integer), `createdAt` (timestamptz). Type exports `PinballmapAbandonedListing`.

- [ ] **Step 1: Add the table to the schema**

In `src/server/db/schema.ts`, after the `pinballmapCatalog` table definition:

```ts
/**
 * A PinballMap entry PinPoint walked away from (PP-l81u).
 *
 * Written when a machine that is listed on PBM has its catalog title changed:
 * the entry for the OLD title is still live on pinballmap.com, and `lmxId` is
 * the only handle for finding or removing it later. Discarding it — which is
 * what happened before this table existed — leaves a public listing nobody can
 * see or clean up.
 *
 * This cannot live on `machines`. `machines_pinballmap_lmx_requires_listed`
 * forbids an lmx without `pinballmap_listed`, and keeping `listed` true would
 * claim the NEW title's slot via `machines_pinballmap_listed_unique`. A machine
 * can also abandon more than one entry over time (retitle, auto-link re-lists
 * under the new title within the hour, retitle again), so a single column set
 * would overwrite the first — the same bug one level up.
 *
 * Rows are self-clearing: `reconcileAfterSync` deletes any whose `lmxId` is
 * absent from a freshly synced lineup, which is what happens once someone
 * removes the entry by hand on pinballmap.com. There is deliberately no dismiss
 * action — the record verifies itself.
 */
export const pinballmapAbandonedListings = pgTable(
  "pinballmap_abandoned_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    // PBM's location_machine_xref id — the handle for the live entry.
    lmxId: integer("lmx_id").notNull(),
    // The catalog title the entry was listed under, so the UI can name it.
    pinballmapMachineId: integer("pinballmap_machine_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // One entry can only be abandoned once. A second row for the same lmx would
    // mean two machines each believe they own the cleanup.
    lmxUnique: uniqueIndex("pinballmap_abandoned_listings_lmx_unique").on(
      t.lmxId
    ),
    machineIdx: index("idx_pinballmap_abandoned_listings_machine").on(
      t.machineId
    ),
  })
).enableRLS();
```

Then add the type export alongside the others near the bottom of the file:

```ts
export type PinballmapAbandonedListing =
  typeof pinballmapAbandonedListings.$inferSelect;
```

- [ ] **Step 2: Generate and apply the migration**

Run:

```bash
pnpm run db:generate
pnpm run db:migrate
```

Expected: a new `drizzle/0063_<name>.sql` creating `pinballmap_abandoned_listings`. Confirm the file number is `0063` — if it is `0062`, main was not synced; run `git fetch origin && git merge origin/main` first and regenerate.

Never hand-edit `drizzle/meta/*`.

- [ ] **Step 3: Regenerate the PGlite test schema**

Run:

```bash
pnpm run test:ensure-schema
```

`src/test/setup/schema.sql` is generated and not committed. Integration tests fail with `relation "auth"."users" does not exist` if this is skipped in a fresh worktree.

- [ ] **Step 4: Write the failing test**

Create `src/test/integration/pinballmap-abandoned-listings.test.ts`:

```ts
/**
 * Integration: the abandoned-listings table's own guarantees (PP-l81u).
 *
 * Behaviour that writes these rows is covered in
 * `pinballmap-retitle-abandonment.test.ts`; this file pins the constraints the
 * table itself has to enforce.
 */

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";

import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, pinballmapAbandonedListings } from "~/server/db/schema";

describe("pinballmap_abandoned_listings", () => {
  setupTestDb();

  it("cascades when the machine is deleted", async () => {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ" })
      .returning();

    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
    });

    await db.delete(machines).where(eq(machines.id, machine.id));

    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(0);
  });

  it("refuses a second row for the same lmx", async () => {
    const db = await getTestDb();
    const [a] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ2" })
      .returning();
    const [b] = await db
      .insert(machines)
      .values({ name: "Godzilla Two", initials: "GZ3" })
      .returning();

    await db.insert(pinballmapAbandonedListings).values({
      machineId: a.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
    });

    await expect(
      db.insert(pinballmapAbandonedListings).values({
        machineId: b.id,
        lmxId: 4471,
        pinballmapMachineId: 6221,
      })
    ).rejects.toThrow();
  });

  it("holds several abandonments for one machine", async () => {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ4" })
      .returning();

    await db.insert(pinballmapAbandonedListings).values([
      { machineId: machine.id, lmxId: 4471, pinballmapMachineId: 6221 },
      { machineId: machine.id, lmxId: 5120, pinballmapMachineId: 6222 },
    ]);

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.machineId, machine.id));
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 5: Run the test**

Run:

```bash
FORCE_MEM_PRECHECK=skip pnpm exec vitest run --project integration --no-color --max-workers=2 src/test/integration/pinballmap-abandoned-listings.test.ts
```

Expected: PASS (the table exists after step 2–3). If it fails with "relation does not exist", step 3 was skipped.

- [ ] **Step 6: Commit**

```bash
pnpm run check
git add src/server/db/schema.ts drizzle/ src/test/integration/pinballmap-abandoned-listings.test.ts
git commit -m "feat(pinballmap): table for abandoned PinballMap listings (PP-l81u)"
```

---

### Task 2: Split the resolver by intent — pure refactor, no behaviour change

**Files:**

- Modify: `src/lib/pinballmap/link-columns.ts` (whole file)
- Modify: `src/app/(app)/m/actions.ts:327` and `:736-758`
- Modify: `src/lib/mcp/tools/add-machine.ts:101-105`
- Test: `src/lib/pinballmap/link-columns.test.ts`

**Interfaces:**

- Consumes: `MachinePbmColumns` from `~/services/machines`.
- Produces:
  - `resolvePbmLinkColumnsForCreate(input: { pinballmapMachineId?: number | undefined; pinballmapExcluded?: boolean | undefined; pinballmapExcludedReason?: string | undefined }): Promise<ResolvePbmLinkResult>` where `ResolvePbmLinkResult = { ok: true; columns: MachinePbmColumns } | { ok: false; message: string }`.
  - `resolvePbmLinkColumnsForUpdate(input: <same as create>, stored: StoredPbmLinkState): Promise<ResolvePbmLinkUpdateResult>` where `StoredPbmLinkState = { pinballmapMachineId: number | null; pinballmapListed: boolean; pinballmapLmxId: number | null }` and `ResolvePbmLinkUpdateResult = { ok: true; columns: MachinePbmColumns; abandoned: AbandonedListing | null } | { ok: false; message: string }`.
  - `AbandonedListing = { lmxId: number; pinballmapMachineId: number }`.
- **In this task `abandoned` is always `null`.** Task 3 makes it real. Splitting the refactor from the behaviour change keeps each independently reviewable.

- [ ] **Step 1: Write the failing test**

Create `src/lib/pinballmap/link-columns.test.ts`:

```ts
/**
 * Unit: the two PBM link-column entry points (PP-l81u).
 *
 * The create variant cannot express listing state at all; the update variant
 * owns the carry-over decision so no caller computes it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./catalog", () => ({
  getCatalogEntry: vi.fn(),
}));

import { getCatalogEntry } from "./catalog";
import {
  resolvePbmLinkColumnsForCreate,
  resolvePbmLinkColumnsForUpdate,
} from "./link-columns";

const entry = {
  manufacturer: "Stern",
  year: 2021,
  opdbId: "G50Rd-MLeMP",
  ipdbId: 6663,
};

beforeEach(() => {
  vi.mocked(getCatalogEntry).mockResolvedValue(entry);
});

describe("resolvePbmLinkColumnsForCreate", () => {
  it("never marks a new machine as listed", async () => {
    const result = await resolvePbmLinkColumnsForCreate({
      pinballmapMachineId: 6221,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(false);
    expect(result.columns.pinballmapLmxId).toBeNull();
    expect(result.columns.pinballmapMachineId).toBe(6221);
  });
});

describe("resolvePbmLinkColumnsForUpdate", () => {
  it("carries the listing forward when the title is unchanged", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(true);
    expect(result.columns.pinballmapLmxId).toBe(4471);
  });

  it("clears the listing when the title changes", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(false);
    expect(result.columns.pinballmapLmxId).toBeNull();
  });

  it("leaves an unlisted machine unlisted on an unchanged title", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: false,
        pinballmapLmxId: null,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(false);
  });

  it("clears the listing when the machine is marked not on Pinball Map", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapExcluded: true, pinballmapExcludedReason: "Homebrew" },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapExcluded).toBe(true);
    expect(result.columns.pinballmapListed).toBe(false);
    expect(result.columns.pinballmapLmxId).toBeNull();
  });

  it("rejects a title that has left the catalog", async () => {
    vi.mocked(getCatalogEntry).mockResolvedValue(undefined);

    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 9999 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: false,
        pinballmapLmxId: null,
      }
    );

    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:

```bash
pnpm exec vitest run --project unit --no-color src/lib/pinballmap/link-columns.test.ts
```

Expected: FAIL — `resolvePbmLinkColumnsForCreate` is not exported.

- [ ] **Step 3: Rewrite `link-columns.ts`**

Replace the exported `resolvePbmLinkColumns` with the two entry points and a shared private core. Keep the existing catalog-derivation and validation logic exactly as it is — only the surface changes.

```ts
import type { MachinePbmColumns } from "~/services/machines";

import { getCatalogEntry } from "./catalog";
import { validatePbmLinkSelection } from "./linking";

/** The submitted link selection. Listing state is never part of it (PP-o355.29). */
export interface PbmLinkSelection {
  pinballmapMachineId?: number | undefined;
  pinballmapExcluded?: boolean | undefined;
  pinballmapExcludedReason?: string | undefined;
}

/** The stored machine's PBM state, read from the row — never from a request. */
export interface StoredPbmLinkState {
  pinballmapMachineId: number | null;
  pinballmapListed: boolean;
  pinballmapLmxId: number | null;
}

/** A live PinballMap entry the machine no longer claims (PP-l81u). */
export interface AbandonedListing {
  lmxId: number;
  pinballmapMachineId: number;
}

export type ResolvePbmLinkResult =
  { ok: true; columns: MachinePbmColumns } | { ok: false; message: string };

export type ResolvePbmLinkUpdateResult =
  | { ok: true; columns: MachinePbmColumns; abandoned: AbandonedListing | null }
  | { ok: false; message: string };

/**
 * Resolve PBM columns for a machine being CREATED.
 *
 * Takes no listing state, because a machine that does not exist yet cannot
 * already be on the public map. The hazard the old shared signature carried —
 * omitting listing state and silently unlisting — is removed by construction
 * here rather than by a caller remembering a rule.
 */
export async function resolvePbmLinkColumnsForCreate(
  input: PbmLinkSelection
): Promise<ResolvePbmLinkResult> {
  return resolveCore(input, {
    pinballmapMachineId: null,
    pinballmapListed: false,
    pinballmapLmxId: null,
  }).then((result) =>
    result.ok ? { ok: true, columns: result.columns } : result
  );
}

/**
 * Resolve PBM columns for a machine being UPDATED.
 *
 * Takes the STORED row and decides carry-over versus clear itself, so no caller
 * computes `linkUnchanged` independently (PP-l81u defect 1).
 *
 * Returns the columns AND any listing the machine just walked away from. The
 * abandonment is part of the return value rather than something the caller
 * works out, because a caller that applies the columns and forgets the record
 * reintroduces exactly the defect this split closes.
 */
export async function resolvePbmLinkColumnsForUpdate(
  input: PbmLinkSelection,
  stored: StoredPbmLinkState
): Promise<ResolvePbmLinkUpdateResult> {
  return resolveCore(input, stored);
}

async function resolveCore(
  input: PbmLinkSelection,
  stored: StoredPbmLinkState
): Promise<ResolvePbmLinkUpdateResult> {
  const pinballmapMachineId = input.pinballmapMachineId ?? null;
  const pinballmapExcluded = input.pinballmapExcluded ?? false;

  const validationError = validatePbmLinkSelection({
    pinballmapMachineId,
    pinballmapExcluded,
  });
  if (validationError === "both_link_and_excluded") {
    return {
      ok: false,
      message:
        "A machine can't be both linked to Pinball Map and marked as not on it.",
    };
  }
  if (validationError === "link_required") {
    return {
      ok: false,
      message:
        "Select a Pinball Map title or mark the machine as not on Pinball Map.",
    };
  }

  // Carry the stored listing only while the link target is unchanged. Every
  // other outcome — re-target, excluded, unlinked — leaves the old listing
  // meaningless for this machine.
  const linkUnchanged =
    pinballmapMachineId !== null &&
    pinballmapMachineId === stored.pinballmapMachineId;
  const keepsListing = linkUnchanged && stored.pinballmapListed;

  const empty: MachinePbmColumns = {
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    // Listing presupposes a link — only the linked branch below can set it true,
    // so every not-linked outcome unlists the machine.
    pinballmapListed: false,
    // The lmx describes a live PBM listing, so it cannot outlive one. Clearing
    // it here is also what keeps the two lmx CHECK constraints satisfiable.
    pinballmapLmxId: null,
    manufacturer: null,
    year: null,
    opdbId: null,
    ipdbId: null,
  };

  if (pinballmapExcluded) {
    return {
      ok: true,
      columns: {
        ...empty,
        pinballmapExcluded: true,
        pinballmapExcludedReason: input.pinballmapExcludedReason ?? null,
      },
      abandoned: null,
    };
  }

  if (pinballmapMachineId !== null) {
    const entry = await getCatalogEntry(pinballmapMachineId);
    if (!entry) {
      return {
        ok: false,
        message:
          "That Pinball Map title is no longer in the catalog — search again.",
      };
    }
    return {
      ok: true,
      columns: {
        ...empty,
        pinballmapMachineId,
        pinballmapListed: keepsListing,
        pinballmapLmxId: keepsListing ? stored.pinballmapLmxId : null,
        manufacturer: entry.manufacturer,
        year: entry.year,
        opdbId: entry.opdbId,
        ipdbId: entry.ipdbId,
      },
      abandoned: null,
    };
  }

  // Neither linked nor excluded (requirement off): all PBM columns stay empty.
  return { ok: true, columns: empty, abandoned: null };
}
```

- [ ] **Step 4: Move the create call sites**

In `src/app/(app)/m/actions.ts` line 327, change:

```ts
const pbm = await resolvePbmLinkColumns(validation.data);
```

to:

```ts
const pbm = await resolvePbmLinkColumnsForCreate(validation.data);
```

In `src/lib/mcp/tools/add-machine.ts` line 101, change `resolvePbmLinkColumns(` to `resolvePbmLinkColumnsForCreate(`.

Update both import statements to the new names.

- [ ] **Step 5: Move the update call site and delete the carry-over block**

In `src/app/(app)/m/actions.ts`, replace lines 733–758 (the comment block, `submittedPbmId`, `linkUnchanged`, and the spread call) with:

```ts
// `pinballmapListed` is not an input to this action at all: the edit form
// renders no control for it, `readPbmLinkFormFields` does not read it, and
// `updateMachineSchema` does not accept it (PP-o355.29). The resolver
// takes the STORED row and owns the carry-over decision, so no caller can
// unlist a machine by leaving an argument out (PP-l81u).
const pbm = await resolvePbmLinkColumnsForUpdate(validation.data, {
  pinballmapMachineId: currentMachine.pinballmapMachineId,
  pinballmapListed: currentMachine.pinballmapListed,
  pinballmapLmxId: currentMachine.pinballmapLmxId,
});
if (!pbm.ok) return err("VALIDATION", pbm.message);
pbmColumns = pbm.columns;
```

Leave the auto-link block that follows unchanged.

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run --project unit --no-color src/lib/pinballmap/link-columns.test.ts
pnpm run check
```

Expected: unit tests PASS; `check` clean with no unused-import or type errors.

- [ ] **Step 7: Run the existing PBM integration tests to prove no behaviour changed**

Run:

```bash
FORCE_MEM_PRECHECK=skip pnpm exec vitest run --project integration --no-color --max-workers=2 src/test/integration/pinballmap-auto-link-on-save.test.ts src/test/integration/pinballmap-link-capture.test.ts src/test/integration/pinballmap-outbound-write.test.ts
```

Expected: PASS. This is a pure refactor — a failure here means the carry-over semantics changed.

- [ ] **Step 8: Commit**

```bash
git add src/lib/pinballmap/link-columns.ts src/lib/pinballmap/link-columns.test.ts src/app/\(app\)/m/actions.ts src/lib/mcp/tools/add-machine.ts
git commit -m "refactor(pinballmap): split the link-column resolver by intent (PP-l81u)"
```

---

### Task 3: Record the abandonment on a retitle

> **CORRECTION — this task's code blocks below are wrong in one respect, and were implemented differently on purpose.**
>
> They call `updateMachineDetails` / `UpdateMachineDetailsArgs` in `src/services/machines.ts`. **No such function or type exists** — the plan author invented them (`rg -n "updateMachineDetails" src/ --hidden` returns nothing). `services/machines.ts` owns `createMachine`; the update logic lives inline in the **two `db.transaction` blocks inside `updateMachineAction`** in `src/app/(app)/m/actions.ts`, and both apply `...(pbmColumns ?? {})`, so both can clear `pinballmapListed`.
>
> **What was actually built:** `recordAbandonedListing` is called in both of those real transactions, immediately after each machine `UPDATE`, and `src/services/machines.ts` is untouched. The tests were written against `updateMachineAction` directly, matching the harness in `pinballmap-auto-link-on-save.test.ts` — which is what this task's own Step 1 prose says to do, contradicting its code block.
>
> Read every `updateMachineDetails({...})` call below as "the machine UPDATE inside `updateMachineAction`'s transaction". Left in place rather than rewritten so the record shows what was specified versus what shipped.
>
> Two further corrections from the Task 3 review, both applied in a fix round:
> **`onConflictDoNothing` on `lmxId` became `onConflictDoUpdate`** — a no-op silently leaves an orphan attributed to a machine that no longer has any relationship to it, while the machine that actually caused it shows nothing. And **"marked not on Pinball Map" DOES record an abandonment**, contrary to what a reviewer constraint originally stated: the entry stays live on pinballmap.com no matter how PinPoint reclassifies the machine.

**Files:**

- Create: `src/lib/pinballmap/abandoned-listings.ts`
- Modify: `src/lib/pinballmap/link-columns.ts` (populate `abandoned`)
- Modify: `src/lib/timeline/machine-event-types.ts:46` and `src/lib/timeline/format-machine-event.ts`
- Modify: `src/app/(app)/m/actions.ts` — call `recordAbandonedListing` in **both** transaction blocks (NOT `src/services/machines.ts`, see the correction above)
- Test: `src/test/integration/pinballmap-retitle-abandonment.test.ts`, plus abandonment cases in `src/lib/pinballmap/link-columns.test.ts`

**Interfaces:**

- Consumes: `AbandonedListing`, `resolvePbmLinkColumnsForUpdate` (Task 2); `pinballmapAbandonedListings` (Task 1).
- Produces: `recordAbandonedListing(tx: DbTransaction, machineId: string, abandoned: AbandonedListing, actorId?: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `src/test/integration/pinballmap-retitle-abandonment.test.ts`. Follow the seeding style of `src/test/integration/pinballmap-auto-link-on-save.test.ts` — read that file first for how it seeds a catalog entry and calls `updateMachineAction` directly.

```ts
/**
 * Integration: retitling a listed machine records the listing it abandoned
 * (PP-l81u).
 *
 * The old title's entry stays live on pinballmap.com, and `lmxId` is the only
 * handle for it. Before this, the retitle discarded it silently.
 */

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";

import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  pinballmapCatalog,
  pinballmapAbandonedListings,
} from "~/server/db/schema";
import { updateMachineDetails } from "~/services/machines";
import { resolvePbmLinkColumnsForUpdate } from "~/lib/pinballmap/link-columns";

async function seedCatalog(db: Awaited<ReturnType<typeof getTestDb>>) {
  await db.insert(pinballmapCatalog).values([
    {
      pinballmapMachineId: 6221,
      name: "Godzilla (Pro)",
      manufacturer: "Stern",
      year: 2021,
    },
    {
      pinballmapMachineId: 6222,
      name: "Godzilla (Premium)",
      manufacturer: "Stern",
      year: 2021,
    },
    {
      pinballmapMachineId: 6223,
      name: "Godzilla (LE)",
      manufacturer: "Stern",
      year: 2021,
    },
  ]);
}

describe("retitling a listed machine", () => {
  setupTestDb();

  it("records exactly one abandonment, with the old title and lmx", async () => {
    const db = await getTestDb();
    await seedCatalog(db);
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      })
      .returning();

    const pbm = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      {
        pinballmapMachineId: machine.pinballmapMachineId,
        pinballmapListed: machine.pinballmapListed,
        pinballmapLmxId: machine.pinballmapLmxId,
      }
    );
    expect(pbm.ok).toBe(true);
    if (!pbm.ok) return;
    expect(pbm.abandoned).toEqual({ lmxId: 4471, pinballmapMachineId: 6221 });

    await updateMachineDetails({
      id: machine.id,
      pbmColumns: pbm.columns,
      abandonedListing: pbm.abandoned,
    });

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].lmxId).toBe(4471);
    expect(rows[0].pinballmapMachineId).toBe(6221);

    const [after] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, machine.id));
    expect(after.pinballmapMachineId).toBe(6222);
    expect(after.pinballmapListed).toBe(false);
    expect(after.pinballmapLmxId).toBeNull();
  });

  it("records a second abandonment without losing the first", async () => {
    const db = await getTestDb();
    await seedCatalog(db);
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ2",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      })
      .returning();

    const first = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );
    if (!first.ok) throw new Error("first resolve failed");
    await updateMachineDetails({
      id: machine.id,
      pbmColumns: first.columns,
      abandonedListing: first.abandoned,
    });

    // Auto-link re-lists the machine under the new title within the hour — no
    // credentials involved, which is why this sequence is reachable at all.
    await db
      .update(machines)
      .set({ pinballmapListed: true, pinballmapLmxId: 5120 })
      .where(eq(machines.id, machine.id));

    const second = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6223 },
      {
        pinballmapMachineId: 6222,
        pinballmapListed: true,
        pinballmapLmxId: 5120,
      }
    );
    if (!second.ok) throw new Error("second resolve failed");
    await updateMachineDetails({
      id: machine.id,
      pbmColumns: second.columns,
      abandonedListing: second.abandoned,
    });

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.machineId, machine.id));
    expect(rows.map((r) => r.lmxId).sort()).toEqual([4471, 5120]);
  });

  it("records nothing when the machine was not listed", async () => {
    const db = await getTestDb();
    await seedCatalog(db);
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ3",
        pinballmapMachineId: 6221,
        pinballmapListed: false,
      })
      .returning();

    const pbm = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: false,
        pinballmapLmxId: null,
      }
    );
    if (!pbm.ok) throw new Error("resolve failed");
    expect(pbm.abandoned).toBeNull();

    await updateMachineDetails({
      id: machine.id,
      pbmColumns: pbm.columns,
      abandonedListing: pbm.abandoned,
    });

    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(0);
  });

  it("records nothing when the title is unchanged", async () => {
    const db = await getTestDb();
    await seedCatalog(db);
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ4",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      })
      .returning();

    const pbm = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );
    if (!pbm.ok) throw new Error("resolve failed");
    expect(pbm.abandoned).toBeNull();

    await updateMachineDetails({
      id: machine.id,
      name: "Godzilla Renamed",
      pbmColumns: pbm.columns,
      abandonedListing: pbm.abandoned,
    });

    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(0);

    const [after] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, machine.id));
    expect(after.pinballmapListed).toBe(true);
    expect(after.pinballmapLmxId).toBe(4471);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:

```bash
FORCE_MEM_PRECHECK=skip pnpm exec vitest run --project integration --no-color --max-workers=2 src/test/integration/pinballmap-retitle-abandonment.test.ts
```

Expected: FAIL — `abandonedListing` is not a property of `UpdateMachineDetailsArgs`, and `pbm.abandoned` is always null.

- [ ] **Step 3: Populate `abandoned` in the resolver**

In `src/lib/pinballmap/link-columns.ts`, inside `resolveCore`, compute the abandonment once, above the `empty` literal:

```ts
// The stored listing survives only when the link target is unchanged. Every
// other outcome leaves a LIVE entry on pinballmap.com that this machine no
// longer claims — that is the thing to write down, not discard (PP-l81u).
const abandoned: AbandonedListing | null =
  !keepsListing &&
  stored.pinballmapListed &&
  stored.pinballmapLmxId !== null &&
  stored.pinballmapMachineId !== null
    ? {
        lmxId: stored.pinballmapLmxId,
        pinballmapMachineId: stored.pinballmapMachineId,
      }
    : null;
```

Then replace all three `abandoned: null` occurrences in the return statements with `abandoned`.

- [ ] **Step 4: Add the timeline action**

In `src/lib/timeline/machine-event-types.ts` line 46, change:

```ts
action: "listed" | "unlisted" | "linked" | "reconnected";
```

to:

```ts
action: "listed" | "unlisted" | "linked" | "reconnected" | "abandoned";
```

Update the comment above it so `abandoned` is explained:

```ts
// `abandoned` is a retitle walking away from a live entry (PP-l81u): the entry
// stays on PBM and `lmxId` is the handle recorded for it. Unlike `unlisted`,
// nothing was written to PinballMap.
```

Then add the copy for it in `src/lib/timeline/format-machine-event.ts` and an icon in `src/lib/timeline/machine-event-icons.ts`, following the existing `unlisted` entries in each file. Read both files first — the switch statements there are exhaustive, so `pnpm run check` fails until both are handled.

- [ ] **Step 5: Create the data-access module**

Create `src/lib/pinballmap/abandoned-listings.ts`:

```ts
import "server-only";

import { eq, inArray, notInArray } from "drizzle-orm";

import { db, type DbTransaction } from "~/server/db";
import { pinballmapAbandonedListings } from "~/server/db/schema";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import type { LocationSnapshot } from "./types";
import type { AbandonedListing } from "./link-columns";

/**
 * Write down a live PinballMap entry a machine just walked away from (PP-l81u).
 *
 * Runs in the caller's transaction so the record and the machine columns commit
 * together — a retitle that lands without its record is the bug this closes.
 * Both writes are local, so nothing here violates CORE-ARCH-011.
 *
 * `onConflictDoNothing` on the lmx: two machines cannot both own the cleanup for
 * one entry, and the one-lister index means the second machine was never the
 * lister anyway.
 */
export async function recordAbandonedListing(
  tx: DbTransaction,
  machineId: string,
  abandoned: AbandonedListing,
  actorId?: string
): Promise<void> {
  await tx
    .insert(pinballmapAbandonedListings)
    .values({
      machineId,
      lmxId: abandoned.lmxId,
      pinballmapMachineId: abandoned.pinballmapMachineId,
    })
    .onConflictDoNothing({
      target: pinballmapAbandonedListings.lmxId,
    });

  await createMachineTimelineEvent(
    machineId,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: {
        kind: "pinballmap_listing",
        action: "abandoned",
        lmxId: abandoned.lmxId,
      },
      ...(actorId === undefined ? {} : { actorId }),
    },
    tx
  );
}

/** Every entry this machine has abandoned and nobody has removed yet. */
export async function listAbandonedForMachine(
  machineId: string
): Promise<{ lmxId: number; pinballmapMachineId: number }[]> {
  const rows = await db
    .select({
      lmxId: pinballmapAbandonedListings.lmxId,
      pinballmapMachineId: pinballmapAbandonedListings.pinballmapMachineId,
    })
    .from(pinballmapAbandonedListings)
    .where(eq(pinballmapAbandonedListings.machineId, machineId));
  return rows;
}

/**
 * Drop records whose entry is no longer on the lineup — someone removed it by
 * hand on pinballmap.com, which is the only cleanup path this bead ships.
 *
 * MUST only be called with a freshly synced snapshot. Callers reach this via
 * `reconcileAfterSync`, which both call sites gate on a successful sync; a
 * failed fetch yields a stale lineup, and treating absence there as "cleaned up"
 * would wipe every record and report cleanup nobody performed (CORE-ARCH-012).
 *
 * Returns how many were cleared.
 */
export async function clearResolvedAbandonments(
  snapshot: LocationSnapshot
): Promise<number> {
  const liveLmxIds = snapshot.lmxes.map((l) => l.id);

  // An empty lineup is a legitimate state (a location with nothing listed), so
  // `notInArray` against an empty list is not usable — it would clear nothing on
  // some drivers and everything on others. Branch explicitly.
  const cleared =
    liveLmxIds.length === 0
      ? await db.delete(pinballmapAbandonedListings).returning({
          id: pinballmapAbandonedListings.id,
        })
      : await db
          .delete(pinballmapAbandonedListings)
          .where(notInArray(pinballmapAbandonedListings.lmxId, liveLmxIds))
          .returning({ id: pinballmapAbandonedListings.id });

  return cleared.length;
}
```

Note: `inArray` is imported for symmetry with existing modules but is unused — remove it if `pnpm run check` flags it.

- [ ] **Step 6: Thread it through the service**

In `src/services/machines.ts`, add to `UpdateMachineDetailsArgs` beside `pbmColumns` (near line 207):

```ts
  /**
   * A live PinballMap entry this update walks away from (PP-l81u). Written in
   * the same transaction as the columns — a retitle whose record does not land
   * leaves a public listing nobody can find.
   */
  abandonedListing?: AbandonedListing | null | undefined;
```

Import the type: `import type { AbandonedListing } from "~/lib/pinballmap/link-columns";`

Inside the update transaction, after the machine `UPDATE` statement, add:

```ts
if (abandonedListing) {
  await recordAbandonedListing(tx, id, abandonedListing, actorId);
}
```

Destructure `abandonedListing` from the args alongside `pbmColumns`. Use whatever the surrounding code already calls the actor id; if there is no actor in scope, omit the fourth argument.

- [ ] **Step 7: Pass it from the action**

In `src/app/(app)/m/actions.ts`, the update path already has `pbm.abandoned` in scope from Task 2. Hold it in a variable beside `pbmColumns`:

```ts
pbmColumns = pbm.columns;
abandonedListing = pbm.abandoned;
```

Declare `let abandonedListing: AbandonedListing | null = null;` next to the existing `pbmColumns` declaration, and pass `abandonedListing` into the `updateMachineDetails` call.

- [ ] **Step 8: Run the tests to verify they pass**

Run:

```bash
FORCE_MEM_PRECHECK=skip pnpm exec vitest run --project integration --no-color --max-workers=2 src/test/integration/pinballmap-retitle-abandonment.test.ts
pnpm exec vitest run --project unit --no-color src/lib/pinballmap/link-columns.test.ts
pnpm run check
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/pinballmap/ src/lib/timeline/ src/services/machines.ts src/app/\(app\)/m/actions.ts src/test/integration/pinballmap-retitle-abandonment.test.ts
git commit -m "feat(pinballmap): record the listing a retitle walks away from (PP-l81u)"
```

---

### Task 4: Clear resolved abandonments on the reconcile pass

**Files:**

- Modify: `src/lib/pinballmap/sync.ts` (`ReconcileResult` + `reconcileAfterSync`)
- Test: `src/test/integration/pinballmap-reconcile.test.ts` (extend — do not create a new file)

**Interfaces:**

- Consumes: `clearResolvedAbandonments(snapshot)` (Task 3).
- Produces: `ReconcileResult` gains `abandonmentsCleared: number`.

- [ ] **Step 1: Write the failing test**

Append to `src/test/integration/pinballmap-reconcile.test.ts`.

**There is no `seedState` helper in this file** — each test inserts the singleton inline. The two helpers that DO exist are `snapshotWith(rows: { id: number; machineId: number }[]): LocationSnapshot` (defined at the top of the file) and `createTestMachine({ initials, name, pinballmapMachineId, pinballmapListed, pinballmapLmxId })` imported from `~/test/helpers/factories`. Use both, and seed the singleton inline exactly as the existing tests do. Add `pinballmapAbandonedListings` to the schema import on line 22.

```ts
describe("abandoned listings", () => {
  it("clears a record once its entry is gone from the lineup", async () => {
    const db = await getTestDb();
    const machine = createTestMachine({
      initials: "GZA",
      name: "Godzilla",
      pinballmapMachineId: 6222,
    });
    await db.insert(machines).values(machine);
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
    });

    // The synced lineup no longer carries 4471 — someone removed it by hand.
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: true,
      snapshotJson: snapshotWith([{ id: 5120, machineId: 6222 }]),
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result.abandonmentsCleared).toBe(1);
    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(0);
  });

  it("keeps a record while its entry is still on the lineup", async () => {
    const db = await getTestDb();
    const machine = createTestMachine({
      initials: "GZB",
      name: "Godzilla",
      pinballmapMachineId: 6222,
    });
    await db.insert(machines).values(machine);
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
    });

    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: true,
      snapshotJson: snapshotWith([
        { id: 4471, machineId: 6221 },
        { id: 5120, machineId: 6222 },
      ]),
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result.abandonmentsCleared).toBe(0);
    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(1);
  });

  it("clears nothing when there is no stored snapshot", async () => {
    // `reconcileAfterSync` returns early without a snapshot, which is what keeps
    // a failed sync from wiping every record: `syncLocationSnapshot` never
    // overwrites `snapshotJson` on its error path, and both callers gate on a
    // successful result. Absence must never read as "cleaned up".
    const db = await getTestDb();
    const machine = createTestMachine({
      initials: "GZC",
      name: "Godzilla",
      pinballmapMachineId: 6222,
    });
    await db.insert(machines).values(machine);
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
    });

    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: true,
      snapshotJson: null,
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result.abandonmentsCleared).toBe(0);
    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(1);
  });
});
```

Each test in this file seeds its own `pinballmapState` singleton, so these must run against a clean table — follow whatever isolation the surrounding `describe` blocks already use rather than assuming.

- [ ] **Step 2: Run it to verify it fails**

Run:

```bash
FORCE_MEM_PRECHECK=skip pnpm exec vitest run --project integration --no-color --max-workers=2 src/test/integration/pinballmap-reconcile.test.ts
```

Expected: FAIL — `abandonmentsCleared` is not on `ReconcileResult`.

- [ ] **Step 3: Add the field and the call**

In `src/lib/pinballmap/sync.ts`, add `abandonmentsCleared: number` to `ReconcileResult`, and return `abandonmentsCleared: 0` from both existing early returns (the `!state?.enabled` guard and the `!snapshot` guard at lines 175–177).

At the end of `reconcileAfterSync`, after the existing write loop and before the final return, add:

```ts
// Someone removed the entry by hand on pinballmap.com — the only cleanup path
// this bead ships. Safe here because we only ever run on a freshly synced
// snapshot: both callers return early unless the sync succeeded, and a failed
// sync leaves `snapshotJson` untouched rather than emptying it.
const abandonmentsCleared = await clearResolvedAbandonments(snapshot);
```

Include `abandonmentsCleared` in the returned object. Import `clearResolvedAbandonments` from `./abandoned-listings`.

- [ ] **Step 4: Surface it in the two callers' logs**

In `src/app/api/cron/pinballmap-sync/route.ts` line 54, destructure `abandonmentsCleared` and add it to both the `log.info` payload and the JSON response, alongside `healed` / `linked` / `desynced`.

In `src/app/(app)/m/pinballmap-actions.ts` line 959, destructure it and include it in the `ok(...)` payload alongside `healed` and `linked`.

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
FORCE_MEM_PRECHECK=skip pnpm exec vitest run --project integration --no-color --max-workers=2 src/test/integration/pinballmap-reconcile.test.ts
pnpm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pinballmap/sync.ts src/app/api/cron/pinballmap-sync/route.ts src/app/\(app\)/m/pinballmap-actions.ts src/test/integration/pinballmap-reconcile.test.ts
git commit -m "feat(pinballmap): clear abandoned listings the map no longer carries (PP-l81u)"
```

---

### Task 5: Surface abandonments on the machine's PinballMap card

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx:111-125`
- Modify: `src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.tsx`
- Test: `src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.test.tsx` (extend)

**Interfaces:**

- Consumes: `listAbandonedForMachine(machineId)` (Task 3).
- Produces: `MachinePinballmapCardProps` gains `abandoned?: { lmxId: number; title: string }[]`.

Copy and layout beyond one line belong to PP-o355.21 and PP-o355.7.2. This task makes the state visible, nothing more.

- [ ] **Step 1: Write the failing test**

Append to `src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.test.tsx`:

```tsx
describe("abandoned listings", () => {
  it("names what is still on the public map", () => {
    render(
      <MachinePinballmapCard
        locationUrl="https://pinballmap.com/map/?by_location_id=26454"
        abandoned={[{ lmxId: 4471, title: "Godzilla (Pro)" }]}
      />
    );

    expect(
      screen.getByText(/Godzilla \(Pro\) is still on Pinball Map/i)
    ).toBeInTheDocument();
  });

  it("says nothing when there are none", () => {
    render(
      <MachinePinballmapCard
        locationUrl="https://pinballmap.com/map/?by_location_id=26454"
        abandoned={[]}
      />
    );

    expect(screen.queryByText(/still on Pinball Map/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:

```bash
pnpm exec vitest run --project unit --no-color "src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.test.tsx"
```

Expected: FAIL — `abandoned` is not a prop.

- [ ] **Step 3: Add the prop and render it**

In `machine-pinballmap-card.tsx`, extend the props interface:

```tsx
  /**
   * Entries this machine walked away from that are still live on the public map
   * (PP-l81u). Cleanup is manual on pinballmap.com in this bead; the record
   * clears itself once the hourly sync stops seeing the entry.
   */
  abandoned?: { lmxId: number; title: string }[];
```

Inside the card, after the existing desync alert, render:

```tsx
{
  abandoned && abandoned.length > 0 ? (
    <Alert>
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertDescription>
        {abandoned.map((entry) => (
          <span key={entry.lmxId} className="block">
            {entry.title} is still on Pinball Map. Remove it there — this notice
            clears itself once it is gone.
          </span>
        ))}
      </AlertDescription>
    </Alert>
  ) : null;
}
```

Destructure `abandoned` in the component signature.

- [ ] **Step 4: Load the data on the Info tab**

In `src/app/(app)/m/[initials]/(tabs)/page.tsx`, near the existing `derivePbmMachineStatus` call at line 111, add:

```tsx
const abandonedRows = await listAbandonedForMachine(machine.id);
const abandoned = await Promise.all(
  abandonedRows.map(async (row) => {
    const entry = await getCatalogEntry(row.pinballmapMachineId);
    return {
      lmxId: row.lmxId,
      // The catalog row can disappear; the entry on PBM does not. Fall back to
      // the id so the notice still names something actionable.
      title: entry?.name ?? `Pinball Map entry ${row.lmxId}`,
    };
  })
);
```

Pass `abandoned={abandoned}` to `<MachinePinballmapCard>`. Import `listAbandonedForMachine` from `~/lib/pinballmap/abandoned-listings` and `getCatalogEntry` from `~/lib/pinballmap/catalog`. (`getCatalogEntry` returns `PinballmapCatalogEntry | null`, whose display title is `name: string` — verified, the fallback above is correct as written.)

**You must also widen the card's render condition, or none of this is visible.** Immediately below, the card is built as:

```tsx
const pinballmapCard =
  machine.pinballmapListed || showDesync ? (
```

A machine that just abandoned an entry is by definition **not listed**, and `derivePbmMachineStatus` reports it as `ok` — it points at a new title and correctly has no listing under it, so `showDesync` is false too. Both halves of that condition are false exactly when an abandonment exists, so the card would not render at all and the notice would never appear. This is the failure the whole task exists to prevent, so verify it end to end rather than trusting the prop wiring.

Add a third disjunct so the card renders when there is something abandoned to report. Gate it the same way the desync alert is gated — on `canLink` — because an abandoned entry is a maintainer's concern and follows the same "surfaced where it can be acted on" rule that the comment above `pbmStatus` already states. Something of this shape:

```tsx
const showAbandoned = canLink && abandoned.length > 0;
const pinballmapCard =
  machine.pinballmapListed || showDesync || showAbandoned ? (
```

Read the surrounding block before editing — the comment above `pbmStatus` explains the existing gating and should be extended to cover this third case rather than left describing only two.

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run --project unit --no-color "src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.test.tsx"
pnpm run check
```

Expected: PASS.

- [ ] **Step 6: Run the full PBM integration set**

Use the `crabbox` skill to run this on Bazzite rather than locally:

```bash
pnpm run test:integration
```

Expected: PASS, including every pre-existing PinballMap test.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/m/\[initials\]/\(tabs\)/
git commit -m "feat(pinballmap): show entries a retitle left on the public map (PP-l81u)"
```

---

## Verification before handoff

- [ ] `pnpm run preflight` — this touches a migration and a server action, so preflight is required, not `check`.
- [ ] Screenshots: Task 5 changes `src/app/**`, so `node scripts/workflow/pr-screenshots.mjs <PR>` must run before the PR is called ready.
- [ ] Confirm the migration applied cleanly against a reset local DB: `pnpm run db:reset && pnpm run db:migrate`. Never `db:reset` against production.

## Self-review notes

Checked against the spec:

- Spec decisions 1 and 2 (unsynced legal, retitle never blocked) need no code — nothing in this plan adds a block, and Task 3's tests assert the retitle succeeds.
- Spec decision 6's "only a successful sync may clear" turned out to hold already: both `reconcileAfterSync` callers gate on `result.ok`, and `syncLocationSnapshot` leaves `snapshotJson` untouched on error. Task 4 step 1's third test pins that rather than adding a redundant guard.
- The spec's "abandonment and machine columns commit atomically" is structural — `recordAbandonedListing` takes the caller's `tx`. No separate test earns its place beyond the Task 3 cases, which would fail if the insert were outside the transaction and the update rolled back.
