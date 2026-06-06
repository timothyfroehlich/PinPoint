# Multi-Machine Collection View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of the collection view (PP-slrd.1): `/c/owner/[userId]` with Overview (sortable status table), Issues (scoped reuse of the issues list), and Timeline (combined read-only feed) tabs.

**Architecture:** A collection resolver turns "owner X" into a list of machines; every aggregate query takes machine identifier lists, never an owner. The route mirrors `/m/[initials]/(tabs)` (layout + cached query + header + tab strip). Existing components are reused: `IssueList`/`IssueFilters` for the Issues tab, `MachineTimeline*Row` for the Timeline tab (extended with an opt-in machine-attribution prop that per-machine pages never set).

**Tech Stack:** Next.js App Router (RSC), Drizzle, shadcn/ui, Vitest (`unit` + `integration` projects, worker-scoped PGlite), Playwright smoke.

**Spec:** `docs/superpowers/specs/2026-06-06-multi-machine-collection-view-design.md` — read it first.

**Branch/worktree:** work in this worktree on `worktree-multi-machine-view` (already pushed). PR targets `main`.

**Verification commands** (used throughout):

```bash
pnpm run check                                   # fast: types, lint, format, unit (~12s)
pnpm exec vitest run --project unit <file>       # one unit test file
pnpm exec vitest run --project integration <file># one integration test file
```

**Hard constraints from the spec — re-read before each UI task:**

1. Per-machine pages (`/m/...`) must be **visually unchanged**. All new behavior is opt-in via props/new routes. Existing tests must pass unmodified.
2. No new permission gate — the pages check nothing beyond what `/m` checks (render for everyone; data is already public there).
3. No emails anywhere on collection pages (CORE-SEC-007).
4. Timeline grouping stays a presentational pass over fetched rows (PP-ynff lands later as an alternate grouping strategy).

---

## Key reuse facts (from research — verified 2026-06-06)

| Fact                                                                                                                                   | Where                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `getMachineTimeline(tx: DbTransaction, args)` — args `{ machineId: string; tags?; limit?; offset? }`; rows already include `machineId` | `src/lib/timeline/machine-events.ts:214-322`                                                        |
| `DbTransaction` type                                                                                                                   | `import { db, type DbTransaction } from "~/server/db"`                                              |
| Issues filter already supports `machine: string[]` (initials) via `inArray(issues.machineInitials, ...)`                               | `src/lib/issues/filters-queries.ts:189-191`                                                         |
| `IssueList` is fully props-driven (no internal fetch)                                                                                  | `src/components/issues/IssueList.tsx:74-81`                                                         |
| `useTableResponsiveColumns(columns, baseWidth, baseBuffer)` → `{ visibleColumns, containerRef }`; lower `priority` hides first         | `src/hooks/use-table-responsive-columns.ts:38-42`                                                   |
| `deriveMachineStatus(issues)` + `IssueForStatus`                                                                                       | `src/lib/machines/status.ts:6-35`                                                                   |
| `MachineStatusBadge`/`MachinePresenceBadge` (`status`, `size`)                                                                         | `src/components/machines/MachineStatusBadge.tsx`, `MachinePresenceBadge.tsx`                        |
| Layout pattern to mirror: `cache()`-wrapped query + header + tab strip                                                                 | `src/app/(app)/m/[initials]/(tabs)/layout.tsx`, `src/app/(app)/m/[initials]/_data.ts`               |
| Tab strip to model: route-driven, `aria-current="page"`, count badge                                                                   | `src/components/machines/MachineTabStrip.tsx`                                                       |
| Timeline page to adapt (param parsing, bucketing, row dispatch, pagination)                                                            | `src/app/(app)/m/[initials]/(tabs)/timeline/page.tsx`                                               |
| `MultiSelect` props: `{ options, value, onChange, placeholder, ariaLabel, ... }`; `Option` has `badgeLabel` for initials chips         | `src/components/ui/multi-select.tsx:85-98`                                                          |
| Ticking relative time                                                                                                                  | `import { RelativeTime } from "~/components/issues/RelativeTime"` — `<RelativeTime value={date} />` |
| Tag → label                                                                                                                            | `getTagLabel(tag)` in `src/lib/timeline/machine-tags.ts`                                            |
| PGlite test setup: `setupTestDb()` + `getTestDb()`; integration tests in `src/test/integration/`                                       | `src/test/setup/pglite.ts`                                                                          |
| RTL `next/navigation` mocking pattern                                                                                                  | `src/components/machines/timeline/MachineTimelineFilter.test.tsx:1-35`                              |
| Smoke E2E: `ensureLoggedIn(page, testInfo)`, specs in `e2e/smoke/`                                                                     | `e2e/smoke/machine-details-redesign.spec.ts`                                                        |

---

### Task 1: Severity helpers in `src/lib/machines/status.ts`

The Overview table needs "worst open severity" per machine and severity/status ranks for sorting.

**Files:**

- Modify: `src/lib/machines/status.ts`
- Test: `src/lib/machines/status.test.ts` (extend if it exists — check with `ls src/lib/machines/`; create if not)

- [ ] **Step 1: Write the failing test**

Append to (or create) `src/lib/machines/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  worstOpenSeverity,
  SEVERITY_RANK,
  MACHINE_STATUS_RANK,
} from "./status";

describe("worstOpenSeverity", () => {
  it("returns null when there are no open issues", () => {
    expect(worstOpenSeverity([])).toBeNull();
    expect(
      worstOpenSeverity([{ status: "fixed", severity: "unplayable" }])
    ).toBeNull();
  });

  it("returns the highest-ranked severity among open issues only", () => {
    expect(
      worstOpenSeverity([
        { status: "new", severity: "minor" },
        { status: "confirmed", severity: "major" },
        { status: "fixed", severity: "unplayable" }, // closed — ignored
      ])
    ).toBe("major");
  });

  it("ranks severities cosmetic < minor < major < unplayable", () => {
    expect(SEVERITY_RANK.cosmetic).toBeLessThan(SEVERITY_RANK.minor);
    expect(SEVERITY_RANK.minor).toBeLessThan(SEVERITY_RANK.major);
    expect(SEVERITY_RANK.major).toBeLessThan(SEVERITY_RANK.unplayable);
  });

  it("ranks machine statuses operational < needs_service < unplayable", () => {
    expect(MACHINE_STATUS_RANK.operational).toBeLessThan(
      MACHINE_STATUS_RANK.needs_service
    );
    expect(MACHINE_STATUS_RANK.needs_service).toBeLessThan(
      MACHINE_STATUS_RANK.unplayable
    );
  });
});
```

If the test file already exists, keep its existing imports/tests and add this describe block.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project unit src/lib/machines/status.test.ts`
Expected: FAIL — `worstOpenSeverity` is not exported.

- [ ] **Step 3: Implement in `src/lib/machines/status.ts`**

Add below `deriveMachineStatus` (reuse the existing `IssueForStatus` interface and the existing `CLOSED_STATUSES` import already present in this file):

```ts
/** Sort rank for issue severities — higher is worse. */
export const SEVERITY_RANK: Record<IssueSeverity, number> = {
  cosmetic: 0,
  minor: 1,
  major: 2,
  unplayable: 3,
};

/** Sort rank for derived machine statuses — higher is worse. */
export const MACHINE_STATUS_RANK: Record<MachineStatus, number> = {
  operational: 0,
  needs_service: 1,
  unplayable: 2,
};

/**
 * The highest-ranked severity among a machine's OPEN issues, or null when
 * nothing is open. Closed issues never count (mirrors deriveMachineStatus).
 */
export function worstOpenSeverity(
  issues: IssueForStatus[]
): IssueSeverity | null {
  let worst: IssueSeverity | null = null;
  for (const issue of issues) {
    if ((CLOSED_STATUSES as readonly string[]).includes(issue.status)) continue;
    if (
      worst === null ||
      SEVERITY_RANK[issue.severity] > SEVERITY_RANK[worst]
    ) {
      worst = issue.severity;
    }
  }
  return worst;
}
```

`IssueSeverity` may already be imported in this file; if not, import the type from the same module the file already uses for `IssueStatus` (check the top of the file — `~/lib/types` or `~/lib/issues/status`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project unit src/lib/machines/status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/machines/status.ts src/lib/machines/status.test.ts
git commit -m "feat(machines): worstOpenSeverity + severity/status sort ranks (PP-slrd.1)"
```

---

### Task 2: Owner-collection resolver + summary

The seam: resolve "owner X" → machines (with open issues), and summarize for the header.

