# Machine Presence Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `presence_status` field to machines so users can indicate whether a machine is on the floor, on loan, removed, etc. — independent of the issue-derived health status.

**Architecture:** New text enum column on `machines` table. Default filter hides non-"on the floor" machines from both machine list and issues list. Presence is editable via the existing edit machine modal (same permissions). No timeline tracking.

**Tech Stack:** Drizzle ORM (migration), Zod (validation), Next.js Server Components + Server Actions, shadcn/ui (Select component), Vitest (unit tests), Playwright (E2E)

**Design Doc:** `docs/plans/2026-02-18-machine-presence-status-design.md`

**Worktree:** `/home/froeht/Code/pinpoint-worktrees/feat/1009-machine-presence-status`
**Branch:** `feat/1009-machine-presence-status`
**Ports:** Next.js: 3530, Supabase API: 59621, DB: 59622

---

## Task 1: Create presence helpers (`src/lib/machines/presence.ts`)

Mirror the pattern in `src/lib/machines/status.ts`.

**Files:**

- Create: `src/lib/machines/presence.ts`
- Test: `src/test/unit/lib/machines/presence.test.ts`

**Step 1: Write the failing tests**

Create `src/test/unit/lib/machines/presence.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getMachinePresenceLabel,
  getMachinePresenceStyles,
  isOnTheFloor,
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

describe("getMachinePresenceLabel", () => {
  it("returns the correct label for each presence status", () => {
    expect(getMachinePresenceLabel("on_the_floor")).toBe("On the Floor");
    expect(getMachinePresenceLabel("off_the_floor")).toBe("Off the Floor");
    expect(getMachinePresenceLabel("on_loan")).toBe("On Loan");
    expect(getMachinePresenceLabel("pending_arrival")).toBe("Pending Arrival");
    expect(getMachinePresenceLabel("removed")).toBe("Removed");
  });
});

describe("getMachinePresenceStyles", () => {
  it("returns styles for each presence status", () => {
    for (const status of VALID_MACHINE_PRESENCE_STATUSES) {
      const styles = getMachinePresenceStyles(status);
      expect(styles).toBeTruthy();
      expect(typeof styles).toBe("string");
    }
  });

  it("uses distinct styling for on_the_floor vs others", () => {
    const onFloor = getMachinePresenceStyles("on_the_floor");
    const removed = getMachinePresenceStyles("removed");
    expect(onFloor).not.toBe(removed);
  });
});

describe("isOnTheFloor", () => {
  it("returns true for on_the_floor", () => {
    expect(isOnTheFloor("on_the_floor")).toBe(true);
  });

  it("returns false for all other statuses", () => {
    const others: MachinePresenceStatus[] = [
      "off_the_floor",
      "on_loan",
      "pending_arrival",
      "removed",
    ];
    for (const status of others) {
      expect(isOnTheFloor(status)).toBe(false);
    }
  });
});

describe("VALID_MACHINE_PRESENCE_STATUSES", () => {
  it("contains all five statuses", () => {
    expect(VALID_MACHINE_PRESENCE_STATUSES).toHaveLength(5);
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("on_the_floor");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("off_the_floor");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("on_loan");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("pending_arrival");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("removed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/unit/lib/machines/presence.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/lib/machines/presence.ts`:

```typescript
export type MachinePresenceStatus =
  | "on_the_floor"
  | "off_the_floor"
  | "on_loan"
  | "pending_arrival"
  | "removed";

export const VALID_MACHINE_PRESENCE_STATUSES: MachinePresenceStatus[] = [
  "on_the_floor",
  "off_the_floor",
  "on_loan",
  "pending_arrival",
  "removed",
];

export function getMachinePresenceLabel(status: MachinePresenceStatus): string {
  const labels: Record<MachinePresenceStatus, string> = {
    on_the_floor: "On the Floor",
    off_the_floor: "Off the Floor",
    on_loan: "On Loan",
    pending_arrival: "Pending Arrival",
    removed: "Removed",
  };
  return labels[status];
}

/**
 * CSS classes for presence badge.
 * Uses neutral/muted palette to differentiate from health status colors
 * (which use success/warning/error).
 */
export function getMachinePresenceStyles(
  status: MachinePresenceStatus
): string {
  const styles: Record<MachinePresenceStatus, string> = {
    on_the_floor:
      "bg-success-container text-on-success-container border-success",
    off_the_floor:
      "bg-surface-container-highest text-on-surface-variant border-outline-variant",
    on_loan: "bg-tertiary-container text-on-tertiary-container border-tertiary",
    pending_arrival:
      "bg-secondary-container text-on-secondary-container border-secondary",
    removed: "bg-surface-container text-on-surface-variant border-outline",
  };
  return styles[status];
}

export function isOnTheFloor(status: MachinePresenceStatus): boolean {
  return status === "on_the_floor";
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/test/unit/lib/machines/presence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/machines/presence.ts src/test/unit/lib/machines/presence.test.ts
git commit -m "feat(machines): add presence status type, labels, and helpers"
```

---

## Task 2: Add `presence_status` column to schema + migration

**Files:**

- Modify: `src/server/db/schema.ts` (the `machines` pgTable definition, around line 73-110)
- Generated: `drizzle/NNNN_*.sql` (auto-generated by drizzle-kit)

**Step 1: Add the column to schema.ts**

In `src/server/db/schema.ts`, inside the `machines` pgTable definition, add after `ownerNotes`:

```typescript
    presenceStatus: text("presence_status", {
      enum: ["on_the_floor", "off_the_floor", "on_loan", "pending_arrival", "removed"],
    }).notNull().default("on_the_floor"),
```

**Step 2: Generate the migration**

Run: `pnpm run db:generate`
Expected: Creates a new migration SQL file in `drizzle/`

**Step 3: Review the generated SQL**

The migration should contain something like:

```sql
ALTER TABLE "machines" ADD COLUMN "presence_status" text DEFAULT 'on_the_floor' NOT NULL;
```

Verify it's a simple `ADD COLUMN` with default. No data migration needed — all existing machines are `on_the_floor`.

**Step 4: Apply the migration locally**

First, ensure Supabase is running in the worktree:

```bash
supabase start
```

Then:

```bash
pnpm run db:migrate
```

Expected: Migration applied successfully

**Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(machines): add presence_status column to machines table"
```

---

## Task 3: Update machine filters to include presence

**Files:**

- Modify: `src/lib/machines/filters.ts` (add `presence` to `MachineFilters` interface and parsing)
- Modify: `src/lib/machines/filters-queries.ts` (add `presenceStatus` to `MachineWithDerivedStatus` and filtering/default logic)
- Modify: `src/app/(app)/m/page.tsx` (pass `presenceStatus` through, apply default filter)

**Step 1: Update `src/lib/machines/filters.ts`**

Add import at top:

```typescript
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
```

Add to `MachineFilters` interface:

```typescript
  presence?: MachinePresenceStatus[] | undefined;
```

Add parsing in `parseMachineFilters()` after the status parsing block:

```typescript
const presence = parseCommaList(
  params.get("presence"),
  VALID_MACHINE_PRESENCE_STATUSES
);
if (presence !== undefined) {
  filters.presence = presence;
}
```

Add `"presence"` to the `filterKeys` array in `hasActiveMachineFilters()`.

**Step 2: Update `src/lib/machines/filters-queries.ts`**

Add to `MachineWithDerivedStatus` interface:

```typescript
presenceStatus: MachinePresenceStatus;
```

(Add the import for `MachinePresenceStatus` from `~/lib/machines/presence`)

In `applyMachineFilters()`, add a new filter check after the owner filter:

```typescript
// 4. Presence filter
if (filters.presence && filters.presence.length > 0) {
  if (!filters.presence.includes(machine.presenceStatus)) return false;
}
```

**Step 3: Update `src/app/(app)/m/page.tsx`**

In the `machinesWithStatus` mapping (around line 122-138), add `presenceStatus`:

```typescript
      presenceStatus: machine.presenceStatus,
