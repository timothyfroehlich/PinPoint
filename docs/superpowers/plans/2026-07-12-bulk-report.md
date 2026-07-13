# Bulk Issue Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-first `/report/bulk` page where a technician+ authors many issues in one grid and submits them per-row or all at once.

**Architecture:** A Server Component page gates access (technician+) and fetches the machine list + assignable people, then renders a client grid. Each grid row reflows between a compact collapsed state and a full expanded state. Submission (single-row and batch) goes through server actions that re-check permission server-side and reuse the existing `createIssue` service; a batch creates the good rows and returns per-row results so bad rows stay in place flagged.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), React 19, Drizzle, Zod, shadcn/ui, Tailwind v4, Vitest (PGlite integration + RTL), Playwright (smoke).

## Global Constraints

_(Every task's requirements implicitly include this section. Values copied from AGENTS.md / the design spec.)_

- **Design spec:** `docs/superpowers/specs/2026-07-12-bulk-report-design.md` (prototype: `2026-07-12-bulk-report-prototype.html`). Bead **PP-sn34**.
- **Permissions via the matrix only** (CORE-ARCH-008): all checks go through `checkPermission()` from `~/lib/permissions/helpers`. New capabilities get a matrix entry.
- **Type safety** (CORE-TS-007): ts-strictest, `exactOptionalPropertyTypes`. No `any`, no non-null `!`, no unsafe `as`.
- **Path aliases** (CORE-TS-008): always `~/` imports.
- **Server Components default** (CORE-ARCH-001): `"use client"` only on interaction leaves. The grid is a sanctioned client leaf; the page is a Server Component.
- **No side effects inside DB transactions** (CORE-ARCH-011): `createIssue` already handles this; notifications dispatch post-commit via `after()`. Do not add HTTP/email inside any transaction.
- **Email privacy** (CORE-SEC-007): the assignee picker shows names only, never emails.
- **`localhost`, never `127.0.0.1`** (CORE-SEC-008) in any local URL.
- **Escape parens in shell paths**: `src/app/\(app\)/report/bulk/...`.
- **Run `pnpm run check` before each commit.** This feature touches server actions + permissions, so run `pnpm run preflight` before opening the PR.
- **Commit trailer** on every commit:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

**Row field vocabulary (exact enum values):**

- severity: `cosmetic | minor | major | unplayable` (default `minor`)
- priority: `low | medium | high` (default `medium`)
- frequency: `intermittent | frequent | constant` (default `intermittent`)
- status: `ISSUE_STATUS_VALUES` from `~/lib/issues/status` (default `new`)
- title (the "Problem" field): 1–60 chars; description: optional, ≤ 20000 chars
- watch default `true`; assignee default unassigned
- **Batch soft cap: 50 rows.**

---

### Task 1: Add `issues.report.bulk` permission to the matrix

**Files:**

- Modify: `src/lib/permissions/matrix.ts` (the `issues` category `permissions` array, after the `issues.report.assignee` entry ~line 199)
- Test: `src/test/unit/permissions-matrix.test.ts`

**Interfaces:**

- Produces: permission id `"issues.report.bulk"` — granted to `technician` and `admin`; denied to `unauthenticated`, `guest`, `member`. Checked via `checkPermission("issues.report.bulk", accessLevel)`.

- [ ] **Step 1: Write the failing test**

Add to `src/test/unit/permissions-matrix.test.ts` (inside the existing top-level `describe` scope, e.g. after the `PERMISSIONS_MATRIX` block):

```typescript
describe("issues.report.bulk", () => {
  it("is granted to technician and admin only", () => {
    expect(checkPermission("issues.report.bulk", "technician")).toBe(true);
    expect(checkPermission("issues.report.bulk", "admin")).toBe(true);
    expect(checkPermission("issues.report.bulk", "member")).toBe(false);
    expect(checkPermission("issues.report.bulk", "guest")).toBe(false);
    expect(checkPermission("issues.report.bulk", "unauthenticated")).toBe(
      false
    );
  });

  it("is registered in PERMISSIONS_BY_ID", () => {
    expect(PERMISSIONS_BY_ID["issues.report.bulk"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/unit/permissions-matrix.test.ts -t "issues.report.bulk"`
Expected: FAIL — `PERMISSIONS_BY_ID["issues.report.bulk"]` is `undefined`; `checkPermission` returns `false` for technician/admin.

- [ ] **Step 3: Add the matrix entry**

In `src/lib/permissions/matrix.ts`, immediately after the `issues.report.assignee` object (the one ending `admin: true, }, },` around line 199), insert:

```typescript
      {
        id: "issues.report.bulk",
        label: "Bulk report issues",
        description:
          "Create many issues at once from the bulk report grid (/report/bulk)",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          technician: true,
          admin: true,
        },
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/unit/permissions-matrix.test.ts -t "issues.report.bulk"`
Expected: PASS.

- [ ] **Step 5: Run the full permissions suite (guards the help page + matrix invariants)**

Run: `pnpm exec vitest run src/test/unit/permissions-matrix.test.ts src/test/unit/permissions-helpers.test.ts`
Expected: PASS (no invariant/coverage test broke from the new entry).

- [ ] **Step 6: Commit**

```bash
git add src/lib/permissions/matrix.ts src/test/unit/permissions-matrix.test.ts
git commit -m "feat(permissions): add issues.report.bulk (technician+) for the bulk report page (PP-sn34)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Bulk row schema + validation (pure, testable)

**Files:**

- Create: `src/app/(app)/report/bulk/schemas.ts`
- Create: `src/app/(app)/report/bulk/validation.ts`
- Test: `src/app/(app)/report/bulk/validation.test.ts`

**Interfaces:**

- Produces:
  - `bulkRowSchema` (Zod) and `type BulkRowInput = z.infer<typeof bulkRowSchema>` with fields:
    `{ machineId: string; title: string; description?: string; severity: IssueSeverity; priority: IssuePriority; frequency: IssueFrequency; status: IssueStatus; assignedTo?: string; watch: boolean; idempotencyKey: string }`
  - `BULK_MAX_ROWS = 50`
  - `parseBulkRow(raw: unknown): { success: true; data: BulkRowInput } | { success: false; error: string }`

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/report/bulk/validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { parseBulkRow } from "./validation";
import { BULK_MAX_ROWS } from "./schemas";

const validRow = () => ({
  machineId: randomUUID(),
  title: "Right flipper sticky",
  description: "",
  severity: "major",
  priority: "medium",
  frequency: "frequent",
  status: "new",
  assignedTo: "",
  watch: true,
  idempotencyKey: randomUUID(),
});

describe("parseBulkRow", () => {
  it("accepts a well-formed row", () => {
    const res = parseBulkRow(validRow());
    expect(res.success).toBe(true);
  });

  it("rejects a missing machineId with a field-prefixed message", () => {
    const res = parseBulkRow({ ...validRow(), machineId: "not-a-uuid" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/machineId/);
  });

  it("rejects an empty title", () => {
    const res = parseBulkRow({ ...validRow(), title: "" });
    expect(res.success).toBe(false);
  });

  it("rejects a title longer than 60 chars", () => {
    const res = parseBulkRow({ ...validRow(), title: "x".repeat(61) });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid severity", () => {
    const res = parseBulkRow({ ...validRow(), severity: "nope" });
    expect(res.success).toBe(false);
  });

  it("treats empty assignedTo as valid (unassigned)", () => {
    const res = parseBulkRow({ ...validRow(), assignedTo: "" });
    expect(res.success).toBe(true);
  });

  it("exposes the batch cap", () => {
    expect(BULK_MAX_ROWS).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/(app)/report/bulk/validation.test.ts"`
Expected: FAIL — module not found (`./validation`, `./schemas`).

- [ ] **Step 3: Create the schema**

Create `src/app/(app)/report/bulk/schemas.ts`:

```typescript
import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";

/** Maximum rows a single bulk submit may create (accident guard, not abuse). */
export const BULK_MAX_ROWS = 50;

export const bulkRowSchema = z.object({
  machineId: z.string().uuid({ message: "Please select a machine" }),
  title: z
    .string()
    .min(1, "Problem is required")
    .max(60, "Problem must be 60 characters or less")
    .trim(),
  description: z
    .string()
    .trim()
    .max(20000, "Description is too long")
    .optional(),
  severity: z.enum(["cosmetic", "minor", "major", "unplayable"], {
    message: "Select a severity",
  }),
  priority: z.enum(["low", "medium", "high"], { message: "Select a priority" }),
  frequency: z.enum(["intermittent", "frequent", "constant"], {
    message: "Select a frequency",
  }),
  status: z.enum(ISSUE_STATUS_VALUES),
  assignedTo: z.string().uuid("Invalid assignee").optional().or(z.literal("")),
  watch: z.boolean(),
  // Client-generated, stable across retries; lets createIssue dedup.
  idempotencyKey: z.string().uuid("Invalid idempotency key"),
});

export type BulkRowInput = z.infer<typeof bulkRowSchema>;
```

- [ ] **Step 4: Create the validation helper**

Create `src/app/(app)/report/bulk/validation.ts`:

```typescript
import { bulkRowSchema, type BulkRowInput } from "./schemas";

export type ParsedBulkRow =
  | { success: true; data: BulkRowInput }
  | { success: false; error: string };

/**
 * Validate one bulk row. Pure so it can be unit-tested and reused by the
 * server action without Server-Action plumbing.
 */
export function parseBulkRow(raw: unknown): ParsedBulkRow {
  const result = bulkRowSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path.at(0);
    const message = first?.message ?? "Invalid input";
    return {
      success: false,
      error: field ? `${String(field)}: ${message}` : message,
    };
  }
  return { success: true, data: result.data };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run "src/app/(app)/report/bulk/validation.test.ts"`
Expected: PASS (all 7 assertions).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/report/bulk/schemas.ts" "src/app/(app)/report/bulk/validation.ts" "src/app/(app)/report/bulk/validation.test.ts"
git commit -m "feat(bulk-report): row schema + validation helper (PP-sn34)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Server actions — single-row + batch submit

**Files:**

- Create: `src/app/(app)/report/bulk/actions.ts`
- Test: `src/test/integration/bulk-report-action.test.ts`

**Interfaces:**

- Consumes: `parseBulkRow`, `BulkRowInput`, `BULK_MAX_ROWS` (Task 2); `checkPermission`, `getAccessLevel` (`~/lib/permissions/helpers`); `createIssue` (`~/services/issues`); `plainTextToDoc` (`~/lib/tiptap/types`); `dispatchNotification` (`~/lib/notifications`).
- Produces:
  - `type BulkRowResult = { index: number; ok: true; issueNumber: number; machineInitials: string } | { index: number; ok: false; error: string }`
  - `type BulkSubmitResponse = { ok: true; results: BulkRowResult[] } | { ok: false; error: string }`
  - `submitBulkIssuesAction(rows: BulkRowInput[]): Promise<BulkSubmitResponse>` — creates each valid row; invalid rows come back `ok: false` and are NOT created. `ok: false` at the top level only for auth failure or exceeding `BULK_MAX_ROWS`.
  - `submitBulkIssueRowAction(row: BulkRowInput): Promise<BulkRowResult>` — single row (index always `0`).

- [ ] **Step 1: Write the failing integration test**

Create `src/test/integration/bulk-report-action.test.ts` (mirrors the boundary-mock style of `public-issue-submit.test.ts`; real PGlite + real permission matrix + real `createIssue`):

```typescript
/**
 * Integration tests: bulk report actions (PP-sn34).
 * Real PGlite DB, real permission matrix, real createIssue. External
 * boundaries (auth identity, notifications, logger, Sentry, next/*) mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { issues } from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn(),
}));
vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue({}),
}));

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

// Route the production db import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return {
    get db() {
      return getTestDb();
    },
  };
});

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  machineId: "",
  title: "Right flipper sticky",
  description: "",
  severity: "major",
  priority: "medium",
  frequency: "frequent",
  status: "new",
  assignedTo: "",
  watch: true,
  idempotencyKey: randomUUID(),
  ...over,
});

describe("bulk report actions", () => {
  setupTestDb();
  beforeEach(() => vi.clearAllMocks());

  it("forbids a member", async () => {
    const db = getTestDb();
    const member = await createTestUser(db, { role: "member" });
    const m = await createTestMachine(db, {
      initials: "GP",
      name: "Grand Prix",
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: member.id } } });

    const { submitBulkIssuesAction } =
      await import("~/app/(app)/report/bulk/actions");
    const res = await submitBulkIssuesAction([row({ machineId: m.id })]);
    expect(res.ok).toBe(false);
    const before = await db.query.issues.findMany();
    expect(before).toHaveLength(0);
  });

  it("creates all good rows for a technician", async () => {
    const db = getTestDb();
    const tech = await createTestUser(db, { role: "technician" });
    const m1 = await createTestMachine(db, {
      initials: "GP",
      name: "Grand Prix",
    });
    const m2 = await createTestMachine(db, {
      initials: "FS",
      name: "Future Spa",
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });

    const { submitBulkIssuesAction } =
      await import("~/app/(app)/report/bulk/actions");
    const res = await submitBulkIssuesAction([
      row({ machineId: m1.id, title: "Spinner rejecting" }),
      row({ machineId: m2.id, title: "Key broken in back box" }),
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.results.every((r) => r.ok)).toBe(true);
    }
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(2);
  });

  it("creates good rows and reports the bad one (partial failure)", async () => {
    const db = getTestDb();
    const tech = await createTestUser(db, { role: "technician" });
    const m = await createTestMachine(db, {
      initials: "GP",
      name: "Grand Prix",
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });

    const { submitBulkIssuesAction } =
      await import("~/app/(app)/report/bulk/actions");
    const res = await submitBulkIssuesAction([
      row({ machineId: m.id, title: "Good row" }),
      row({ machineId: randomUUID(), title: "Bad machine" }), // uuid, but no such machine
      row({ machineId: "not-a-uuid", title: "Invalid" }), // fails schema
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.results[0]).toMatchObject({ index: 0, ok: true });
      expect(res.results[1]).toMatchObject({ index: 1, ok: false });
      expect(res.results[2]).toMatchObject({ index: 2, ok: false });
    }
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(1);
  });

  it("is idempotent on a repeated idempotency key", async () => {
    const db = getTestDb();
    const tech = await createTestUser(db, { role: "technician" });
    const m = await createTestMachine(db, {
      initials: "GP",
      name: "Grand Prix",
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });
    const key = randomUUID();

    const { submitBulkIssueRowAction } =
      await import("~/app/(app)/report/bulk/actions");
    const first = await submitBulkIssueRowAction(
      row({ machineId: m.id, idempotencyKey: key }) as never
    );
    const second = await submitBulkIssueRowAction(
      row({ machineId: m.id, idempotencyKey: key }) as never
    );
    expect(first.ok && second.ok).toBe(true);
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(1);
  });

  it("rejects a batch over the soft cap", async () => {
    const db = getTestDb();
    const tech = await createTestUser(db, { role: "technician" });
    const m = await createTestMachine(db, {
      initials: "GP",
      name: "Grand Prix",
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });

    const { submitBulkIssuesAction } =
      await import("~/app/(app)/report/bulk/actions");
    const many = Array.from({ length: 51 }, () => row({ machineId: m.id }));
    const res = await submitBulkIssuesAction(many);
    expect(res.ok).toBe(false);
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project integration src/test/integration/bulk-report-action.test.ts`
Expected: FAIL — cannot import `~/app/(app)/report/bulk/actions`.

- [ ] **Step 3: Implement the actions**

Create `src/app/(app)/report/bulk/actions.ts`:

```typescript
"use server";

import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createIssue } from "~/services/issues";
import { dispatchNotification } from "~/lib/notifications";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { reportError } from "~/lib/observability/report-error";
import { log } from "~/lib/logger";
import { parseBulkRow, type ParsedBulkRow } from "./validation";
import { BULK_MAX_ROWS, type BulkRowInput } from "./schemas";

export type BulkRowResult =
  | { index: number; ok: true; issueNumber: number; machineInitials: string }
  | { index: number; ok: false; error: string };

export type BulkSubmitResponse =
  | { ok: true; results: BulkRowResult[] }
  | { ok: false; error: string };

/** Resolve the current user's technician+ access, or null if not permitted. */
async function requireBulkReporter(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);
  if (!checkPermission("issues.report.bulk", accessLevel)) return null;
  return { userId: user.id };
}

/** Create a single validated row. Never throws for a row-level problem —
 *  returns an `ok: false` result the caller surfaces inline. */
async function createOne(
  index: number,
  rawRow: BulkRowInput,
  reportedBy: string
): Promise<BulkRowResult> {
  const parsed: ParsedBulkRow = parseBulkRow(rawRow);
  if (!parsed.success) return { index, ok: false, error: parsed.error };
  const data = parsed.data;

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, data.machineId),
    columns: { initials: true },
  });
  if (!machine) {
    return {
      index,
      ok: false,
      error: "Machine not found — pick one from the list",
    };
  }

  try {
    const { issue, deliveryPlan } = await createIssue({
      title: data.title,
      description: data.description ? plainTextToDoc(data.description) : null,
      machineInitials: machine.initials,
      severity: data.severity,
      priority: data.priority,
      frequency: data.frequency,
      status: data.status,
      reportedBy,
      reporterName: null,
      reporterEmail: null,
      assignedTo:
        data.assignedTo && data.assignedTo.length > 0 ? data.assignedTo : null,
      autoWatchReporter: data.watch,
      idempotencyKey: data.idempotencyKey,
    });

    after(() => dispatchNotification(deliveryPlan));

    revalidatePath("/m");
    revalidatePath(`/m/${machine.initials}`);
    revalidatePath(`/m/${machine.initials}/i`);

    return {
      index,
      ok: true,
      issueNumber: issue.issueNumber,
      machineInitials: machine.initials,
    };
  } catch (error) {
    reportError(error, { action: "submitBulkIssueRow", index });
    log.error(
      { index, err: error instanceof Error ? error.message : error },
      "Bulk row create failed"
    );
    return {
      index,
      ok: false,
      error: "Could not create this issue — try again",
    };
  }
}

/** Batch submit. Creates each good row; bad rows come back flagged. */
export async function submitBulkIssuesAction(
  rows: BulkRowInput[]
): Promise<BulkSubmitResponse> {
  try {
    const reporter = await requireBulkReporter();
    if (!reporter)
      return { ok: false, error: "You don't have permission to bulk report." };
    if (rows.length === 0) return { ok: false, error: "No issues to submit." };
    if (rows.length > BULK_MAX_ROWS) {
      return {
        ok: false,
        error: `Too many rows — submit at most ${BULK_MAX_ROWS} at a time.`,
      };
    }

    const results: BulkRowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) {
        results.push({ index: i, ok: false, error: "Empty row" });
        continue;
      }
      results.push(await createOne(i, row, reporter.userId));
    }
    return { ok: true, results };
  } finally {
    await Sentry.flush(2000);
  }
}

/** Single-row submit (quick-submit). */
export async function submitBulkIssueRowAction(
  row: BulkRowInput
): Promise<BulkRowResult> {
  try {
    const reporter = await requireBulkReporter();
    if (!reporter)
      return {
        index: 0,
        ok: false,
        error: "You don't have permission to bulk report.",
      };
    return await createOne(0, row, reporter.userId);
  } finally {
    await Sentry.flush(2000);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project integration src/test/integration/bulk-report-action.test.ts`
Expected: PASS (all 5 blocks: forbids member, creates all good, partial failure, idempotency, soft cap).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/report/bulk/actions.ts" src/test/integration/bulk-report-action.test.ts
git commit -m "feat(bulk-report): single + batch submit server actions (PP-sn34)

Technician+ gate, createIssue reuse, partial-failure keeps bad rows,
idempotency + 50-row soft cap.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: MachineCombobox — searchable machine picker

**Files:**

- Create: `src/components/machines/MachineCombobox.tsx`
- Test: `src/components/machines/MachineCombobox.test.tsx`

**Interfaces:**

- Consumes: `~/components/ui/command`, `~/components/ui/popover`, `~/components/ui/button`.
- Produces:

  ```typescript
  interface MachineOption {
    id: string;
    name: string;
    initials: string;
  }
  interface MachineComboboxProps {
    machines: MachineOption[];
    value: string; // selected machineId, "" when none
    onValueChange: (machineId: string) => void;
    id?: string;
    placeholder?: string; // default "Select a machine…"
    disabled?: boolean;
  }
  export function MachineCombobox(
    props: MachineComboboxProps
  ): React.JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/machines/MachineCombobox.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineCombobox } from "./MachineCombobox";

const machines = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Grand Prix",
    initials: "GP",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Future Spa",
    initials: "FS",
  },
];

describe("MachineCombobox", () => {
  it("shows the placeholder when nothing is selected", () => {
    render(
      <MachineCombobox machines={machines} value="" onValueChange={vi.fn()} />
    );
    expect(screen.getByText("Select a machine…")).toBeInTheDocument();
  });

  it("filters and selects a machine", async () => {
    const onValueChange = vi.fn();
    render(
      <MachineCombobox
        machines={machines}
        value=""
        onValueChange={onValueChange}
      />
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(
      screen.getByPlaceholderText(/search machines/i),
      "future"
    );
    await userEvent.click(screen.getByText(/Future Spa/));
    expect(onValueChange).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222"
    );
  });

  it("renders the selected machine's name", () => {
    render(
      <MachineCombobox
        machines={machines}
        value={machines[0]!.id}
        onValueChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Grand Prix/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/machines/MachineCombobox.test.tsx`
Expected: FAIL — module `./MachineCombobox` not found.

- [ ] **Step 3: Implement the component**

Create `src/components/machines/MachineCombobox.tsx`:

```tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export interface MachineOption {
  id: string;
  name: string;
  initials: string;
}

interface MachineComboboxProps {
  machines: MachineOption[];
  value: string;
  onValueChange: (machineId: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function MachineCombobox({
  machines,
  value,
  onValueChange,
  id,
  placeholder = "Select a machine…",
  disabled = false,
}: MachineComboboxProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const selected = machines.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected ? `${selected.name} (${selected.initials})` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search machines…" />
          <CommandList>
            <CommandEmpty>No machine found.</CommandEmpty>
            <CommandGroup>
              {machines.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name} ${m.initials}`}
                  onSelect={() => {
                    onValueChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      m.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {m.name} ({m.initials})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

> If `~/components/ui/popover` does not yet exist, add it first with
> `pnpm dlx shadcn@latest add popover` and commit that in this task. Verify with
> `ls src/components/ui/popover.tsx` before implementing. `command.tsx` already exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/machines/MachineCombobox.test.tsx`
Expected: PASS (placeholder, filter+select, selected label).

- [ ] **Step 5: Commit**

```bash
git add src/components/machines/MachineCombobox.tsx src/components/machines/MachineCombobox.test.tsx src/components/ui/popover.tsx
git commit -m "feat(bulk-report): searchable MachineCombobox picker (PP-sn34)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Bulk report page (Server Component, access gate + data)

**Files:**

- Create: `src/app/(app)/report/bulk/page.tsx`
- Create: `e2e/smoke/bulk-report.spec.ts`

**Interfaces:**

- Consumes: `checkPermission`, `getAccessLevel`, `Forbidden`, `MachineOption` (Task 4), and (Task 6) `BulkReportGrid` with props `{ machines: MachineOption[]; assignees: { id: string; name: string | null }[] }`.
- Produces: the `/report/bulk` route.

- [ ] **Step 1: Write the failing smoke spec**

Create `e2e/smoke/bulk-report.spec.ts` (uses the existing auth fixtures; follow the auth pattern in a sibling smoke spec such as `e2e/smoke/issues-crud.spec.ts` for how to sign in as a role):

```typescript
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth"; // match the helper used by sibling smoke specs

test.describe("bulk report page", () => {
  test("renders the grid for a technician", async ({ page }) => {
    await loginAs(page, "technician");
    await page.goto("/report/bulk");
    await expect(
      page.getByRole("heading", { name: /bulk report/i })
    ).toBeVisible();
    await expect(page.getByTestId("bulk-report-grid")).toBeVisible();
  });

  test("forbids a member", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/report/bulk");
    await expect(
      page.getByText(/don.t have permission|forbidden/i)
    ).toBeVisible();
  });
});
```

> Before writing, open a sibling smoke spec and copy its exact auth/login
> mechanism (helper name + role fixtures). Adjust `loginAs`/role names to match.

- [ ] **Step 2: Run the spec to verify it fails**

Run: `pnpm exec playwright test e2e/smoke/bulk-report.spec.ts --project=chromium`
Expected: FAIL — `/report/bulk` 404s (route doesn't exist).

- [ ] **Step 3: Implement the page**

Create `src/app/(app)/report/bulk/page.tsx`:

```tsx
import type React from "react";
import { asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getLoginUrl } from "~/lib/url";
import { Forbidden } from "~/components/errors/Forbidden";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { BulkReportGrid } from "./bulk-report-grid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function BulkReportPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(getLoginUrl("/report/bulk"));

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);

  if (!checkPermission("issues.report.bulk", accessLevel)) {
    return <Forbidden role={profile?.role ?? null} />;
  }

  const [machinesList, assignees] = await Promise.all([
    db.query.machines.findMany({
      orderBy: asc(machines.name),
      columns: { id: true, name: true, initials: true },
    }),
    db.query.userProfiles.findMany({
      where: (p) =>
        sql`${p.role} = 'admin' OR ${p.role} = 'member' OR ${p.role} = 'technician'`,
      columns: { id: true, name: true },
      orderBy: asc(userProfiles.name),
    }),
  ]);

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Bulk Report"
        description="Log several machine issues at once, then submit them individually or all together."
      />
      <BulkReportGrid machines={machinesList} assignees={assignees} />
    </PageContainer>
  );
}
```

> Verify `PageContainer` accepts `size="wide"`; if not, use the widest supported
> value (`grep -n "size" src/components/layout/PageContainer.tsx`).

- [ ] **Step 4: Create a minimal `BulkReportGrid` stub so the page compiles**

Create `src/app/(app)/report/bulk/bulk-report-grid.tsx` (replaced fully in Task 6):

```tsx
"use client";
import type React from "react";
import type { MachineOption } from "~/components/machines/MachineCombobox";

interface BulkReportGridProps {
  machines: MachineOption[];
  assignees: { id: string; name: string | null }[];
}

export function BulkReportGrid(_props: BulkReportGridProps): React.JSX.Element {
  return <div data-testid="bulk-report-grid" />;
}
```

- [ ] **Step 5: Run the smoke spec to verify it passes**

Run: `pnpm exec playwright test e2e/smoke/bulk-report.spec.ts --project=chromium`
Expected: PASS (technician sees heading + grid; member sees Forbidden).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/report/bulk/page.tsx" "src/app/(app)/report/bulk/bulk-report-grid.tsx" e2e/smoke/bulk-report.spec.ts
git commit -m "feat(bulk-report): /report/bulk page with technician+ gate + data fetch (PP-sn34)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Bulk report grid (client) — rows, reflow, quick-submit, submit-all

**Files:**

- Modify (replace stub): `src/app/(app)/report/bulk/bulk-report-grid.tsx`
- Create: `src/app/(app)/report/bulk/bulk-report-grid.test.tsx`

**Interfaces:**

- Consumes: `MachineCombobox`/`MachineOption` (Task 4); `SeveritySelect`, `PrioritySelect`, `StatusSelect`, `FrequencySelect` (`~/components/issues/fields/*`); `submitBulkIssuesAction`, `submitBulkIssueRowAction`, `BulkRowResult` (Task 3); `BulkRowInput` (Task 2).
- Produces: the interactive grid used by `page.tsx`.

**Design reference:** `docs/superpowers/specs/2026-07-12-bulk-report-prototype.html` — the reflow, the two submit paths, and the confirmation strip are all demonstrated there.

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/report/bulk/bulk-report-grid.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkReportGrid } from "./bulk-report-grid";

const submitRow = vi.fn();
const submitAll = vi.fn();
vi.mock("./actions", () => ({
  submitBulkIssueRowAction: (...a: unknown[]) => submitRow(...a),
  submitBulkIssuesAction: (...a: unknown[]) => submitAll(...a),
}));

const machines = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Grand Prix",
    initials: "GP",
  },
];
const assignees = [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Tim" }];

describe("BulkReportGrid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with one empty row and can add more", async () => {
    render(<BulkReportGrid machines={machines} assignees={assignees} />);
    expect(screen.getAllByTestId("bulk-row")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /add issue/i }));
    expect(screen.getAllByTestId("bulk-row")).toHaveLength(2);
  });

  it("expands and collapses a row", async () => {
    render(<BulkReportGrid machines={machines} assignees={assignees} />);
    const row = screen.getByTestId("bulk-row");
    expect(within(row).queryByText(/description/i)).not.toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: /more/i }));
    expect(within(row).getByText(/description/i)).toBeInTheDocument();
  });

  it("quick-submits a row and shows the confirmation strip", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: true,
      issueNumber: 42,
      machineInitials: "GP",
    });
    render(<BulkReportGrid machines={machines} assignees={assignees} />);
    const row = screen.getByTestId("bulk-row");
    // machine + problem
    await userEvent.click(within(row).getByRole("combobox"));
    await userEvent.click(screen.getByText(/Grand Prix/));
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/Created #42/)).toBeInTheDocument();
  });

  it("keeps a bad row flagged after submit-all partial failure", async () => {
    submitAll.mockResolvedValue({
      ok: true,
      results: [
        {
          index: 0,
          ok: false,
          error: "Machine not found — pick one from the list",
        },
      ],
    });
    render(<BulkReportGrid machines={machines} assignees={assignees} />);
    await userEvent.type(
      screen.getByLabelText(/problem/i),
      "No machine picked"
    );
    await userEvent.click(screen.getByRole("button", { name: /submit all/i }));
    expect(await screen.findByText(/Machine not found/)).toBeInTheDocument();
    expect(screen.getByTestId("bulk-row")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/(app)/report/bulk/bulk-report-grid.test.tsx"`
Expected: FAIL — the stub renders only an empty `div`.

- [ ] **Step 3: Implement the grid**

Replace `src/app/(app)/report/bulk/bulk-report-grid.tsx` with the full implementation. Translate the prototype's reflow + submit model to React using the shared field selects. Key requirements the tests pin:

- each row wrapper has `data-testid="bulk-row"`;
- an "Add issue" button appends a blank row (with a fresh `crypto.randomUUID()` idempotency key);
- collapsed shows machine + severity + priority + a **More** toggle (line 1) and the problem input + **Submit** (line 2); the problem input is labelled "Problem (issue title)";
- expanded shows machine + problem (line 1), severity/priority/status/frequency (line 2), description (line 3), assignee/watch/**Submit** (line 4);
- per-row **Submit** calls `submitBulkIssueRowAction(row)`; on `ok` the row becomes a confirmation strip showing `Created #<n>` with an **Undo** control; on `!ok` the row keeps an inline error;
- **Submit all** calls `submitBulkIssuesAction(readyRows)`; apply each `BulkRowResult` back to its row by `index` (success → confirmation strip, failure → inline error).

```tsx
"use client";

import * as React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { ChevronDown, Check } from "lucide-react";
import {
  MachineCombobox,
  type MachineOption,
} from "~/components/machines/MachineCombobox";
import { SeveritySelect } from "~/components/issues/fields/SeveritySelect";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { StatusSelect } from "~/components/issues/fields/StatusSelect";
import { FrequencySelect } from "~/components/issues/fields/FrequencySelect";
import type {
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
  IssueStatus,
} from "~/lib/types";
import {
  submitBulkIssueRowAction,
  submitBulkIssuesAction,
  type BulkRowResult,
} from "./actions";
import type { BulkRowInput } from "./schemas";

interface RowState {
  key: string; // React key + idempotencyKey (uuid)
  machineId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  priority: IssuePriority;
  status: IssueStatus;
  frequency: IssueFrequency;
  assignedTo: string;
  watch: boolean;
  open: boolean;
  submitting: boolean;
  submitted: null | { issueNumber: number; machineInitials: string };
  error: string | null;
}

function blankRow(): RowState {
  return {
    key: crypto.randomUUID(),
    machineId: "",
    title: "",
    description: "",
    severity: "minor",
    priority: "medium",
    status: "new",
    frequency: "intermittent",
    assignedTo: "",
    watch: true,
    open: false,
    submitting: false,
    submitted: null,
    error: null,
  };
}

function toInput(r: RowState): BulkRowInput {
  return {
    machineId: r.machineId,
    title: r.title,
    description: r.description,
    severity: r.severity,
    priority: r.priority,
    frequency: r.frequency,
    status: r.status,
    assignedTo: r.assignedTo,
    watch: r.watch,
    idempotencyKey: r.key,
  };
}

interface BulkReportGridProps {
  machines: MachineOption[];
  assignees: { id: string; name: string | null }[];
}

export function BulkReportGrid({
  machines,
  assignees,
}: BulkReportGridProps): React.JSX.Element {
  const [rows, setRows] = React.useState<RowState[]>(() => [blankRow()]);

  const patch = (key: string, next: Partial<RowState>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...next } : r)));

  const readyCount = rows.filter(
    (r) => !r.submitted && (r.machineId || r.title)
  ).length;

  const applyResult = (key: string, res: BulkRowResult) =>
    patch(
      key,
      res.ok
        ? {
            submitting: false,
            error: null,
            open: false,
            submitted: {
              issueNumber: res.issueNumber,
              machineInitials: res.machineInitials,
            },
          }
        : { submitting: false, error: res.error }
    );

  async function submitOne(row: RowState) {
    patch(row.key, { submitting: true, error: null });
    const res = await submitBulkIssueRowAction(toInput(row));
    applyResult(row.key, res);
  }

  async function submitAll() {
    const ready = rows.filter((r) => !r.submitted && (r.machineId || r.title));
    if (ready.length === 0) return;
    setRows((rs) =>
      rs.map((r) =>
        ready.includes(r) ? { ...r, submitting: true, error: null } : r
      )
    );
    const res = await submitBulkIssuesAction(ready.map(toInput));
    if (!res.ok) {
      setRows((rs) =>
        rs.map((r) =>
          ready.includes(r) ? { ...r, submitting: false, error: res.error } : r
        )
      );
      return;
    }
    // Map results back by index into `ready`.
    res.results.forEach((result) => {
      const target = ready[result.index];
      if (target) applyResult(target.key, result);
    });
  }

  return (
    <div>
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-2">
        {rows.map((r) => (
          <BulkRow
            key={r.key}
            row={r}
            machines={machines}
            assignees={assignees}
            onPatch={(next) => patch(r.key, next)}
            onSubmit={() => submitOne(r)}
            onUndo={() => patch(r.key, { submitted: null })}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, blankRow()])}
        className="mt-2 w-full rounded-xl border border-dashed border-outline-variant bg-surface p-3 text-sm text-primary hover:bg-primary/5"
      >
        + Add issue
      </button>

      <div className="sticky bottom-0 mt-4 flex items-center justify-between rounded-xl border border-outline-variant bg-card p-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{readyCount}</span>{" "}
          ready · {rows.filter((r) => r.submitted).length} submitted
          <span className="ml-2 text-xs">Rate limit bypassed for techs+</span>
        </p>
        <Button type="button" onClick={submitAll} disabled={readyCount === 0}>
          {readyCount ? `Submit all (${readyCount})` : "Submit all"}
        </Button>
      </div>
    </div>
  );
}

interface BulkRowProps {
  row: RowState;
  machines: MachineOption[];
  assignees: { id: string; name: string | null }[];
  onPatch: (next: Partial<RowState>) => void;
  onSubmit: () => void;
  onUndo: () => void;
}

function BulkRow({
  row,
  machines,
  assignees,
  onPatch,
  onSubmit,
  onUndo,
}: BulkRowProps): React.JSX.Element {
  if (row.submitted) {
    return (
      <div
        data-testid="bulk-row"
        className="m-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            <Check className="size-3" />
          </span>
          <span className="font-semibold">
            {row.machineId
              ? machines.find((m) => m.id === row.machineId)?.name
              : ""}
          </span>
          <span>— {row.title}</span>
          <span className="text-muted-foreground">
            · Created #{row.submitted.issueNumber}
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
          >
            Undo
          </button>
        </div>
      </div>
    );
  }

  const submitBtn = (
    <Button
      type="button"
      variant="outline"
      disabled={row.submitting}
      onClick={onSubmit}
      className="border-primary text-primary hover:bg-primary/10"
    >
      {row.submitting ? "Submitting…" : "Submit"}
    </Button>
  );

  return (
    <div
      data-testid="bulk-row"
      className={cn(
        "m-2 rounded-xl border p-3",
        row.error ? "border-destructive" : "border-outline-variant",
        "bg-card"
      )}
    >
      {!row.open ? (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_170px_150px_auto] items-end gap-2.5">
            <Field label="Machine">
              <MachineCombobox
                machines={machines}
                value={row.machineId}
                onValueChange={(id) => onPatch({ machineId: id })}
              />
            </Field>
            <Field label="Severity">
              <SeveritySelect
                value={row.severity}
                onValueChange={(v) => onPatch({ severity: v })}
              />
            </Field>
            <Field label="Priority">
              <PrioritySelect
                value={row.priority}
                onValueChange={(v) => onPatch({ priority: v })}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => onPatch({ open: true })}
            >
              More <ChevronDown className="ml-1 size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
            <Field label="Problem (issue title)">
              <Input
                value={row.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder="What's wrong…"
                maxLength={60}
              />
            </Field>
            {submitBtn}
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[minmax(0,240px)_1fr_auto] items-end gap-2.5">
            <Field label="Machine">
              <MachineCombobox
                machines={machines}
                value={row.machineId}
                onValueChange={(id) => onPatch({ machineId: id })}
              />
            </Field>
            <Field label="Problem (issue title)">
              <Input
                value={row.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder="What's wrong…"
                maxLength={60}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Collapse"
              onClick={() => onPatch({ open: false })}
            >
              <ChevronDown className="size-4 rotate-180" />
            </Button>
          </div>
          <div className="grid grid-cols-4 items-end gap-2.5">
            <Field label="Severity">
              <SeveritySelect
                value={row.severity}
                onValueChange={(v) => onPatch({ severity: v })}
              />
            </Field>
            <Field label="Priority">
              <PrioritySelect
                value={row.priority}
                onValueChange={(v) => onPatch({ priority: v })}
              />
            </Field>
            <Field label="Status">
              <StatusSelect
                value={row.status}
                onValueChange={(v) => onPatch({ status: v })}
              />
            </Field>
            <Field label="Frequency">
              <FrequencySelect
                value={row.frequency}
                onValueChange={(v) => onPatch({ frequency: v })}
              />
            </Field>
          </div>
          <Field label="Description (optional)">
            <Textarea
              value={row.description}
              onChange={(e) => onPatch({ description: e.target.value })}
              placeholder="Extra detail…"
            />
          </Field>
          <div className="grid grid-cols-[minmax(220px,340px)_auto_1fr] items-end gap-4">
            <Field label="Assignee">
              <select
                value={row.assignedTo}
                onChange={(e) => onPatch({ assignedTo: e.target.value })}
                className="h-9 w-full rounded-md border border-outline-variant bg-surface px-3 text-sm"
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? "Unnamed"}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch
                checked={row.watch}
                onCheckedChange={(v) => onPatch({ watch: v })}
              />{" "}
              Watch
            </label>
            <div className="justify-self-end">{submitBtn}</div>
          </div>
        </div>
      )}
      {row.error ? (
        <p className="mt-2 text-xs text-destructive">{row.error}</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const id = React.useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label
        htmlFor={id}
        className="text-[10px] uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
            id,
          })
        : children}
    </div>
  );
}
```

> Notes for the implementer:
>
> - `Switch`, `Textarea`, `Input`, `Label`, `Button` are existing shadcn primitives
>   (`ls src/components/ui/`). If `switch.tsx` or `textarea.tsx` is missing, add via
>   `pnpm dlx shadcn@latest add switch textarea` and include in this commit.
> - The `Field` label wiring via `htmlFor`/`id` is what lets the tests use
>   `getByLabelText(/problem/i)`. Keep the label text exactly "Problem (issue title)".
> - Do not put real emails in the assignee options (names only — CORE-SEC-007).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run "src/app/(app)/report/bulk/bulk-report-grid.test.tsx"`
Expected: PASS (add row, expand/collapse, quick-submit confirmation, partial-failure keeps flagged row).

- [ ] **Step 5: Typecheck + lint the new surface**

Run: `pnpm run typecheck && pnpm run lint`
Expected: clean (no `any`, no unused, path aliases correct).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/report/bulk/bulk-report-grid.tsx" "src/app/(app)/report/bulk/bulk-report-grid.test.tsx" src/components/ui/switch.tsx src/components/ui/textarea.tsx
git commit -m "feat(bulk-report): interactive authoring grid — reflow, quick-submit, submit-all (PP-sn34)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Discoverability — link to the bulk page for techs+

**Files:**

- Modify: `src/app/(app)/report/page.tsx` (add a link to `/report/bulk`, shown only when the viewer is technician+)
- Test: (covered by the existing smoke; add one assertion to `e2e/smoke/bulk-report.spec.ts`)

**Interfaces:**

- Consumes: `checkPermission`, `getAccessLevel` (already imported in `page.tsx`).

- [ ] **Step 1: Add the link (gated)**

In `src/app/(app)/report/page.tsx`, after computing `accessLevel`, compute
`const canBulk = checkPermission("issues.report.bulk", accessLevel);` (import
`checkPermission` alongside the existing `getAccessLevel` import) and render a link
in the header area when `canBulk`:

```tsx
{
  canBulk ? (
    <Link href="/report/bulk" className="text-sm font-medium text-link">
      Reporting several at once? Use bulk report →
    </Link>
  ) : null;
}
```

(Place it directly under `<PageHeader title="Report an Issue" />`, wrapped in a
`<div className="mb-4">` if needed to match the page's spacing. Import `Link from "next/link"` if not already imported.)

- [ ] **Step 2: Extend the smoke spec**

Append to `e2e/smoke/bulk-report.spec.ts`:

```typescript
test("is linked from the single report page for a technician", async ({
  page,
}) => {
  await loginAs(page, "technician");
  await page.goto("/report");
  await page.getByRole("link", { name: /bulk report/i }).click();
  await expect(page).toHaveURL(/\/report\/bulk$/);
});
```

- [ ] **Step 3: Run the smoke spec**

Run: `pnpm exec playwright test e2e/smoke/bulk-report.spec.ts --project=chromium`
Expected: PASS (all three cases).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/report/page.tsx" e2e/smoke/bulk-report.spec.ts
git commit -m "feat(bulk-report): link to /report/bulk from the single report page (techs+) (PP-sn34)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Full preflight + PR

**Files:** none (verification + landing).

- [ ] **Step 1: Preflight**

Run: `pnpm run preflight`
Expected: check (types/lint/format/unit) + build + integration all green. Fix anything that fails, re-run.

- [ ] **Step 2: Targeted smoke**

Run: `pnpm run smoke`
Expected: green (the new bulk-report smoke plus existing suite).

- [ ] **Step 3: Push + open PR (ready-for-review)**

```bash
git push -u origin feat/bulk-report-PP-sn34
```

Open the PR ready-for-review (not draft). Body: link the spec + prototype, summarize
the design decisions (technician+ gate, rate-limit bypass, per-row + submit-all,
partial-failure keeps bad rows), and reference PP-sn34. Include the
`🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer.

- [ ] **Step 4: Land per `pinpoint-pr-workflow`** — wait for Copilot review on the head commit, resolve/decline threads, merge via `scripts/workflow/merge-pr.sh <PR>`, watch the prod deploy, then close PP-sn34.

---

## Self-Review

**Spec coverage:**

- Route + technician+ gate → Task 1 (permission), Task 5 (page gate). ✓
- Row reflow layout (collapsed 2-line / expanded 4-line) → Task 6. ✓
- Fields incl. machine searchable select, no photo upload → Task 4 (combobox), Task 6 (fields; images absent). ✓
- Per-row quick-submit + submit-all → Task 3 (actions), Task 6 (UI). ✓
- Partial failure creates good rows, keeps bad flagged → Task 3 (results model), Task 6 (apply-by-index). ✓
- Rate-limit bypass + no CAPTCHA + soft cap → Task 3 (`requireBulkReporter` uses no limiter; `BULK_MAX_ROWS`). ✓
- Reuse `createIssue`, idempotency, reporter = tech, techs set all fields → Task 3. ✓
- Notifications post-commit via `after()` → Task 3. ✓
- Tests: integration/RTL/smoke → Tasks 3, 4, 6, 5/7. ✓
- Discoverability → Task 7. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Two `>`-quoted implementer notes (verify `PageContainer size`, confirm shadcn primitive existence, copy the exact smoke auth helper) are pre-flight verifications with concrete commands, not deferred work.

**Type consistency:** `BulkRowInput` (Task 2) is consumed unchanged by Task 3 (`createOne`) and Task 6 (`toInput`). `BulkRowResult`/`BulkSubmitResponse` (Task 3) are consumed by Task 6 (`applyResult`). `MachineOption` (Task 4) flows to Tasks 5 and 6. Field-select `onValueChange` signatures match `~/components/issues/fields/*`. Permission id `"issues.report.bulk"` is identical across Tasks 1, 3, 5, 7.