**Files:**

- Create: `src/lib/collections/owner.ts`
- Create: `src/lib/collections/summary.ts`
- Test: `src/lib/collections/summary.test.ts` (unit)
- Test: `src/test/integration/collections-owner.test.ts` (PGlite)

- [ ] **Step 1: Write the failing unit test for the summary**

Create `src/lib/collections/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeCollection } from "./summary";
import type { CollectionMachine } from "./owner";

function machine(
  issues: CollectionMachine["issues"],
  presence: CollectionMachine["presenceStatus"] = "on_the_floor"
): CollectionMachine {
  return {
    id: crypto.randomUUID(),
    initials: "XX",
    name: "Test Machine",
    presenceStatus: presence,
    issues,
  };
}

describe("summarizeCollection", () => {
  it("counts machines by derived status and sums open issues", () => {
    const summary = summarizeCollection([
      machine([]), // operational
      machine([{ status: "new", severity: "major" }]), // needs_service
      machine([
        { status: "new", severity: "unplayable" },
        { status: "confirmed", severity: "minor" },
      ]), // unplayable, 2 open
    ]);
    expect(summary).toEqual({
      total: 3,
      operational: 1,
      needsService: 1,
      unplayable: 1,
      openIssues: 3,
    });
  });

  it("handles the empty collection", () => {
    expect(summarizeCollection([])).toEqual({
      total: 0,
      operational: 0,
      needsService: 0,
      unplayable: 0,
      openIssues: 0,
    });
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm exec vitest run --project unit src/lib/collections/summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/collections/owner.ts`**

```ts
import { asc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DbTransaction } from "~/server/db";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { IssueSeverity, IssueStatus } from "~/lib/types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

// Verify these type import paths before relying on them:
//   rg -n "export type IssueSeverity|export type IssueStatus" src/lib
//   rg -n "export type MachinePresenceStatus" src/lib
// Use whatever module the schema/status helpers already import from.

/** One machine in a resolved collection. `issues` contains OPEN issues only. */
export interface CollectionMachine {
  id: string;
  initials: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  issues: { status: IssueStatus; severity: IssueSeverity }[];
}

export interface OwnerCollection {
  owner: { id: string; name: string };
  machines: CollectionMachine[];
}

const uuidSchema = z.string().uuid();

/**
 * Resolve an owner-type collection: the machines owned by `userId`.
 *
 * This is the v1 collection resolver (spec §Architecture). Downstream
 * aggregate queries take the machine id/initials lists from the result —
 * never an owner id — so future collection sources (tags, ad-hoc sets)
 * only need a new resolver.
 *
 * Returns null when the user id is malformed or no such user exists.
 */
export async function getOwnerCollection(
  tx: DbTransaction = db,
  userId: string
): Promise<OwnerCollection | null> {
  if (!uuidSchema.safeParse(userId).success) return null;

  const owner = await tx.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { id: true, name: true },
  });
  if (!owner) return null;

  const machineRows = await tx.query.machines.findMany({
    where: eq(machines.ownerId, userId),
    columns: { id: true, initials: true, name: true, presenceStatus: true },
    with: {
      issues: {
        where: notInArray(issues.status, [...CLOSED_STATUSES]),
        columns: { status: true, severity: true },
      },
    },
    orderBy: [asc(machines.name)],
  });

  return { owner, machines: machineRows };
}
```

- [ ] **Step 4: Create `src/lib/collections/summary.ts`**

```ts
import { deriveMachineStatus } from "~/lib/machines/status";
import type { CollectionMachine } from "./owner";

export interface CollectionSummary {
  total: number;
  operational: number;
  needsService: number;
  unplayable: number;
  openIssues: number;
}

/** Header counts for a collection. `machines[].issues` must be open-only. */
export function summarizeCollection(
  machines: CollectionMachine[]
): CollectionSummary {
  const summary: CollectionSummary = {
    total: machines.length,
    operational: 0,
    needsService: 0,
    unplayable: 0,
    openIssues: 0,
  };
  for (const machine of machines) {
    summary.openIssues += machine.issues.length;
    const status = deriveMachineStatus(machine.issues);
    if (status === "unplayable") summary.unplayable += 1;
    else if (status === "needs_service") summary.needsService += 1;
    else summary.operational += 1;
  }
  return summary;
}
```

- [ ] **Step 5: Run the unit test**

Run: `pnpm exec vitest run --project unit src/lib/collections/summary.test.ts`
Expected: PASS. Also run `pnpm run check` — fix any strictness fallout (e.g. wrong type-import paths flagged in the comment in Step 3).

- [ ] **Step 6: Write the failing integration test**

Create `src/test/integration/collections-owner.test.ts`. Mirror the seeding style of the existing timeline integration tests (open `src/test/integration/` and copy the `authUsers` + `userProfiles` insert helper from any `machine-timeline-*.test.ts` file — the `makeUser` pattern quoted below is the established one):

```ts
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { authUsers, machines, issues, userProfiles } from "~/server/db/schema";
import { getOwnerCollection } from "~/lib/collections/owner";

describe("getOwnerCollection", () => {
  setupTestDb();

  async function makeUser(firstName = "Test", lastName = "Owner") {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName,
        lastName,
        role: "member",
      })
      .returning();
    if (!user) throw new Error("seed failed");
    return user;
  }

  async function makeMachine(
    initials: string,
    name: string,
    ownerId: string | null
  ) {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ initials, name, ownerId })
      .returning();
    if (!machine) throw new Error("seed failed");
    return machine;
  }

  it("returns the owner's machines with open issues only, sorted by name", async () => {
    const db = await getTestDb();
    const owner = await makeUser("Alice", "Owner");
    const other = await makeUser("Bob", "Other");
    const m1 = await makeMachine("ZZ", "Zeta", owner.id);
    const m2 = await makeMachine("AA", "Alpha", owner.id);
    await makeMachine("BB", "NotMine", other.id);

    await db.insert(issues).values([
      {
        machineInitials: m1.initials,
        issueNumber: 1,
        title: "open one",
        status: "new",
        severity: "major",
        reporterName: "Tester",
      },
      {
        machineInitials: m1.initials,
        issueNumber: 2,
        title: "closed one",
        status: "fixed",
        severity: "unplayable",
        reporterName: "Tester",
      },
    ]);

    const collection = await getOwnerCollection(db, owner.id);
    expect(collection).not.toBeNull();
    expect(collection?.owner).toEqual({ id: owner.id, name: "Alice Owner" });
    expect(collection?.machines.map((m) => m.initials)).toEqual(["AA", "ZZ"]);
    const zeta = collection?.machines.find((m) => m.initials === "ZZ");
    expect(zeta?.issues).toEqual([{ status: "new", severity: "major" }]);
    expect(m2.id).toBeTruthy();
  });

  it("returns an empty machine list for an owner with no machines", async () => {
    const db = await getTestDb();
    const owner = await makeUser();
    const collection = await getOwnerCollection(db, owner.id);
    expect(collection?.machines).toEqual([]);
  });

  it("returns null for unknown or malformed user ids", async () => {
    const db = await getTestDb();
    expect(await getOwnerCollection(db, randomUUID())).toBeNull();
    expect(await getOwnerCollection(db, "not-a-uuid")).toBeNull();
  });
});
```

Note: the `issues` insert column list above is a best guess — check the `issues` table's NOT NULL columns in `src/server/db/schema.ts:170-239` and the inserts used by existing integration tests, and adjust (e.g. `reportedBy`, `frequency` defaults).

- [ ] **Step 7: Run integration test to verify failure, then fix until green**