```

Before `applyMachineFilters`, apply the default presence filter:

```typescript
// Default: only show "on the floor" machines unless presence filter is explicitly set
if (!filters.presence) {
  filters.presence = ["on_the_floor"];
}
```

Note: When `filters.presence` is an empty array (user passed `?presence=all`), it means "show all" — the `parseCommaList` function already handles `"all"` → `[]`, and the filter check `filters.presence.length > 0` will skip filtering. This is the existing pattern.

Add `presenceStatus` to the `columns` in the DB query so it's fetched.

**Step 4: Run type check and unit tests**

```bash
pnpm run check
```

Expected: PASS (types, lint, format, unit tests)

**Step 5: Commit**

```bash
git add src/lib/machines/filters.ts src/lib/machines/filters-queries.ts src/app/\(app\)/m/page.tsx
git commit -m "feat(machines): add presence filtering with on_the_floor default"
```

---

## Task 4: Add presence filter to machine filter bar UI

**Files:**

- Modify: `src/components/machines/MachineFilters.tsx`

**Step 1: Add presence filter MultiSelect**

Import `getMachinePresenceLabel` from `~/lib/machines/presence` and `MachinePresenceStatus` type.

Add presence options constant (below the existing `STATUS_OPTIONS`):

```typescript
const PRESENCE_OPTIONS = [
  { label: "On the Floor", value: "on_the_floor" },
  { label: "Off the Floor", value: "off_the_floor" },
  { label: "On Loan", value: "on_loan" },
  { label: "Pending Arrival", value: "pending_arrival" },
  { label: "Removed", value: "removed" },
];
```

Add a new `MultiSelect` in the filter selectors row (the `<div className="flex flex-wrap gap-2">` around line 230):

```tsx
<div className="w-full sm:w-48">
  <MultiSelect
    options={PRESENCE_OPTIONS}
    value={filters.presence ?? ["on_the_floor"]}
    onChange={(val) =>
      pushFilters({ presence: val as MachinePresenceStatus[] })
    }
    placeholder="Presence"
  />
</div>
```

Add presence badges to the `badges` memo (after owner badges):

```typescript
// Presence badges (only show for non-default values)
filters.presence?.forEach((p) => {
  if (p !== "on_the_floor") {
    items.push({
      id: `presence-${p}`,
      label: getMachinePresenceLabel(p),
      clear: () =>
        pushFilters({
          presence: filters.presence?.filter((v) => v !== p),
        }),
    });
  }
});
```

Update the `hasAnyFilter` check to include presence:

```typescript
const hasAnyFilter =
  search ||
  badges.length > 0 ||
  (filters.sort && filters.sort !== "name_asc") ||
  (filters.presence &&
    filters.presence.length > 0 &&
    !(filters.presence.length === 1 && filters.presence[0] === "on_the_floor"));