Run: `pnpm exec vitest run --project integration src/test/integration/collections-owner.test.ts`
Expected: initially FAIL (or error on seed column mismatch) → fix seeds → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/collections/ src/test/integration/collections-owner.test.ts
git commit -m "feat(collections): owner-collection resolver + header summary (PP-slrd.1)"
```

---

### Task 3: Latest-activity-per-machine query

Overview's "last activity" column: the newest non-deleted timeline event per machine.

**Files:**

- Create: `src/lib/collections/latest-activity.ts`
- Test: `src/test/integration/collections-latest-activity.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `src/test/integration/collections-latest-activity.test.ts` (reuse `makeUser`/`makeMachine` helpers from Task 2's test — copy them; tests must be self-contained):

```ts
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  authUsers,
  machines,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";

describe("getLatestTimelineEventPerMachine", () => {
  setupTestDb();

  // copy makeUser/makeMachine from collections-owner.test.ts

  it("returns the newest non-deleted event per machine", async () => {
    const db = await getTestDb();
    const owner = await makeUser();
    const m1 = await makeMachine("AA", "Alpha", owner.id);
    const m2 = await makeMachine("BB", "Beta", owner.id);

    const old = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-02-01T00:00:00Z");
    const newest = new Date("2026-03-01T00:00:00Z");

    await db.insert(timelineEvents).values([
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: old,
      },
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "maintenance",
        eventData: { kind: "machine_added" },
        createdAt: newer,
      },
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "cleaning",
        eventData: { kind: "machine_added" },
        createdAt: newest,
        deletedAt: new Date(), // deleted — must be skipped
        deletedBy: owner.id,
      },
      {
        machineId: m2.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: old,
      },
    ]);

    const latest = await getLatestTimelineEventPerMachine(db, [m1.id, m2.id]);
    expect(latest.get(m1.id)?.tag).toBe("maintenance");
    expect(latest.get(m1.id)?.createdAt).toEqual(newer);
    expect(latest.get(m2.id)?.tag).toBe("lifecycle");
  });

  it("returns an empty map for machines with no events and for empty input", async () => {
    const db = await getTestDb();
    const owner = await makeUser();
    const m1 = await makeMachine("CC", "Gamma", owner.id);
    expect((await getLatestTimelineEventPerMachine(db, [m1.id])).size).toBe(0);
    expect((await getLatestTimelineEventPerMachine(db, [])).size).toBe(0);
  });
});
```

Notes for the implementer:

- Check `timelineEvents` NOT NULL columns and the exact `eventData` union (`src/server/db/schema.ts:336-377`, `src/lib/timeline/machine-events.ts`) and adjust the seed values until they satisfy the schema (e.g. `sequence` may need explicit values, the soft-delete column may be `deletedById` — match the schema exactly).
- The tags used (`maintenance`, `cleaning`) must be valid `timelineEvents.tag` enum values — they are (see `machine-tags.ts`).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run --project integration src/test/integration/collections-latest-activity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/collections/latest-activity.ts`**

```ts
import { and, desc, inArray, isNull } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { timelineEvents } from "~/server/db/schema";
import type { TimelineTag } from "~/lib/timeline/machine-tags";

export interface LatestActivity {
  createdAt: Date;
  tag: TimelineTag;
}

/**
 * Newest non-deleted timeline event per machine, for the Overview
 * "last activity" column. One DISTINCT ON query — not N per machine.
 */
export async function getLatestTimelineEventPerMachine(
  tx: DbTransaction = db,
  machineIds: string[]
): Promise<Map<string, LatestActivity>> {
  if (machineIds.length === 0) return new Map();

  const rows = await tx
    .selectDistinctOn([timelineEvents.machineId], {
      machineId: timelineEvents.machineId,
      createdAt: timelineEvents.createdAt,
      tag: timelineEvents.tag,
    })
    .from(timelineEvents)
    .where(
      and(
        inArray(timelineEvents.machineId, machineIds),
        isNull(timelineEvents.deletedAt)
      )
    )
    .orderBy(
      timelineEvents.machineId,
      desc(timelineEvents.createdAt),
      desc(timelineEvents.sequence)
    );

  const map = new Map<string, LatestActivity>();
  for (const row of rows) {
    if (row.machineId !== null) {
      map.set(row.machineId, { createdAt: row.createdAt, tag: row.tag });
    }
  }
  return map;
}
```

If `DbTransaction` doesn't expose `selectDistinctOn` (transaction-narrowed type), fall back to a plain select ordered by `(machineId, createdAt desc, sequence desc)` and keep the first row per machine while building the map — same result, still one query.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run --project integration src/test/integration/collections-latest-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/latest-activity.ts src/test/integration/collections-latest-activity.test.ts
git commit -m "feat(collections): latest timeline event per machine query (PP-slrd.1)"
```

---

### Task 4: Widen `getMachineTimeline` to accept a machine-id list

**Files:**

- Modify: `src/lib/timeline/machine-events.ts` (args interface ~line 214, WHERE ~lines 305-312)
- Test: `src/test/integration/machine-timeline-multi.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `src/test/integration/machine-timeline-multi.test.ts` (copy `makeUser`/`makeMachine` helpers; seed `timelineEvents` exactly as established in Task 3):

```ts
import { describe, expect, it } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { timelineEvents } from "~/server/db/schema";
import { getMachineTimeline } from "~/lib/timeline/machine-events";

describe("getMachineTimeline — machine-id list (PP-slrd.1)", () => {
  setupTestDb();

  // copy makeUser/makeMachine helpers

  it("merges events across machines, newest first, excluding others", async () => {
    const db = await getTestDb();
    const owner = await makeUser();
    const m1 = await makeMachine("AA", "Alpha", owner.id);
    const m2 = await makeMachine("BB", "Beta", owner.id);
    const m3 = await makeMachine("CC", "Other", owner.id);

    await db.insert(timelineEvents).values([
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        machineId: m2.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        machineId: m3.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);

    const rows = await getMachineTimeline(db, {
      machineId: [m1.id, m2.id],
    });
    expect(rows.map((r) => r.machineId)).toEqual([m2.id, m1.id]);
  });

  it("still works with a single machine id string (back-compat)", async () => {
    const db = await getTestDb();
    const owner = await makeUser();
    const m1 = await makeMachine("DD", "Delta", owner.id);
    await db.insert(timelineEvents).values({
      machineId: m1.id,
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: { kind: "machine_added" },
    });
    const rows = await getMachineTimeline(db, { machineId: m1.id });
    expect(rows).toHaveLength(1);
  });

  it("returns [] for an empty id list without querying", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, { machineId: [] });
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run --project integration src/test/integration/machine-timeline-multi.test.ts`
Expected: FAIL — type error / wrong results for the array form.

- [ ] **Step 3: Implement the widening**

In `src/lib/timeline/machine-events.ts`:

(a) Args interface (~line 214) — widen the field and document it:

```ts
export interface GetMachineTimelineArgs {
  /** One machine id, or a list for combined (collection) feeds. */
  machineId: string | string[];
  tags?: TimelineTag[];
  limit?: number;
  offset?: number;
}
```

(b) At the top of `getMachineTimeline`, add the empty-list early return:

```ts
if (Array.isArray(args.machineId) && args.machineId.length === 0) {
  return [];
}
```

(c) WHERE clause (~lines 305-312) — replace the `eq(...)` term:

```ts
.where(
  and(
    Array.isArray(args.machineId)
      ? inArray(timelineEvents.machineId, args.machineId)
      : eq(timelineEvents.machineId, args.machineId),
    args.tags && args.tags.length > 0
      ? inArray(timelineEvents.tag, args.tags)
      : undefined
  )
)
```

(`inArray` is already imported in this file — verify; add to the drizzle-orm import if not.)

- [ ] **Step 4: Run the new test AND the existing timeline integration tests**

```bash
pnpm exec vitest run --project integration src/test/integration/machine-timeline-multi.test.ts
pnpm exec vitest run --project integration src/test/integration/ 2>&1 | tail -20
```

Expected: new test PASSES; **every pre-existing timeline test passes unchanged** (spec constraint #1 applies to behavior too — single-id callers must be unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/machine-events.ts src/test/integration/machine-timeline-multi.test.ts
git commit -m "feat(timeline): getMachineTimeline accepts a machine-id list (PP-slrd.1)"
```

---

### Task 5: Route scaffolding — layout, header, tab strip, Overview data assembly

**Files:**

- Create: `src/app/(app)/c/owner/[userId]/_data.ts`
- Create: `src/app/(app)/c/owner/[userId]/(tabs)/layout.tsx`
- Create: `src/app/(app)/c/owner/[userId]/(tabs)/page.tsx` (Overview, server side — table component arrives in Task 6)
- Create: `src/components/collections/CollectionHeader.tsx`
- Create: `src/components/collections/CollectionTabStrip.tsx`

Reference implementations to mirror (read them first): `src/app/(app)/m/[initials]/(tabs)/layout.tsx`, `src/app/(app)/m/[initials]/_data.ts`, `src/components/machines/MachineDetailHeader.tsx`, `src/components/machines/MachineTabStrip.tsx`.

- [ ] **Step 1: Create `src/app/(app)/c/owner/[userId]/_data.ts`**

```ts
import { cache } from "react";
import { getOwnerCollection } from "~/lib/collections/owner";

/**
 * Request-deduped collection fetch shared by the (tabs) layout and tab pages
 * (same pattern as getMachineForLayout in /m/[initials]/_data.ts).
 */
export const getOwnerCollectionForLayout = cache(async (userId: string) =>
  getOwnerCollection(undefined, userId)
);
```

(If `getOwnerCollection(undefined, userId)` fights ts-strictest on the optional-default param, change the Task 2 signature to `getOwnerCollection(tx: DbTransaction | undefined, userId: string)` with `const dbc = tx ?? db;` in the body — keep tests compiling.)

- [ ] **Step 2: Create `src/components/collections/CollectionHeader.tsx`**

```tsx
import type React from "react";
import type { CollectionSummary } from "~/lib/collections/summary";

interface Props {
  title: string;
  summary: CollectionSummary;
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

export function CollectionHeader({ title, summary }: Props): React.JSX.Element {
  const parts: string[] = [plural(summary.total, "machine")];
  if (summary.total > 0) {
    parts.push(`${String(summary.operational)} operational`);
    if (summary.needsService > 0)
      parts.push(`${String(summary.needsService)} need service`);
    if (summary.unplayable > 0)
      parts.push(`${String(summary.unplayable)} unplayable`);
    parts.push(plural(summary.openIssues, "open issue"));
  }
  return (
    <header>
      <h1 className="min-w-0 truncate text-2xl font-bold text-foreground sm:text-3xl">
        {title}
      </h1>
      <p
        className="mt-1 text-sm text-muted-foreground"
        data-testid="collection-summary"
      >
        {parts.join(" · ")}
      </p>
    </header>
  );
}
```

- [ ] **Step 3: Create `src/components/collections/CollectionTabStrip.tsx`**

Model directly on `src/components/machines/MachineTabStrip.tsx` — open it and copy its structure (client component, `usePathname`, `aria-current="page"`, scrollable nav, the badge styling via `getMachineStatusStyles`). The collection version differs only in:

```tsx
"use client";

// imports: copy MachineTabStrip's imports, plus:
import type { MachineStatus } from "~/lib/machines/status";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "issues", label: "Issues" },
  { slug: "timeline", label: "Timeline" },
] as const;

interface Props {
  /** e.g. `/c/owner/123e4567-...` */
  basePath: string;
  openIssueCount: number;
  status: MachineStatus; // worst status across the collection, for badge color
}
```

- Active-slug derivation: copy MachineTabStrip's logic verbatim, substituting `basePath` for its `base`.
- The count badge renders on the **Issues** tab (MachineTabStrip puts it on Service) when `openIssueCount > 0`, reusing the same `getMachineStatusStyles(status)` + `tabular-nums` badge markup and aria-label text pattern.
- Keep the same className strings as MachineTabStrip for links/active state — visual consistency is the point. Do not invent new styles.

- [ ] **Step 4: Create the layout**

`src/app/(app)/c/owner/[userId]/(tabs)/layout.tsx`:

```tsx
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { CollectionHeader } from "~/components/collections/CollectionHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
import { summarizeCollection } from "~/lib/collections/summary";
import { getOwnerCollectionForLayout } from "../_data";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  return {
    title: collection
      ? `${collection.owner.name}'s Machines | PinPoint`
      : "Machines | PinPoint",
  };
}

export default async function CollectionLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  const summary = summarizeCollection(collection.machines);
  const worstStatus =
    summary.unplayable > 0
      ? "unplayable"
      : summary.needsService > 0
        ? "needs_service"
        : "operational";

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <CollectionHeader
          title={`${collection.owner.name}'s Machines`}
          summary={summary}
        />
        <CollectionTabStrip
          basePath={`/c/owner/${collection.owner.id}`}
          openIssueCount={summary.openIssues}
          status={worstStatus}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 5: Create the Overview page (server assembly; placeholder rendering)**

`src/app/(app)/c/owner/[userId]/(tabs)/page.tsx`:

```tsx
import type React from "react";
import { notFound } from "next/navigation";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";
import { deriveMachineStatus, worstOpenSeverity } from "~/lib/machines/status";
import { getOwnerCollectionForLayout } from "../_data";
import type { CollectionOverviewRow } from "~/components/collections/CollectionOverviewTable";
// CollectionOverviewTable arrives in Task 6 — define the row type there.

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function CollectionOverviewPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  if (collection.machines.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No machines in this collection yet.
      </p>
    );
  }

  const latest = await getLatestTimelineEventPerMachine(
    undefined,
    collection.machines.map((m) => m.id)
  );

  const rows: CollectionOverviewRow[] = collection.machines.map((m) => ({
    id: m.id,
    initials: m.initials,
    name: m.name,
    status: deriveMachineStatus(m.issues),
    openCount: m.issues.length,
    worstSeverity: worstOpenSeverity(m.issues),
    lastActivity: latest.get(m.id) ?? null,
    presence: m.presenceStatus,
  }));

  return <CollectionOverviewTable rows={rows} />;
}
```

For THIS task only (so the route renders before Task 6): render a temporary `<pre>{JSON.stringify(rows.map(r => r.initials))}</pre>` instead of `<CollectionOverviewTable>` and leave the import commented. Task 6 swaps it in.

- [ ] **Step 6: Verify it renders**

```bash
pnpm run dev:status   # confirm/start the stack per AGENTS.md self-service rules
```

Visit `http://localhost:<port>/c/owner/<a-real-user-uuid>` (find one: `psql "$POSTGRES_URL" -c "select id, name from user_profiles limit 5"` or look at seeded data) — header + tabs + placeholder render; a bogus uuid 404s. Run `pnpm run check`.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/c src/components/collections
git commit -m "feat(collections): /c/owner/[userId] tabbed scaffold + header/tab strip (PP-slrd.1)"
```

---

### Task 6: Overview table — sorting, column picker, responsive columns

**Files:**

- Create: `src/components/collections/CollectionOverviewTable.tsx` (client)
- Modify: `src/app/(app)/c/owner/[userId]/(tabs)/page.tsx` (swap in the real table)
- Test: `src/components/collections/CollectionOverviewTable.test.tsx` (RTL, unit project)

Design decisions locked by the spec: worst-first default sort; every column header sortable (`<th scope="col">` + `aria-sort`); a "Columns" picker persisted to localStorage; Status + Machine un-hideable; responsive drop order presence → severity first. Sorting is **client-side state** (all rows are loaded; no pagination), unlike IssueList's URL-driven sort — note this in a component comment.

- [ ] **Step 1: Write the failing RTL test**

Create `src/components/collections/CollectionOverviewTable.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CollectionOverviewTable,
  type CollectionOverviewRow,
} from "./CollectionOverviewTable";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

function row(over: Partial<CollectionOverviewRow>): CollectionOverviewRow {
  return {
    id: crypto.randomUUID(),
    initials: "XX",
    name: "Machine",
    status: "operational",
    openCount: 0,
    worstSeverity: null,
    lastActivity: null,
    presence: "on_the_floor",
    ...over,
  };
}

const ROWS: CollectionOverviewRow[] = [
  row({ initials: "OK", name: "Fine Game", status: "operational" }),
  row({
    initials: "BAD",
    name: "Broken Game",
    status: "unplayable",
    openCount: 2,
    worstSeverity: "unplayable",
  }),
  row({
    initials: "MEH",
    name: "Aching Game",
    status: "needs_service",
    openCount: 1,
    worstSeverity: "major",
  }),
];

describe("CollectionOverviewTable", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("sorts worst-first by default", () => {
    render(<CollectionOverviewTable rows={ROWS} />);
    const bodyRows = within(screen.getByTestId("collection-overview-body"))
      .getAllByRole("row")
      .map((r) => r.getAttribute("data-initials"));
    expect(bodyRows).toEqual(["BAD", "MEH", "OK"]);
  });

  it("marks the active sort column with aria-sort and toggles on click", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    const statusHeader = screen.getByRole("columnheader", { name: /status/i });
    expect(statusHeader).toHaveAttribute("aria-sort", "descending");
    await user.click(within(statusHeader).getByRole("button"));
    expect(statusHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("sorts by machine name when that header is clicked", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    const nameHeader = screen.getByRole("columnheader", { name: /machine/i });
    await user.click(within(nameHeader).getByRole("button"));
    const bodyRows = within(screen.getByTestId("collection-overview-body"))
      .getAllByRole("row")
      .map((r) => r.getAttribute("data-initials"));
    expect(bodyRows).toEqual(["MEH", "BAD", "OK"]); // Aching, Broken, Fine
  });

  it("hides a column via the picker and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: /presence/i })
    );
    expect(
      screen.queryByRole("columnheader", { name: /presence/i })
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem("pinpoint_collection_overview_columns") ??
          "[]"
      )
    ).toContain("presence");
  });

  it("does not offer Status or Machine in the picker", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    await user.click(screen.getByRole("button", { name: /columns/i }));
    expect(
      screen.queryByRole("menuitemcheckbox", { name: /status/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitemcheckbox", { name: /machine/i })
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run --project unit src/components/collections/CollectionOverviewTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

`src/components/collections/CollectionOverviewTable.tsx`:

```tsx
"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Columns3 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MachineStatusBadge } from "~/components/machines/MachineStatusBadge";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { RelativeTime } from "~/components/issues/RelativeTime";
import {
  useTableResponsiveColumns,
  type ColumnConfig,
} from "~/hooks/use-table-responsive-columns";
import {
  MACHINE_STATUS_RANK,
  SEVERITY_RANK,
  type MachineStatus,
} from "~/lib/machines/status";
import { getTagLabel, type TimelineTag } from "~/lib/timeline/machine-tags";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { IssueSeverity } from "~/lib/types";
import { cn } from "~/lib/utils";
// ^ Verify the IssueSeverity / MachinePresenceStatus / cn import paths against
//   what MachineStatusBadge.tsx and status.ts themselves import.

export interface CollectionOverviewRow {
  id: string;
  initials: string;
  name: string;
  status: MachineStatus;
  openCount: number;
  worstSeverity: IssueSeverity | null;
  lastActivity: { createdAt: Date; tag: TimelineTag } | null;
  presence: MachinePresenceStatus;
}

type ColumnKey =
  | "status"
  | "machine"
  | "open"
  | "severity"
  | "activity"
  | "presence";

const HIDEABLE: readonly ColumnKey[] = [
  "open",
  "severity",
  "activity",
  "presence",
];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  status: "Status",
  machine: "Machine",
  open: "Open",
  severity: "Worst severity",
  activity: "Last activity",
  presence: "Presence",
};
const STORAGE_KEY = "pinpoint_collection_overview_columns";

interface SortState {
  key: ColumnKey;
  dir: "asc" | "desc";
}

function compareRows(
  a: CollectionOverviewRow,
  b: CollectionOverviewRow,
  key: ColumnKey
): number {
  switch (key) {
    case "status":
      return (
        MACHINE_STATUS_RANK[a.status] - MACHINE_STATUS_RANK[b.status] ||
        a.openCount - b.openCount ||
        a.name.localeCompare(b.name)
      );
    case "machine":
      return a.name.localeCompare(b.name);
    case "open":
      return a.openCount - b.openCount;
    case "severity": {
      const ra = a.worstSeverity === null ? -1 : SEVERITY_RANK[a.worstSeverity];
      const rb = b.worstSeverity === null ? -1 : SEVERITY_RANK[b.worstSeverity];
      return ra - rb;
    }
    case "activity": {
      const ta = a.lastActivity?.createdAt.getTime() ?? 0;
      const tb = b.lastActivity?.createdAt.getTime() ?? 0;
      return ta - tb;
    }
    case "presence":
      return a.presence.localeCompare(b.presence);
  }
}

export function CollectionOverviewTable({
  rows,
}: {
  rows: CollectionOverviewRow[];
}): React.JSX.Element {
  // Client-side sort state: all rows are already loaded (no pagination),
  // so unlike IssueList we don't round-trip sort through the URL.
  // Default: worst status first (spec §Overview).
  const [sort, setSort] = React.useState<SortState>({
    key: "status",
    dir: "desc",
  });
  const [hidden, setHidden] = React.useState<ColumnKey[]>([]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHidden(
          parsed.filter((k): k is ColumnKey =>
            (HIDEABLE as readonly string[]).includes(String(k))
          )
        );
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const toggleColumn = (key: ColumnKey): void => {
    setHidden((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Responsive drop order (spec): presence and severity go first.
  const columnConfig = React.useMemo(
    () =>
      [
        { key: "presence", minWidth: 110, priority: 1 },
        { key: "severity", minWidth: 130, priority: 2 },
        { key: "activity", minWidth: 180, priority: 3 },
        { key: "open", minWidth: 70, priority: 4 },
      ] as (ColumnConfig & { key: ColumnKey })[],
    []
  );
  const { visibleColumns, containerRef } = useTableResponsiveColumns<ColumnKey>(
    columnConfig,
    360 // base width consumed by the always-on Status + Machine columns
  );

  const isShown = (key: ColumnKey): boolean => {
    if (key === "status" || key === "machine") return true;
    return (visibleColumns[key] ?? true) && !hidden.includes(key);
  };

  const sorted = React.useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const base = compareRows(a, b, sort.key);
      return sort.dir === "desc" ? -base : base;
    });
    return copy;
  }, [rows, sort]);

  const handleSort = (key: ColumnKey): void => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  };

  const SortableHeader = ({
    column,
    align = "left",
  }: {
    column: ColumnKey;
    align?: "left" | "right";
  }): React.JSX.Element => (
    <th
      scope="col"
      aria-sort={
        sort.key === column
          ? sort.dir === "desc"
            ? "descending"
            : "ascending"
          : "none"
      }
      className={cn(
        "px-3 py-2 text-sm font-semibold text-muted-foreground",
        align === "right" && "text-right"
      )}
    >
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {COLUMN_LABELS[column]}
        {sort.key === column &&
          (sort.dir === "desc" ? (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-3.5" />
          ))}
      </button>
    </th>
  );

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 aria-hidden="true" className="mr-1.5 size-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {HIDEABLE.map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={!hidden.includes(key)}
                onCheckedChange={() => toggleColumn(key)}
              >
                {COLUMN_LABELS[key]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <SortableHeader column="status" />
              <SortableHeader column="machine" />
              {isShown("open") && (
                <SortableHeader column="open" align="right" />
              )}
              {isShown("severity") && <SortableHeader column="severity" />}
              {isShown("activity") && <SortableHeader column="activity" />}
              {isShown("presence") && <SortableHeader column="presence" />}
            </tr>
          </thead>
          <tbody data-testid="collection-overview-body">
            {sorted.map((row) => (
              <tr
                key={row.id}
                data-initials={row.initials}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-3 py-2.5">
                  <MachineStatusBadge status={row.status} size="sm" />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/m/${row.initials}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {row.name}
                  </Link>{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.initials}
                  </span>
                </td>
                {isShown("open") && (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.openCount}
                  </td>
                )}
                {isShown("severity") && (
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.worstSeverity ?? "—"}
                  </td>
                )}
                {isShown("activity") && (
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.lastActivity ? (
                      <>
                        <RelativeTime value={row.lastActivity.createdAt} />
                        {" — "}
                        {getTagLabel(row.lastActivity.tag)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {isShown("presence") && (
                  <td className="px-3 py-2.5">
                    <MachinePresenceBadge status={row.presence} size="sm" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Adjust import paths flagged in the comment; check `getTagLabel`'s exact export name in `machine-tags.ts` and `RelativeTime`'s prop name (`value` — verified) before running.

- [ ] **Step 4: Swap into the Overview page**

In `src/app/(app)/c/owner/[userId]/(tabs)/page.tsx`: remove the Task 5 `<pre>` placeholder, uncomment/add the import, render `<CollectionOverviewTable rows={rows} />`.

- [ ] **Step 5: Run tests + check**

```bash
pnpm exec vitest run --project unit src/components/collections/CollectionOverviewTable.test.tsx
pnpm run check
```

Expected: PASS / clean. Also eyeball in the browser at desktop + narrow widths (responsive drop).

- [ ] **Step 6: Commit**

```bash
git add src/components/collections src/app/\(app\)/c
git commit -m "feat(collections): sortable Overview status table with column picker (PP-slrd.1)"
```

---

### Task 7: Issues tab

**Files:**

- Create: `src/app/(app)/c/owner/[userId]/(tabs)/issues/page.tsx`
- Reference: `src/app/(app)/issues/page.tsx` (the assembly being adapted), `src/lib/issues/filters-queries.ts`, `src/components/issues/IssueList.tsx`, `src/components/issues/IssueFilters.tsx`

The page replicates the issues-page assembly with the machine filter **forced into the collection's set**. Scoping rule: user-requested machine filters are intersected with the collection's initials; if the intersection (or the collection) is empty, render the empty state **without querying** — `buildWhereConditions` drops an empty `machine` array, which would silently unscope the query.

- [ ] **Step 1: Implement the page**

```tsx
import type React from "react";
import { and, count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { parseIssueFilters } from "~/lib/issues/filters";
import { ISSUE_LIST_COLUMNS } from "~/lib/issues/queries";
import {
  buildOrderBy,
  buildWhereConditions,
} from "~/lib/issues/filters-queries";
import { getUnifiedUsers } from "~/lib/users/queries";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueList } from "~/components/issues/IssueList";
import type { IssueListItem } from "~/lib/types";
import { getOwnerCollectionForLayout } from "../../_data";

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionIssuesPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawParams = await searchParams;
  const urlParams = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (Array.isArray(value)) urlParams.set(key, value.join(","));
    else if (value !== undefined) urlParams.set(key, value);
  });
  const filters = parseIssueFilters(urlParams);

  // Force-scope to the collection. Requested machine filters narrow WITHIN
  // the set; they can never widen it. Empty scope -> no query (an empty
  // machine[] is dropped by buildWhereConditions, which would unscope).
  const collectionInitials = collection.machines.map((m) => m.initials);
  const requested = filters.machine ?? [];
  const scoped =
    requested.length > 0
      ? requested.filter((i) => collectionInitials.includes(i))
      : collectionInitials;

  if (scoped.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No issues — this collection has no matching machines.
      </p>
    );
  }
  filters.machine = scoped;

  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : undefined;
  const isAdmin = currentUserProfile?.role === "admin"; // permissions-audit-allow: SQL visibility flag, mirrors /issues page

  filters.currentUserId = user?.id;
  const where = buildWhereConditions(filters, db, { isAdmin });
  const orderBy = buildOrderBy(filters.sort);
  const pageSize = filters.pageSize ?? 15;
  const page = filters.page ?? 1;

  const [allUsers, issuesListRaw, totalCountResult] = await Promise.all([
    getUnifiedUsers(),
    db.query.issues.findMany({
      where: and(...where),
      orderBy,
      with: {
        machine: { columns: { id: true, name: true } },
        reportedByUser: { columns: { id: true, name: true } },
        invitedReporter: { columns: { id: true, name: true } },
        assignedToUser: { columns: { id: true, name: true } },
      },
      columns: ISSUE_LIST_COLUMNS,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ value: count() })
      .from(issues)
      .where(and(...where)),
  ]);

  const totalCount = totalCountResult[0]?.value ?? 0;
  const issuesList = issuesListRaw as IssueListItem[];

  // CORE-SEC-006: minimal client shapes (mirrors /issues page)
  const filterUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    machineCount: u.machineCount,
    status: u.status,
  }));
  const assigneeUsers = allUsers.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Showing {issuesList.length} of {totalCount} issues
      </p>
      <IssueFilters
        users={filterUsers}
        machines={collection.machines.map((m) => ({
          initials: m.initials,
          name: m.name,
        }))}
        filters={filters}
        currentUserId={user?.id ?? null}
        ownedMachineInitials={[]}
      />
      <IssueList
        issues={issuesList}
        totalCount={totalCount}
        sort={filters.sort ?? "updated_desc"}
        page={page}
        pageSize={pageSize}
        allUsers={assigneeUsers}
      />
    </div>
  );
}
```

Check `IssueFilters`' props for `ownedMachineInitials` optionality — if optional, omit it instead of passing `[]`.

- [ ] **Step 2: Write the failing integration test for the scoping rule**

The scoping logic is the one bug-prone piece (silent unscoping = data leak across collections). Add `src/test/integration/collections-issues-scope.test.ts` testing `buildWhereConditions` behavior the page relies on:

```ts
import { describe, expect, it } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { and } from "drizzle-orm";
import { buildWhereConditions } from "~/lib/issues/filters-queries";

describe("collection issues scoping (PP-slrd.1)", () => {
  setupTestDb();

  // copy makeUser/makeMachine helpers; also a makeIssue helper matching Task 2

  it("scoped machine filter returns only collection machines' issues", async () => {
    const db = await getTestDb();
    const owner = await makeUser();
    const mine = await makeMachine("AA", "Mine", owner.id);
    const theirs = await makeMachine("BB", "Theirs", null);
    await makeIssue(mine.initials, "mine issue");
    await makeIssue(theirs.initials, "theirs issue");

    const where = buildWhereConditions({ machine: ["AA"] }, db);
    const rows = await db.query.issues.findMany({ where: and(...where) });
    expect(rows.map((r) => r.title)).toEqual(["mine issue"]);
  });

  it("documents the hazard: an empty machine[] does NOT scope", async () => {
    const db = await getTestDb();
    const owner = await makeUser();
    const mine = await makeMachine("CC", "Mine2", owner.id);
    await makeIssue(mine.initials, "visible");
    const where = buildWhereConditions({ machine: [] }, db);
    const rows = await db.query.issues.findMany({ where: and(...where) });
    expect(rows.length).toBeGreaterThan(0); // unscoped! page must never pass []
  });
});
```

(`buildWhereConditions` types its `db` param as the postgres-js database; if PGlite's type fights it, cast at the call site in the test only, with a comment.)

- [ ] **Step 3: Run tests, verify rendering**

```bash
pnpm exec vitest run --project integration src/test/integration/collections-issues-scope.test.ts
pnpm run check
```

Browser: visit `/c/owner/<uuid>/issues` — list renders scoped; tab badge matches; a `?machine=` param for a non-collection machine yields the empty state.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/c src/test/integration/collections-issues-scope.test.ts
git commit -m "feat(collections): Issues tab — scoped reuse of the issues list (PP-slrd.1)"
```