```

Update the "Clear All" handler to reset presence:

```typescript
pushFilters({
  q: undefined,
  status: [],
  owner: [],
  presence: [], // "all" — show everything when clearing
  sort: "name_asc",
});
```

**Step 2: Run type check**

```bash
pnpm run check
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/machines/MachineFilters.tsx
git commit -m "feat(machines): add presence filter to machine filter bar"
```

---

## Task 5: Display presence badge on machine cards and detail page

**Files:**

- Modify: `src/app/(app)/m/page.tsx` (machine card badges)
- Modify: `src/app/(app)/m/[initials]/page.tsx` (detail page header)

**Step 1: Add presence badge to machine cards**

In `src/app/(app)/m/page.tsx`, import presence helpers:

```typescript
import {
  getMachinePresenceLabel,
  getMachinePresenceStyles,
  isOnTheFloor,
} from "~/lib/machines/presence";
```

In the machine card (around line 234-246), add a presence badge **below** the health status badge when the machine is NOT on the floor:

```tsx
{
  !isOnTheFloor(machine.presenceStatus) && (
    <Badge
      className={cn(
        getMachinePresenceStyles(machine.presenceStatus),
        "border px-2.5 py-0.5 text-xs font-semibold rounded-full"
      )}
    >
      {getMachinePresenceLabel(machine.presenceStatus)}
    </Badge>
  );
}
```

**Step 2: Add presence badge to machine detail header**

In `src/app/(app)/m/[initials]/page.tsx`, import presence helpers and add a presence badge near the existing health status badge in the header. The machine detail page already fetches the machine record — add `presenceStatus` to the columns fetched if not already included.

Show the presence badge when not `on_the_floor`. Consider adding a slightly muted/dimmed container to the entire page when machine is not on the floor — e.g., a subtle banner:

```tsx
{
  !isOnTheFloor(machine.presenceStatus) && (
    <div className="rounded-md border border-outline-variant bg-surface-container px-4 py-2 text-sm text-on-surface-variant">
      This machine is currently{" "}
      <strong>
        {getMachinePresenceLabel(machine.presenceStatus).toLowerCase()}
      </strong>
      .
    </div>
  );
}
```

**Step 3: Run type check**

```bash
pnpm run check
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(app\)/m/page.tsx src/app/\(app\)/m/\[initials\]/page.tsx
git commit -m "feat(machines): display presence badge on cards and detail page"
```

---

## Task 6: Add presence status to edit machine modal

**Files:**

- Modify: `src/app/(app)/m/schemas.ts` (add `presenceStatus` to `updateMachineSchema`)
- Modify: `src/app/(app)/m/actions.ts` (handle `presenceStatus` in `updateMachineAction`)
- Modify: `src/app/(app)/m/[initials]/update-machine-form.tsx` (add Select field)

**Step 1: Update Zod schema**

In `src/app/(app)/m/schemas.ts`, import the valid values:

```typescript
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
```

Add to `updateMachineSchema`:

```typescript
  presenceStatus: z.enum(["on_the_floor", "off_the_floor", "on_loan", "pending_arrival", "removed"]).optional(),
```

**Step 2: Update server action**

In `src/app/(app)/m/actions.ts`, in `updateMachineAction()`:

- Parse `presenceStatus` from form data
- Include it in the Drizzle `update()` call alongside name/owner updates
- Add `presenceStatus` to the fields updated in the `set()` call

The existing permission check (admins + owners, around line 254-258) already gates access. No new permission logic needed.

**Step 3: Update the edit modal component**

In `src/app/(app)/m/[initials]/update-machine-form.tsx`:

Add to the `EditMachineDialogProps.machine` interface:

```typescript
presenceStatus: string;
```

Import the Select component from shadcn/ui:

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
```

Import presence helpers:

```typescript
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
} from "~/lib/machines/presence";
```

Add a Select field between the Name field and the Owner field (around line 201):

```tsx
{
  /* Presence Status */
}
<div className="space-y-2">
  <Label htmlFor="edit-presence" className="text-on-surface">
    Presence Status
  </Label>
  <Select name="presenceStatus" defaultValue={machine.presenceStatus}>
    <SelectTrigger
      id="edit-presence"
      className="border-outline bg-surface text-on-surface"
    >
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {VALID_MACHINE_PRESENCE_STATUSES.map((status) => (
        <SelectItem key={status} value={status}>
          {getMachinePresenceLabel(status)}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-on-surface-variant">
    Whether this machine is currently available on the floor
  </p>
</div>;
```

**Step 4: Update the machine detail page to pass presenceStatus to the modal**