---

### Task 8: Machine-attribution prop on timeline rows

Opt-in name line above each entry. **Per-machine pages don't set the prop and must be visually unchanged.**

**Files:**

- Create: `src/components/machines/timeline/MachineAttributionLine.tsx`
- Modify: `src/components/machines/timeline/MachineTimelineCommentRow.tsx`
- Modify: `src/components/machines/timeline/MachineTimelineIssueRow.tsx`
- Modify: `src/components/machines/timeline/MachineTimelineSystemRow.tsx`
- Modify: `src/components/machines/timeline/MachineTimelineTombstoneRow.tsx`
- Test: `src/components/machines/timeline/MachineAttributionLine.test.tsx`

- [ ] **Step 1: Write the failing RTL test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MachineTimelineSystemRow } from "./MachineTimelineSystemRow";

// Build a minimal valid MachineSystemRowData — copy a fixture from the
// existing MachineTimelineSystemRow tests if present (check for a
// MachineTimelineSystemRow.test.tsx); otherwise construct per the Props
// interface in the component.

describe("machine attribution line (PP-slrd.1)", () => {
  it("renders no machine line by default (per-machine pages unchanged)", () => {
    render(<MachineTimelineSystemRow row={FIXTURE_ROW} />);
    expect(screen.queryByTestId("machine-attribution")).not.toBeInTheDocument();
  });

  it("renders a linked machine name when machineLabel is provided", () => {
    render(
      <MachineTimelineSystemRow
        row={FIXTURE_ROW}
        machineLabel={{ name: "Godzilla", href: "/m/GZ" }}
      />
    );
    const link = screen.getByTestId("machine-attribution");
    expect(link).toHaveTextContent("Godzilla");
    expect(link.querySelector("a")).toHaveAttribute("href", "/m/GZ");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run --project unit src/components/machines/timeline/MachineAttributionLine.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Create the shared line component**

`src/components/machines/timeline/MachineAttributionLine.tsx`:

```tsx
import type React from "react";
import Link from "next/link";

export interface MachineLabel {
  name: string;
  href: string;
}

/**
 * Muted machine-name line above a timeline entry. Used ONLY by combined
 * (collection) feeds — per-machine timelines never pass machineLabel, so
 * their rendering is unchanged (spec: attribution style B1, PP-slrd.1).
 */
export function MachineAttributionLine({
  machine,
}: {
  machine: MachineLabel;
}): React.JSX.Element {
  return (
    <div
      data-testid="machine-attribution"
      className="mb-0.5 text-[11px] font-semibold text-muted-foreground"
    >
      <Link href={machine.href} className="hover:text-primary">
        {machine.name}
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Add the opt-in prop to all four rows**

For each row component, add to its `Props`:

```ts
import type { MachineLabel } from "./MachineAttributionLine";
// in Props:
machineLabel?: MachineLabel;
```

Placement (insert `{machineLabel && <MachineAttributionLine machine={machineLabel} />}`):

- **CommentRow**: first child inside the content column (`<div className="min-w-0 flex-1">`), above the header line.
- **IssueRow**: first child inside the content column, above line 1.
- **SystemRow**: the row is a single-line flex; when `machineLabel` is present, wrap the existing content `<div className="flex min-w-0 flex-1 ...">` in an outer `<div className="min-w-0 flex-1">` whose first child is the attribution line — when absent, render exactly the existing markup (ternary or early structure split; do NOT change the no-prop output).
- **TombstoneRow**: wrap the existing one-liner in a fragment/div with the attribution line first; unchanged when prop absent.

- [ ] **Step 5: Run new + ALL existing timeline component tests**

```bash
pnpm exec vitest run --project unit src/components/machines/timeline/
```

Expected: all PASS with **zero edits to existing test files** — that's the regression guard.

- [ ] **Step 6: Commit**

```bash
git add src/components/machines/timeline/
git commit -m "feat(timeline): opt-in machine attribution line on row components (PP-slrd.1)"
```

---

### Task 9: Filter plumbing — `baseUrl` on the tag filter + machine filter component

**Files:**

- Modify: `src/components/machines/timeline/MachineTimelineFilter.tsx`
- Modify: `src/components/machines/timeline/MachineTimelineFilter.test.tsx` (add cases only)
- Create: `src/components/collections/CollectionMachineFilter.tsx`
- Test: `src/components/collections/CollectionMachineFilter.test.tsx`

- [ ] **Step 1: Add `baseUrl` to MachineTimelineFilter (failing test first)**

Append to `MachineTimelineFilter.test.tsx` (reuse its existing mocks — `pushMock`, `usePathname` returning `/m/AAA/timeline`):

```tsx
it("pushes to baseUrl when provided (collection feed)", async () => {
  const user = userEvent.setup();
  render(
    <MachineTimelineFilter currentTags={[]} baseUrl="/c/owner/u1/timeline" />
  );
  const trigger = screen.getByRole("combobox", { name: /filter by tag/i });
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: /maintenance/i }));
  expect(pushMock).toHaveBeenCalledWith(
    expect.stringMatching(/^\/c\/owner\/u1\/timeline\?/)
  );
});
```

(Adapt the interaction to how the existing tests in that file select a tag — copy their steps.)

Run: `pnpm exec vitest run --project unit src/components/machines/timeline/MachineTimelineFilter.test.tsx` → new case FAILS.

- [ ] **Step 2: Implement**

In `MachineTimelineFilter.tsx`: add `baseUrl?: string` to `Props`; where the component does `router.push(qs ? `${pathname}?${qs}` : pathname)`, compute `const target = baseUrl ?? pathname;` and push `target` instead. Nothing else changes.

Run the test file → all cases PASS (existing cases prove per-machine behavior is unchanged).

- [ ] **Step 3: Create CollectionMachineFilter (failing test first)**

`src/components/collections/CollectionMachineFilter.test.tsx` — copy the mock scaffold from `MachineTimelineFilter.test.tsx` (ResizeObserver stub, `next/navigation` mock with `pushMock`, `usePathname` → `/c/owner/u1/timeline`):

```tsx
describe("CollectionMachineFilter", () => {
  it("writes selected machine initials to the m param and resets page", async () => {
    const user = userEvent.setup();
    render(
      <CollectionMachineFilter
        machines={[
          { initials: "GZ", name: "Godzilla" },
          { initials: "MM", name: "Medieval Madness" },
        ]}
        currentInitials={[]}
      />
    );
    await user.click(
      screen.getByRole("combobox", { name: /filter by machine/i })
    );
    await user.click(screen.getByRole("option", { name: /godzilla/i }));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("m=GZ"));
    expect(pushMock).toHaveBeenCalledWith(expect.not.stringContaining("page="));
  });
});
```

Implement `src/components/collections/CollectionMachineFilter.tsx` modeled directly on `MachineTimelineFilter.tsx` (same client structure, same URL-writing pattern):

```tsx
"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MultiSelect } from "~/components/ui/multi-select";

interface Props {
  machines: { initials: string; name: string }[];
  currentInitials: string[];
}

export function CollectionMachineFilter({
  machines,
  currentInitials,
}: Props): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = React.useMemo(
    () =>
      machines.map((m) => ({
        label: m.name,
        value: m.initials,
        badgeLabel: m.initials,
      })),
    [machines]
  );

  const writeMachines = (next: string[]): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete("m");
    else params.set("m", next.join(","));
    params.delete("page"); // filter change resets pagination
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <MultiSelect
      options={options}
      value={currentInitials}
      onChange={writeMachines}
      placeholder="Machines"
      searchPlaceholder="Filter machines…"
      ariaLabel="Filter by machine"
      className="w-44"
    />
  );
}
```

Run both test files → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/machines/timeline/MachineTimelineFilter.* src/components/collections/CollectionMachineFilter.*
git commit -m "feat(collections): timeline filter baseUrl prop + machine multi-select filter (PP-slrd.1)"
```

---

### Task 10: Collection Timeline page

**Files:**

- Create: `src/app/(app)/c/owner/[userId]/(tabs)/timeline/page.tsx`
- Reference (adapt, do not modify): `src/app/(app)/m/[initials]/(tabs)/timeline/page.tsx`

- [ ] **Step 1: Implement the page**