In `src/app/(app)/m/[initials]/page.tsx`, ensure `presenceStatus` is in the machine object passed to `EditMachineDialog`.

**Step 5: Run type check and tests**

```bash
pnpm run check
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/app/\(app\)/m/schemas.ts src/app/\(app\)/m/actions.ts src/app/\(app\)/m/\[initials\]/update-machine-form.tsx src/app/\(app\)/m/\[initials\]/page.tsx
git commit -m "feat(machines): add presence status to edit machine modal"
```

---

## Task 7: Filter issues list by machine presence

**Files:**

- Modify: `src/lib/issues/filters-queries.ts` (add default WHERE condition excluding non-on_the_floor machines)
- Modify: `src/lib/issues/filters.ts` (add `includeInactiveMachines` filter option)
- Modify: `src/app/(app)/issues/page.tsx` (pass the flag through)

**Step 1: Add filter option**

In `src/lib/issues/filters.ts`, add to `IssueFilters` interface:

```typescript
  includeInactiveMachines?: boolean | undefined;
```

In `parseIssueFilters()`, add:

```typescript
const includeInactive = params.get("include_inactive_machines");
if (includeInactive === "true") filters.includeInactiveMachines = true;
```

Add `"include_inactive_machines"` to `hasActiveIssueFilters()` filterKeys array.

**Step 2: Add WHERE condition**

In `src/lib/issues/filters-queries.ts`, in `buildWhereConditions()`:

At the end of the conditions building (before the return), add:

```typescript
// Default: exclude issues from machines not "on the floor"
if (!filters.includeInactiveMachines) {
  conditions.push(
    exists(
      db
        .select()
        .from(machines)
        .where(
          and(
            eq(machines.initials, issues.machineInitials),
            eq(machines.presenceStatus, "on_the_floor")
          )
        )
    )
  );
}
```

This uses the same EXISTS subquery pattern already used for the owner filter (see line 151-162 of this file).

**Step 3: Run type check and tests**

```bash
pnpm run check
```

Expected: PASS. Existing tests should still pass — the default behavior adds a filter, but test fixtures likely don't have `presenceStatus` set (they'll default to `on_the_floor` via the migration default).

If integration tests fail because the test DB doesn't have the column yet, run `pnpm run db:migrate` in the test environment first.

**Step 4: Commit**

```bash
git add src/lib/issues/filters.ts src/lib/issues/filters-queries.ts src/app/\(app\)/issues/page.tsx
git commit -m "feat(issues): filter out issues from inactive machines by default"
```

---

## Task 8: Run preflight and final verification

**Step 1: Run full preflight**

```bash
pnpm run preflight
```

Expected: PASS (types, lint, format, unit tests, build, integration tests)

**Step 2: Fix any issues found**

Address lint warnings, type errors, or test failures.

**Step 3: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix: address preflight issues for presence status feature"
```

**Step 4: Push**

```bash
git push -u origin feat/1009-machine-presence-status
```

---

## Task 9: E2E tests

**Files:**

- Create or modify: `e2e/machines/presence-status.spec.ts` (or add to existing machine E2E tests)

**Key scenarios to test:**

1. Default machine list shows only "on the floor" machines
2. Changing presence filter reveals other machines
3. Edit machine modal shows presence dropdown
4. Changing presence status via edit modal works
5. Machine detail page shows presence badge for non-"on the floor" machines
6. Issues list excludes issues from non-"on the floor" machines by default

Reference `@pinpoint-e2e` skill for worker isolation and stability patterns.

**Step 1: Write E2E tests**

Follow the existing E2E test patterns in the project. Use worker-scoped fixtures.

**Step 2: Run E2E tests**

```bash
pnpm run e2e:full
```

**Step 3: Commit**

```bash
git add e2e/
git commit -m "test(e2e): add presence status E2E tests"
```

**Step 4: Push final**

```bash
git push
```