Open the per-machine timeline page and adapt. The collection version:

```tsx
import type React from "react";
import { notFound } from "next/navigation";
import { getMachineTimeline } from "~/lib/timeline/machine-events";
import {
  DEFAULT_TIMELINE_TAGS,
  tagSchema,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";
import { formatTimelineBucket } from "~/lib/dates";
import { MachineTimelineFilter } from "~/components/machines/timeline/MachineTimelineFilter";
import { CollectionMachineFilter } from "~/components/collections/CollectionMachineFilter";
import { getOwnerCollectionForLayout } from "../../_data";
// + the four row components, exactly as the per-machine page imports them

const PAGE_SIZE = 25;

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tag?: string; page?: string; m?: string }>;
}

export default async function CollectionTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  const { tag: tagParam, page: pageParam, m: machineParam } = await searchParams;

  // --- param parsing: copy the per-machine page's tag/page parsing verbatim ---
  // (tagSchema CSV parse; DEFAULT_TIMELINE_TAGS when ?tag omitted; page >= 1)

  // Machine scope: ?m=GZ,MM narrows WITHIN the collection.
  const collectionByInitials = new Map(
    collection.machines.map((m) => [m.initials, m])
  );
  const requestedInitials = machineParam
    ? machineParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => collectionByInitials.has(s))
    : [];
  const scopedMachines =
    requestedInitials.length > 0
      ? requestedInitials.map((i) => collectionByInitials.get(i))
          .filter((m): m is NonNullable<typeof m> => m !== undefined)
      : collection.machines;

  // NOTE: getMachineTimeline's tx param has NO default — pass db explicitly.
  // Add `import { db } from "~/server/db";` to this page's imports.
  const rows = await getMachineTimeline(db, {
    machineId: scopedMachines.map((m) => m.id),
    tags,
    limit: PAGE_SIZE + 1, // N+1 next-page detection, same as per-machine page
    offset: (currentPage - 1) * PAGE_SIZE,
  });
  const hasNextPage = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  // machineId -> label for attribution (B1)
  const machineById = new Map(
    collection.machines.map((m) => [
      m.id,
      { name: m.name, href: `/m/${m.initials}`, initials: m.initials },
    ])
  );

  // --- bucketing: copy the per-machine page's grouping loop verbatim ---

  // --- row dispatch: copy the per-machine renderRow logic, with these deltas:
  //   * every row gets machineLabel={labelFor(row.machineId)} (name+href only)
  //   * Issue rows get machineInitials={machineById.get(row.machineId)?.initials}
  //     (replaces the per-machine page's route-derived initials)
  //   * Comment rows get canEdit={false} canDelete={false}  (read-only v1)
  //   * NO composer / "New Note" button (PP-slrd.2)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <MachineTimelineFilter
          currentTags={/* parsed tags, as per-machine page passes them */}
          baseUrl={`/c/owner/${collection.owner.id}/timeline`}
        />
        <CollectionMachineFilter
          machines={collection.machines.map((m) => ({
            initials: m.initials,
            name: m.name,
          }))}
          currentInitials={requestedInitials}
        />
      </div>

      {pageRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No timeline activity yet.
        </p>
      ) : (
        /* bucketed sections + rows, copied from the per-machine page */
      )}

      {/* pagination: copy the per-machine page's prev/next controls, preserving
          tag AND m params in the links */}
    </div>
  );
}
```

The "copy verbatim" blocks are real instructions: the per-machine page's parsing (its lines ~54-77), bucketing (~129-149), dispatch (~151-254), and pagination JSX are the canonical implementations — transplant them, applying only the listed deltas. Where the per-machine page passes `machineInitials` from route params, this page derives it per-row from `machineById`. Keep `formatTimelineBucket` grouping as a presentational pass (PP-ynff constraint).

- [ ] **Step 2: Verify in browser + check**

```bash
pnpm run check
```

Browser: `/c/owner/<uuid>/timeline` — merged feed with name lines, machine + tag filters work together, pagination preserves both params, per-machine `/m/<initials>/timeline` is pixel-identical to before (no attribution lines).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/c
git commit -m "feat(collections): combined read-only Timeline tab with B1 attribution (PP-slrd.1)"
```

---

### Task 11: Nav entries — user menu + owner-name links

**Files:**

- Modify: `src/components/layout/user-menu-client.tsx`
- Modify: `src/components/layout/AppHeader.tsx` (line ~147 + props interface ~22-25)
- Modify: `src/components/layout/MainLayout.tsx` (AppHeader call site, ~line 124)
- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx` (owner-display block, ~lines 135-155)
- Modify (if assertions break): `src/components/layout/AppHeader.test.tsx`

- [ ] **Step 1: Plumb `userId` and add the "My Machines" item**

`user-menu-client.tsx` — add to `UserMenuProps`:

```ts
/** Authenticated user's id — enables the "My Machines" collection link. */
userId?: string | undefined;
```

Insert after the disabled Profile item (line ~88), matching the existing `<a>`-in-`DropdownMenuItem` idiom:

```tsx
{
  userId && (
    <DropdownMenuItem asChild>
      <a
        href={`/c/owner/${userId}`}
        className="flex items-center cursor-pointer"
        data-testid="user-menu-my-machines"
      >
        <Gamepad2 className="mr-2 size-4" />
        <span>My Machines</span>
      </a>
    </DropdownMenuItem>
  );
}
```

Add `Gamepad2` to the lucide-react import.

`AppHeader.tsx`: add `userId?: string | undefined;` to `AppHeaderProps`, destructure it, pass `<UserMenu userName={...} role={role} userId={userId} />`.

`MainLayout.tsx`: at the `<AppHeader ...>` call site, pass the authenticated user's id — read the file to find the variable holding the Supabase user (`user.id` / `userProfile.id`); pass `userId={user?.id}` (or equivalent).

- [ ] **Step 2: Link owner names on the machine Info tab**

In `src/app/(app)/m/[initials]/(tabs)/page.tsx`, owner-display block: replace the owner-name `<p>` with a link **for activated owners only** (invited owners have no userProfile → no collection page):

```tsx
{
  machine.owner ? (
    <Link
      href={`/c/owner/${machine.owner.id}`}
      className="text-sm font-medium text-foreground hover:text-primary hover:underline"
    >
      {machine.owner.name}
    </Link>
  ) : (
    <p className="text-sm font-medium text-foreground">
      {machine.invitedOwner?.name}
    </p>
  );
}
```

Preserve the existing `(Invited)` suffix logic and the "No owner assigned" fallback exactly as they are. Add the `Link` import if absent.

- [ ] **Step 3: Tests + check**

```bash
pnpm exec vitest run --project unit src/components/layout/
pnpm run check
```

If `AppHeader.test.tsx` asserts exact UserMenu props, extend the assertion to include `userId` — do not weaken other assertions.

Browser: user menu shows "My Machines" → lands on your collection; machine Info tab owner name links to that owner's collection.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ src/app/\(app\)/m
git commit -m "feat(collections): My Machines menu entry + owner-name links (PP-slrd.1)"
```

---

### Task 12: Smoke E2E

**Files:**

- Create: `e2e/smoke/collection-view.spec.ts`
- Reference: `e2e/smoke/machine-details-redesign.spec.ts`, `e2e/support/actions.js`, `e2e/support/constants.js`

- [ ] **Step 1: Identify fixtures**

```bash
rg -n "owner" e2e/support/constants.* scripts/seed* supabase/seed* -l
rg -n "seededMachines|seedUsers|owner" e2e/support/constants.*
```

Determine: (a) does the E2E login user own machines? (b) is there a seeded machine with an owner? Adapt the spec below to what exists — the user-menu path needs no hardcoded ids; the owner-link test needs a seeded owned machine (skip that test with a `test.skip` + bead-comment ONLY if seeds genuinely lack one; prefer extending the seed if trivial).

- [ ] **Step 2: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import {
  assertNoA11yViolations,
  assertNoHorizontalOverflow,
  ensureLoggedIn,
} from "../support/actions.js";

test.describe("Collection view (PP-slrd.1)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo);
  });

  test("My Machines via user menu renders Overview without 500", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-my-machines").click();
    await expect(page).toHaveURL(/\/c\/owner\//);
    await expect(page.getByTestId("collection-summary")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoA11yViolations(page);
  });

  test("Issues and Timeline tabs render without 500", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-my-machines").click();
    await page.getByRole("link", { name: "Issues" }).click();
    await expect(page).toHaveURL(/\/issues$/);
    await page.getByRole("link", { name: "Timeline" }).click();
    await expect(page).toHaveURL(/\/timeline$/);
    await assertNoA11yViolations(page);
  });

  test("owner name on machine info links to the owner's collection", async ({
    page,
  }) => {
    // Use a seeded machine that HAS an owner (verified in Step 1 — adjust initials)
    await page.goto("/m/<OWNED_MACHINE_INITIALS>");
    await page.getByTestId("owner-display").getByRole("link").click();
    await expect(page).toHaveURL(/\/c\/owner\//);
    await expect(page.getByTestId("collection-summary")).toBeVisible();
  });
});
```

Replace `<OWNED_MACHINE_INITIALS>` with the real constant from `e2e/support/constants.js` found in Step 1. If the logged-in E2E user owns zero machines, the first two tests still pass via the empty state — assert `collection-summary` shows "0 machines" in that case instead.

- [ ] **Step 3: Run it**

```bash
pnpm exec playwright test e2e/smoke/collection-view.spec.ts --project=chromium
```

Expected: PASS. (Never run playwright with no spec path.)

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/collection-view.spec.ts
git commit -m "test(e2e): collection view smoke coverage (PP-slrd.1)"
```

---

### Task 13: Land it

- [ ] **Step 1: Full preflight**

```bash
pnpm run preflight
```

Expected: clean (types, lint, format, unit, integration, build). Fix anything it surfaces.

- [ ] **Step 2: Spec sync check**

Re-read `docs/superpowers/specs/2026-06-06-multi-machine-collection-view-design.md`. If implementation diverged anywhere (it shouldn't have), edit the spec in place per AGENTS.md §7 — canonical specs stay authoritative.

- [ ] **Step 3: Push + PR (pinpoint-pr-workflow skill)**

```bash
git pull --rebase && git push
```

Open a ready-for-review PR titled `feat(collections): multi-machine collection view v1 (PP-slrd.1)` targeting `main`; body summarizes the three tabs + the seam, links the spec, and notes the regression guarantee (per-machine pages unchanged; existing tests untouched). Watch CI via `./scripts/workflow/pr-watch.py <PR>`; address Copilot comments per the skill.

- [ ] **Step 4: Bead bookkeeping**

```bash
bd update PP-slrd.1 --status in_progress   # at start of execution
# after merge:
bd close PP-slrd.1
```

---

## Self-review notes (done at plan time)

- **Spec coverage:** seam (T2-T4), routing/layout (T5), Overview table + picker + responsive + summary header (T5-T6), Issues reuse + scoping (T7), Timeline B1 + filters + read-only + per-machine-unchanged guard (T8-T10), nav + owner links (T11), permissions = none added (no task needed — pages simply don't gate), email privacy (no emails fetched anywhere; `getOwnerCollection` selects `id, name` only), testing layers (T1-T12), deferred items already beaded.
- **Known intentional deviations:** none. The "copy verbatim from the per-machine timeline page" instructions in T10 are deliberate — that page is the canonical implementation and copying it beats paraphrasing it stale.
- **Type consistency:** `CollectionMachine`/`OwnerCollection` (T2) feed `summarizeCollection` (T2), the layout (T5), `CollectionOverviewRow` (T6), the Issues scoping (T7), and the timeline page (T10). `machineLabel?: MachineLabel` is the single attribution prop name across all four row components (T8).
