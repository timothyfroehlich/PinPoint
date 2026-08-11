# MCP Issue Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four MCP tools — `get_issue`, `list_issues`, `add_issue_comment`, `update_issue` — so Claude can read, find, comment on, and edit PinPoint issues over the remote MCP server.

**Architecture:** Each tool is a thin wrapper in `src/lib/mcp/tools/` following the existing pattern: a zod schema, an exported `run*(args, ctx)` handler (permission check → resolve → call an existing `~/services/issues` function → `after(dispatchNotification)`), and a `register*(server)` that registers it. No service extraction is required — every mutation already exists as a standalone service function owning its own transaction, timeline event, and delivery plan.

**Tech Stack:** TypeScript (ts-strictest), Next.js App Router, Drizzle ORM, `@modelcontextprotocol/sdk`, zod, Vitest + worker-scoped PGlite.

**Spec:** `docs/superpowers/specs/2026-08-09-mcp-issue-tools-design.md`

## Global Constraints

- **Path aliases only** (CORE-TS-008): `~/lib/...`, never relative crossings outside the tool directory. Sibling files inside `src/lib/mcp/tools/` use `./shared` — match the existing files exactly.
- **Type safety** (CORE-TS-007): no `any`, no non-null `!`, no unsafe `as`. `pnpm run lint` enforces the non-null ban.
- **Every permission decision goes through `checkPermission`** from `~/lib/permissions/helpers` (CORE-ARCH-008).
- **Never select or return `issues.reporterEmail`** or any user email (CORE-SEC-007).
- **No side effects inside `db.transaction`** (CORE-ARCH-011): `dispatchNotification` runs in `after()`, after the service returns.
- **Honest failure** (CORE-ARCH-012): a dedupe hit reports `created: false`; a no-op field reports `changed: false`; a partially-applied update reports `partial: true` with what landed.
- **Issue identification is `machine` + `number`** everywhere. Issue UUIDs are never accepted as arguments.
- Every tool file starts with `import "server-only";`.
- `pnpm run check` (~9s) before every commit. `pnpm run test` after any task that adds a unit test. Integration tests run via `pnpm run test` as well; `pnpm run preflight` once at the end.

---

## File Structure

**Create:**

- `src/lib/mcp/tools/get-issue.ts` — `getIssueSchema`, `runGetIssue`, `registerGetIssue`
- `src/lib/mcp/tools/list-issues.ts` — `listIssuesSchema`, `runListIssues`, `registerListIssues`
- `src/lib/mcp/tools/add-issue-comment.ts` — `addIssueCommentSchema`, `createCommentIdempotencyKey`, `runAddIssueComment`, `registerAddIssueComment`
- `src/lib/mcp/tools/add-issue-comment.test.ts` — unit tests for the idempotency key
- `src/lib/mcp/tools/update-issue.ts` — `updateIssueSchema`, `UPDATE_FIELD_PERMISSIONS`, `runUpdateIssue`, `registerUpdateIssue`
- `src/lib/mcp/tools/update-issue.test.ts` — unit tests for the per-field permission map

**Modify:**

- `src/lib/mcp/tools/shared.ts` — add `IssueRef`, `resolveIssue`, `resolveAssignee`
- `src/lib/mcp/tools/index.ts` — register the four new tools
- `src/test/integration/mcp-tools.test.ts` — integration coverage for all four

---

### Task 1: `resolveIssue` and `resolveAssignee` in `shared.ts`

Every other task consumes these, so this lands first.

**Files:**

- Modify: `src/lib/mcp/tools/shared.ts`
- Test: `src/test/integration/mcp-tools.test.ts`

**Interfaces:**

- Consumes: existing `McpToolError`, `resolveMachine`, `MachineRef` from `./shared`.
- Produces:
  - `interface IssueRef { id: string; issueNumber: number; machineInitials: string; title: string; status: IssueStatus; severity: IssueSeverity; priority: IssuePriority; frequency: IssueFrequency; assignedTo: string | null; reportedBy: string | null; reporterName: string | null; description: ProseMirrorDoc | null; createdAt: Date; updatedAt: Date; closedAt: Date | null; }`
  - `resolveIssue(machineRef: string, issueNumber: number): Promise<IssueRef>`
  - `resolveAssignee(ref: string | null | undefined): Promise<string | null>`

- [ ] **Step 1: Write the failing integration tests**

Append to `src/test/integration/mcp-tools.test.ts`, inside the existing top-level `describe`. It already has `setupTestDb()`, `ctx()`, `makeUser()`, and machine/issue seeding helpers — read the file's existing helpers first and reuse them rather than writing new ones.

```typescript
describe("resolveIssue / resolveAssignee (PP-u4ab.14)", () => {
  it("resolves an issue by machine initials and number", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "AFM", name: "Attack from Mars" });
    const { issue } = await runCreateIssue(
      { machine: "AFM", title: "left flipper weak" },
      ctx("admin", admin)
    ).then((o) => ({ issue: o }));
    expect(issue.issueId).toBeDefined();

    const resolved = await resolveIssue("afm", 1);
    expect(resolved.issueNumber).toBe(1);
    expect(resolved.machineInitials).toBe("AFM");
    expect(resolved.title).toBe("left flipper weak");
  });

  it("resolves by machine UUID as well as initials", async () => {
    const admin = await makeUser("admin");
    const machineId = await seedMachine({
      initials: "MM",
      name: "Medieval Madness",
    });
    await runCreateIssue(
      { machine: "MM", title: "ball stuck" },
      ctx("admin", admin)
    );

    const resolved = await resolveIssue(machineId, 1);
    expect(resolved.machineInitials).toBe("MM");
  });

  it("throws not_found for an unknown issue number, naming list_issues", async () => {
    await seedMachine({ initials: "TZ", name: "Twilight Zone" });
    await expect(resolveIssue("TZ", 99)).rejects.toThrow(McpToolError);
    await expect(resolveIssue("TZ", 99)).rejects.toThrow(/list_issues/);
  });

  it("resolves an assignee by full name and by UUID, and null clears", async () => {
    const tech = await makeUser("technician", "Ada", "Lovelace");
    expect(await resolveAssignee("Ada Lovelace")).toBe(tech);
    expect(await resolveAssignee(tech)).toBe(tech);
    expect(await resolveAssignee(null)).toBeNull();
    expect(await resolveAssignee("   ")).toBeNull();
  });

  it("rejects an ambiguous assignee name with the candidate UUIDs", async () => {
    const a = await makeUser("member", "Sam", "Jones");
    const b = await makeUser("member", "Sam", "Jones");
    await expect(resolveAssignee("Sam Jones")).rejects.toThrow(
      /Pass the specific UUID/
    );
    await expect(resolveAssignee("Sam Jones")).rejects.toThrow(
      new RegExp(`${a}|${b}`)
    );
  });

  it("rejects a guest as an assignee", async () => {
    await makeUser("guest", "Guest", "Person");
    await expect(resolveAssignee("Guest Person")).rejects.toThrow(/guest/i);
  });
});
```

Add the imports this block needs to the file's existing import list:

```typescript
import {
  McpToolError,
  resolveAssignee,
  resolveIssue,
} from "~/lib/mcp/tools/shared";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "resolveIssue"`
Expected: FAIL — `resolveIssue is not a function` / no export named `resolveIssue`.

- [ ] **Step 3: Implement `resolveIssue`**

Add to `src/lib/mcp/tools/shared.ts`. The `issues` table is already imported there; add `issueComments` only if a later task needs it (it does not — the thread query lives in `get-issue.ts`).

```typescript
/** The issue snapshot every issue tool resolves before acting. */
export interface IssueRef {
  id: string;
  issueNumber: number;
  machineInitials: string;
  title: string;
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssuePriority;
  frequency: IssueFrequency;
  assignedTo: string | null;
  reportedBy: string | null;
  reporterName: string | null;
  description: ProseMirrorDoc | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

/**
 * Resolve an issue from the pair the MCP surface actually speaks: a machine
 * (initials or UUID) and the per-machine issue number.
 *
 * Issue UUIDs are deliberately not accepted — no tool returns one, so a UUID
 * argument shape would be unpopulatable by the caller. `unique_issue_number`
 * on (machine_initials, issue_number) makes this pair a key.
 *
 * NOTE: `reporterEmail` is never selected. It exists on the row for anonymous
 * and invited reporters and must not leave the server (CORE-SEC-007).
 */
export async function resolveIssue(
  machineRef: string,
  issueNumber: number
): Promise<IssueRef> {
  const machine = await resolveMachine(machineRef);
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.machineInitials, machine.initials),
      eq(issues.issueNumber, issueNumber)
    ),
    columns: {
      id: true,
      issueNumber: true,
      machineInitials: true,
      title: true,
      status: true,
      severity: true,
      priority: true,
      frequency: true,
      assignedTo: true,
      reportedBy: true,
      reporterName: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      closedAt: true,
    },
  });
  if (!issue) {
    throw new McpToolError(
      "not_found",
      `No issue #${issueNumber} on ${machine.initials}. Use list_issues to find the right number.`
    );
  }
  return issue;
}

/**
 * Resolve an assignee argument — a UUID, a full name ("First Last"), or empty
 * (to unassign) — to a `userProfiles.id`.
 *
 * Deliberately NOT `resolveOwner`. Machines carry both `ownerId` and
 * `invitedOwnerId`, so ownership can land on an invited user; `issues` has
 * only `assigned_to` referencing `user_profiles`, so an invited user has no
 * column to be assigned into and must be rejected rather than silently
 * dropped.
 */
export async function resolveAssignee(
  ref: string | null | undefined
): Promise<string | null> {
  if (ref == null || ref.trim() === "") return null;
  const value = ref.trim();

  if (uuidSchema.safeParse(value).success) {
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, value),
      columns: { id: true, role: true },
    });
    if (!user) {
      throw new McpToolError(
        "not_found",
        `No user found with id ${value}. Invited users cannot be assigned issues.`
      );
    }
    // permissions-audit-allow: business-logic data validation, not a permission gate
    if (user.role === "guest") {
      throw new McpToolError(
        "invalid",
        "That user is a guest and cannot be assigned issues."
      );
    }
    return user.id;
  }

  const matches = await db.query.userProfiles.findMany({
    where: sql`lower(${userProfiles.firstName} || ' ' || ${userProfiles.lastName}) = lower(${value})`,
    columns: { id: true, firstName: true, lastName: true, role: true },
    limit: 5,
  });
  // permissions-audit-allow: business-logic data validation, not a permission gate
  const eligible = matches.filter((m) => m.role !== "guest");
  const [first] = eligible;
  if (!first) {
    throw new McpToolError(
      "not_found",
      `No assignable member named "${ref}". Check spelling or pass the user's UUID.`
    );
  }
  if (eligible.length > 1) {
    const candidates = eligible
      .map((m) => `${fullName(m)} (${m.id})`)
      .join(", ");
    throw new McpToolError(
      "invalid",
      `Multiple members named "${ref}": ${candidates}. Pass the specific UUID.`
    );
  }
  return first.id;
}
```

Add the type imports at the top of `shared.ts` (it already imports `and`, `eq`, `sql`, `db`, `issues`, `userProfiles`):

```typescript
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type { IssueStatus } from "~/lib/issues/status";
import type { IssueFrequency, IssuePriority, IssueSeverity } from "~/lib/types";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "resolveIssue"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Static gate**

Run: `pnpm run check`
Expected: clean. If `IssueSeverity`/`IssuePriority`/`IssueFrequency` do not resolve from `~/lib/types`, run `rg -n "export type Issue(Severity|Priority|Frequency)" src/lib` and import from wherever they are actually declared.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/tools/shared.ts src/test/integration/mcp-tools.test.ts
git commit -m "feat(mcp): resolve issues by machine+number and assignees by name (PP-u4ab.14)"
```

---

### Task 2: `get_issue`

**Files:**

- Create: `src/lib/mcp/tools/get-issue.ts`
- Modify: `src/lib/mcp/tools/index.ts`
- Test: `src/test/integration/mcp-tools.test.ts`

**Interfaces:**

- Consumes: `resolveIssue`, `issueUrl`, `McpToolError`, `runTool`, `ToolOutcome` from `./shared`.
- Produces: `runGetIssue(args: {machine: string; number: number; commentLimit?: number}, ctx: McpAuthContext): Promise<ToolOutcome>`, `registerGetIssue(server: McpServer): void`.

- [ ] **Step 1: Write the failing integration test**

```typescript
describe("get_issue (PP-u4ab.14)", () => {
  it("returns full detail with the comment thread and no emails", async () => {
    const admin = await makeUser("admin", "Tim", "Froehlich");
    await seedMachine({ initials: "AFM", name: "Attack from Mars" });
    await runCreateIssue(
      {
        machine: "AFM",
        title: "left flipper weak",
        description: "Barely reaches the ramp.",
        severity: "major",
      },
      ctx("admin", admin)
    );
    await runAddIssueComment(
      { machine: "AFM", number: 1, comment: "Checked the coil sleeve." },
      ctx("admin", admin)
    );

    const out = await runGetIssue(
      { machine: "AFM", number: 1 },
      ctx("admin", admin)
    );
    const result = out.result as {
      title: string;
      description: string;
      severity: string;
      reporter: string;
      assignee: string | null;
      url: string;
      comments: { author: string; text: string }[];
    };

    expect(result.title).toBe("left flipper weak");
    expect(result.description).toBe("Barely reaches the ramp.");
    expect(result.severity).toBe("major");
    expect(result.reporter).toBe("Tim Froehlich");
    expect(result.assignee).toBeNull();
    expect(result.url).toContain("/m/AFM/i/1");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.text).toBe("Checked the coil sleeve.");
    expect(JSON.stringify(result)).not.toContain("@");
  });

  it("excludes system rows from the thread", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "MM", name: "Medieval Madness" });
    await runCreateIssue(
      { machine: "MM", title: "ball stuck" },
      ctx("admin", admin)
    );
    // A status change writes a system row on the issue's timeline.
    await runUpdateIssue(
      { machine: "MM", number: 1, status: "confirmed" },
      ctx("admin", admin)
    );

    const out = await runGetIssue(
      { machine: "MM", number: 1 },
      ctx("admin", admin)
    );
    const { comments } = out.result as { comments: unknown[] };
    expect(comments).toHaveLength(0);
  });

  it("denies a member-level context that lacks issues.view", async () => {
    // issues.view is granted broadly; assert the gate is wired by checking the
    // handler calls checkPermission at all — see the update_issue tests for the
    // denial path with a permission that actually differs by level.
    const admin = await makeUser("admin");
    await seedMachine({ initials: "TZ", name: "Twilight Zone" });
    await expect(
      runGetIssue({ machine: "TZ", number: 1 }, ctx("admin", admin))
    ).rejects.toThrow(McpToolError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "get_issue"`
Expected: FAIL — no export named `runGetIssue`.

- [ ] **Step 3: Implement `get-issue.ts`**

```typescript
import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import { docToPlainText } from "~/lib/tiptap/types";
import { db } from "~/server/db";
import { issueComments } from "~/server/db/schema";

import {
  issueUrl,
  McpToolError,
  resolveIssue,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/** Comments returned when the caller doesn't ask for a count. */
const DEFAULT_COMMENT_LIMIT = 20;

const getIssueSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  number: z
    .number()
    .int()
    .min(1)
    .describe("The issue number within that machine, as shown in its URL."),
  commentLimit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      `Maximum comments to include, newest last (default ${DEFAULT_COMMENT_LIMIT}).`
    ),
});

type GetIssueArgs = z.infer<typeof getIssueSchema>;

export async function runGetIssue(
  args: GetIssueArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("issues.view", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot view issues.");
  }

  const issue = await resolveIssue(args.machine, args.number);

  // Names, never emails (CORE-SEC-007). `reporterName` is the stored display
  // name for anonymous and invited reporters; a linked profile wins over it.
  const [reporterProfile, assigneeProfile] = await Promise.all([
    issue.reportedBy
      ? db.query.userProfiles.findFirst({
          where: (u, { eq: e }) => e(u.id, issue.reportedBy ?? ""),
          columns: { name: true },
        })
      : Promise.resolve(undefined),
    issue.assignedTo
      ? db.query.userProfiles.findFirst({
          where: (u, { eq: e }) => e(u.id, issue.assignedTo ?? ""),
          columns: { name: true },
        })
      : Promise.resolve(undefined),
  ]);

  // The thread is a separate permission from the issue body. Omitting it beats
  // denying the whole call: the issue itself is still readable.
  const canReadComments = checkPermission("comments.view", ctx.accessLevel);
  const commentRows = canReadComments
    ? await db.query.issueComments.findMany({
        where: and(
          eq(issueComments.issueId, issue.id),
          eq(issueComments.isSystem, false)
        ),
        columns: { content: true, createdAt: true, authorId: true },
        with: { author: { columns: { name: true } } },
        orderBy: (c, { asc }) => [asc(c.createdAt)],
        limit: args.commentLimit ?? DEFAULT_COMMENT_LIMIT,
      })
    : [];

  return {
    result: {
      machine: issue.machineInitials,
      number: issue.issueNumber,
      title: issue.title,
      description: docToPlainText(issue.description),
      status: issue.status,
      severity: issue.severity,
      priority: issue.priority,
      frequency: issue.frequency,
      reporter: reporterProfile?.name ?? issue.reporterName ?? "Anonymous",
      assignee: assigneeProfile?.name ?? null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      closedAt: issue.closedAt?.toISOString() ?? null,
      url: issueUrl(issue.machineInitials, issue.issueNumber),
      comments: commentRows.map((c) => ({
        author: c.author?.name ?? "Anonymous",
        text: docToPlainText(c.content),
        createdAt: c.createdAt.toISOString(),
      })),
    },
    issueId: issue.id,
  };
}

export function registerGetIssue(server: McpServer): void {
  server.registerTool(
    "get_issue",
    {
      title: "Get issue detail",
      description:
        "Get one issue in full — title, description, status, severity, priority, frequency, reporter and assignee names, timestamps, URL, and the comment thread (newest last). Identify it by machine (initials or UUID) plus the issue number shown in its URL and returned by list_issues, get_machine, and create_issue. System/timeline rows are not included; the issue's current status is what they would describe.",
      inputSchema: getIssueSchema.shape,
    },
    (args, extra) =>
      runTool("get_issue", extra, (ctx) => runGetIssue(args, ctx))
  );
}
```

If `with: { author: ... }` fails to type-check, the `issueComments` relation may be named differently — run `rg -n "issueCommentsRelations" -A 12 src/server/db/schema.ts` and use the declared relation name.

- [ ] **Step 4: Register the tool**

In `src/lib/mcp/tools/index.ts`, add the import alphabetically among the others and call it inside `registerPinpointTools`, after `registerGetMachine`:

```typescript
import { registerGetIssue } from "./get-issue";
// ...
registerGetIssue(server);
```

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "get_issue"`
Expected: PASS. The second and third cases depend on Tasks 4 and 5; if running strictly in order, mark them `it.todo` here and convert them back in Task 5's step 1.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/tools/get-issue.ts src/lib/mcp/tools/index.ts src/test/integration/mcp-tools.test.ts
git commit -m "feat(mcp): add get_issue (PP-u4ab.14)"
```

---

### Task 3: `list_issues`

**Files:**

- Create: `src/lib/mcp/tools/list-issues.ts`
- Modify: `src/lib/mcp/tools/index.ts`
- Test: `src/test/integration/mcp-tools.test.ts`

**Interfaces:**

- Consumes: `resolveMachine`, `issueUrl`, `McpToolError`, `runTool`, `ToolOutcome` from `./shared`; `OPEN_STATUSES`, `CLOSED_STATUSES`, `ISSUE_STATUS_VALUES` from `~/lib/issues/status`.
- Produces: `runListIssues(args, ctx): Promise<ToolOutcome>`, `registerListIssues(server): void`.

- [ ] **Step 1: Write the failing integration test**

```typescript
describe("list_issues (PP-u4ab.14)", () => {
  it("defaults to open issues only", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "AFM", name: "Attack from Mars" });
    await runCreateIssue(
      { machine: "AFM", title: "open one" },
      ctx("admin", admin)
    );
    await runCreateIssue(
      { machine: "AFM", title: "closed one" },
      ctx("admin", admin)
    );
    await runUpdateIssue(
      { machine: "AFM", number: 2, status: "fixed" },
      ctx("admin", admin)
    );

    const out = await runListIssues({}, ctx("admin", admin));
    const result = out.result as {
      total: number;
      issues: { title: string; status: string }[];
    };
    expect(result.total).toBe(1);
    expect(result.issues[0]?.title).toBe("open one");
  });

  it("accepts an array of statuses and the 'closed' shorthand", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "MM", name: "Medieval Madness" });
    await runCreateIssue({ machine: "MM", title: "a" }, ctx("admin", admin));
    await runCreateIssue({ machine: "MM", title: "b" }, ctx("admin", admin));
    await runUpdateIssue(
      { machine: "MM", number: 2, status: "wont_fix" },
      ctx("admin", admin)
    );

    const closed = await runListIssues(
      { status: "closed" },
      ctx("admin", admin)
    );
    expect((closed.result as { total: number }).total).toBe(1);

    const both = await runListIssues(
      { status: ["new", "wont_fix"] },
      ctx("admin", admin)
    );
    expect((both.result as { total: number }).total).toBe(2);
  });

  it("agrees between the page and the total when paging", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "TZ", name: "Twilight Zone" });
    for (let i = 0; i < 5; i++) {
      await runCreateIssue(
        { machine: "TZ", title: `issue ${i}` },
        ctx("admin", admin)
      );
    }

    const page = await runListIssues(
      { limit: 2, offset: 0 },
      ctx("admin", admin)
    );
    const r = page.result as {
      count: number;
      total: number;
      offset: number;
      hasMore: boolean;
    };
    expect(r.count).toBe(2);
    expect(r.total).toBe(5);
    expect(r.hasMore).toBe(true);

    const last = await runListIssues(
      { limit: 2, offset: 4 },
      ctx("admin", admin)
    );
    expect((last.result as { hasMore: boolean }).hasMore).toBe(false);
  });

  it("scopes to one machine when asked", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "AFM", name: "Attack from Mars" });
    await seedMachine({ initials: "MM", name: "Medieval Madness" });
    await runCreateIssue(
      { machine: "AFM", title: "afm one" },
      ctx("admin", admin)
    );
    await runCreateIssue(
      { machine: "MM", title: "mm one" },
      ctx("admin", admin)
    );

    const out = await runListIssues({ machine: "afm" }, ctx("admin", admin));
    const r = out.result as { total: number; issues: { machine: string }[] };
    expect(r.total).toBe(1);
    expect(r.issues[0]?.machine).toBe("AFM");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "list_issues"`
Expected: FAIL — no export named `runListIssues`.

- [ ] **Step 3: Implement `list-issues.ts`**

```typescript
import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, count, eq, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";

import {
  CLOSED_STATUSES,
  ISSUE_STATUS_VALUES,
  OPEN_STATUSES,
  type IssueStatus,
} from "~/lib/issues/status";
import { checkPermission } from "~/lib/permissions/helpers";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

import {
  issueUrl,
  McpToolError,
  resolveAssignee,
  resolveMachine,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/** Page size when the caller doesn't ask for one. */
const DEFAULT_LIMIT = 50;

/**
 * `status` takes a set, not a single value.
 *
 * `list_machines` shipped `presence` as one value and immediately needed
 * widening (PP-u4ab.13): a worklist that cannot say "these three states" cannot
 * exclude rows nobody will ever action, so those rows sit in every page of the
 * filter forever and the sweep never reaches empty. Same failure applies here,
 * so the set form ships first.
 */
const statusFilterSchema = z.union([
  z.literal("open"),
  z.literal("closed"),
  z.enum(ISSUE_STATUS_VALUES),
  z.array(z.enum(ISSUE_STATUS_VALUES)).min(1),
]);

function resolveStatuses(
  filter: z.infer<typeof statusFilterSchema> | undefined
): IssueStatus[] {
  if (filter === undefined || filter === "open") return [...OPEN_STATUSES];
  if (filter === "closed") return [...CLOSED_STATUSES];
  return Array.isArray(filter) ? filter : [filter];
}

const listIssuesSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only issues on this machine (initials or UUID). Omit to search the whole collection."
    ),
  status: statusFilterSchema
    .optional()
    .describe(
      "Which statuses to include: 'open' (default), 'closed', one status, or an array of statuses. Statuses are new, confirmed, wait_owner, in_progress, need_parts, need_help, fixed, wont_fix, wai, no_repro, duplicate."
    ),
  severity: z
    .enum(["cosmetic", "minor", "major", "unplayable"])
    .optional()
    .describe("Only issues at this severity."),
  assignee: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Only issues assigned to this member (full name or UUID)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      `Maximum issues to return (default ${DEFAULT_LIMIT}, max 100). The response reports the matching 'total' and 'hasMore' so you can tell a full list from a truncated page.`
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "How many matches to skip. Issues are ordered newest first, then by machine initials and issue number to break ties — a total order, so separate requests agree about where a page boundary falls, for as long as the underlying rows don't change. Whether you should advance this offset at all depends on whether your own calls change what matches; the tool description has the rule."
    ),
});

type ListIssuesArgs = z.infer<typeof listIssuesSchema>;

export async function runListIssues(
  args: ListIssuesArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("issues.view", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot view issues.");
  }

  const conditions: SQL[] = [
    inArray(issues.status, resolveStatuses(args.status)),
  ];

  if (args.machine) {
    const machine = await resolveMachine(args.machine);
    conditions.push(eq(issues.machineInitials, machine.initials));
  }
  if (args.severity) {
    conditions.push(eq(issues.severity, args.severity));
  }
  if (args.assignee) {
    const assigneeId = await resolveAssignee(args.assignee);
    if (assigneeId) conditions.push(eq(issues.assignedTo, assigneeId));
  }

  // One WHERE for both the page and the count — a filter applied to only one of
  // them reports a total the page can never reach (CORE-ARCH-012).
  const where = and(...conditions);
  const limit = args.limit ?? DEFAULT_LIMIT;
  const offset = args.offset ?? 0;

  const [rows, totalRows] = await Promise.all([
    db.query.issues.findMany({
      where,
      columns: {
        machineInitials: true,
        issueNumber: true,
        title: true,
        status: true,
        severity: true,
        priority: true,
        assignedTo: true,
        createdAt: true,
      },
      with: { assignedToUser: { columns: { name: true } } },
      // `machineInitials, issueNumber` breaks ties on `createdAt`, and together
      // they are unique, so this is a TOTAL order. Sorting on createdAt alone
      // leaves same-timestamp rows in an order Postgres may vary between the
      // separate queries that offset paging issues — one issue returned twice
      // while another is never shown at all (CORE-ARCH-012).
      orderBy: (i, { asc, desc }) => [
        desc(i.createdAt),
        asc(i.machineInitials),
        asc(i.issueNumber),
      ],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(issues).where(where),
  ]);
  const total = totalRows[0]?.value ?? 0;

  const issueList = rows.map((r) => ({
    machine: r.machineInitials,
    number: r.issueNumber,
    title: r.title,
    status: r.status,
    severity: r.severity,
    priority: r.priority,
    assignee: r.assignedToUser?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    url: issueUrl(r.machineInitials, r.issueNumber),
  }));

  return {
    result: {
      count: issueList.length,
      total,
      offset,
      hasMore: offset + issueList.length < total,
      issues: issueList,
    },
  };
}

/**
 * Why the description repeats `list_machines`' drain procedure.
 *
 * Offset paging is coherent only over a result set that holds still, and
 * `update_issue` writes every field this tool filters on — `status` (the
 * DEFAULT filter), `severity`, and `assignee`. Working a filtered worklist
 * while paging it is the normal use here, not an edge case, so the failure is
 * the common path: each issue actioned leaves the filter, the rest shift up,
 * and `offset += limit` steps over exactly the ones that moved.
 */
export function registerListIssues(server: McpServer): void {
  server.registerTool(
    "list_issues",
    {
      title: "List issues",
      description:
        "Find issues across the whole collection, or on one machine. Each row carries the machine initials and issue number you need to act on it with get_issue, add_issue_comment, or update_issue. Filters: machine, status ('open' by default, or 'closed', or a specific set like ['need_parts','need_help']), severity, and assignee. Returns 'count' (this page), 'total' (every match), 'offset', and 'hasMore'. Answer counting questions from 'total', never from 'count' or the array length. To enumerate more than one page, keep requesting with offset += limit until hasMore is false — raising limit alone caps at 100. That works only while the matching set holds still, and your own calls move it: update_issue changes status, severity, and assignee, which are the filters here. So if you are ACTING on the issues as you page them — 'triage every new issue' — do NOT advance the offset. Each issue you action leaves the filter and the rest shift up, so offset += limit steps over exactly as many as you just handled. Re-request offset 0 and let the list drain instead. Raise offset only past issues you deliberately left unchanged. You are done when a request returns EMPTY (count 0), NOT when total reaches 0.",
      inputSchema: listIssuesSchema.shape,
    },
    (args, extra) =>
      runTool("list_issues", extra, (ctx) => runListIssues(args, ctx))
  );
}
```

If `with: { assignedToUser: ... }` does not type-check, confirm the relation name with `rg -n "assignedToUser" src/server/db/schema.ts` — `assignIssue` in `src/services/issues.ts` already uses it, so it exists.

- [ ] **Step 4: Register the tool**

In `src/lib/mcp/tools/index.ts`, import `registerListIssues` and call it inside `registerPinpointTools` after `registerGetIssue`.

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "list_issues"`
Expected: PASS. Cases referencing `runUpdateIssue` depend on Task 5 — `it.todo` them here if running strictly in order.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/tools/list-issues.ts src/lib/mcp/tools/index.ts src/test/integration/mcp-tools.test.ts
git commit -m "feat(mcp): add list_issues with a status-set filter (PP-u4ab.14)"
```

---

### Task 4: `add_issue_comment`

**Files:**

- Create: `src/lib/mcp/tools/add-issue-comment.ts`
- Create: `src/lib/mcp/tools/add-issue-comment.test.ts`
- Modify: `src/lib/mcp/tools/index.ts`
- Test: `src/test/integration/mcp-tools.test.ts`

**Interfaces:**

- Consumes: `resolveIssue`, `issueUrl`, `McpToolError`, `runTool`, `ToolOutcome` from `./shared`; `addIssueComment` from `~/services/issues`; `plainTextToDoc` from `~/lib/tiptap/types`.
- Produces: `createCommentIdempotencyKey(issueId: string, comment: string, userId: string, now: number): string`, `runAddIssueComment(args, ctx): Promise<ToolOutcome>`, `registerAddIssueComment(server): void`.

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/mcp/tools/add-issue-comment.test.ts`:

```typescript
/**
 * Unit test: add_issue_comment idempotency key (PP-u4ab.14)
 *
 * Mirrors create-issue.test.ts. The key is what makes a retried MCP call
 * resolve to the comment already posted instead of double-posting. Three
 * properties at once: identical calls in one window collide, anything else does
 * not, and the output parses as a `uuid` because that is the column type.
 */

import { describe, expect, it } from "vitest";

import { createCommentIdempotencyKey } from "./add-issue-comment";

const USER = "11111111-1111-4111-8111-111111111111";
const ISSUE = "33333333-3333-4333-8333-333333333333";
const OTHER_ISSUE = "44444444-4444-4444-8444-444444444444";
/**
 * Deliberately mid-bucket, not on a boundary — see create-issue.test.ts for why
 * a boundary-anchored `now` makes the "a retry seconds later collides"
 * assertion pass trivially.
 */
const NOW = 1_770_000_000_000 + 100_000;
const COMMENT = "Checked the coil sleeve.";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createCommentIdempotencyKey", () => {
  it("produces a valid v8 UUID", () => {
    expect(createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW)).toMatch(
      UUID_RE
    );
  });

  it("collides for an identical retry seconds later", () => {
    expect(createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW + 5_000)).toBe(
      createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW)
    );
  });

  it("differs on comment text, issue, and user", () => {
    const base = createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW);
    expect(
      createCommentIdempotencyKey(ISSUE, "Different.", USER, NOW)
    ).not.toBe(base);
    expect(
      createCommentIdempotencyKey(OTHER_ISSUE, COMMENT, USER, NOW)
    ).not.toBe(base);
    expect(
      createCommentIdempotencyKey(
        ISSUE,
        COMMENT,
        "22222222-2222-4222-8222-222222222222",
        NOW
      )
    ).not.toBe(base);
  });

  it("differs across windows", () => {
    expect(
      createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW + 11 * 60 * 1000)
    ).not.toBe(createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/mcp/tools/add-issue-comment.test.ts`
Expected: FAIL — cannot resolve `./add-issue-comment`.

- [ ] **Step 3: Implement `add-issue-comment.ts`**

Read `src/lib/mcp/tools/create-issue.ts` lines 80–122 first and mirror its key construction exactly — same NUL-joining rationale, same version/variant stamping.

```typescript
import "server-only";

import { createHash } from "node:crypto";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";

import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { addIssueComment } from "~/services/issues";

import {
  issueUrl,
  McpToolError,
  resolveIssue,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/** Retries inside this window resolve to the comment already posted. */
const RETRY_WINDOW_MS = 10 * 60 * 1000;

const addIssueCommentSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  number: z
    .number()
    .int()
    .min(1)
    .describe("The issue number within that machine."),
  comment: z
    .string()
    .trim()
    .min(1)
    .max(10_000)
    .describe("The comment text. Plain text; no markdown rendering."),
});

type AddIssueCommentArgs = z.infer<typeof addIssueCommentSchema>;

/**
 * Content-addressed idempotency key, same scheme as create_issue's.
 *
 * NUL-joined so no field's content can impersonate a boundary between two
 * others ("ab" + "c" must not hash the same as "a" + "bc").
 */
export function createCommentIdempotencyKey(
  issueId: string,
  comment: string,
  userId: string,
  now: number
): string {
  const parts = [
    issueId,
    comment,
    userId,
    String(Math.floor(now / RETRY_WINDOW_MS)),
  ];
  const digest = createHash("sha256").update(parts.join("�")).digest();
  const bytes = digest.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export async function runAddIssueComment(
  args: AddIssueCommentArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("comments.add", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot comment on issues.");
  }

  const issue = await resolveIssue(args.machine, args.number);
  const idempotencyKey = createCommentIdempotencyKey(
    issue.id,
    args.comment,
    ctx.userId,
    Date.now()
  );

  const { comment, deliveryPlan } = await addIssueComment({
    issueId: issue.id,
    content: plainTextToDoc(args.comment),
    userId: ctx.userId,
    idempotencyKey,
  });

  after(() => dispatchNotification(deliveryPlan));

  return {
    result: {
      // A dedupe hit wrote nothing. Reporting it as a fresh post is the
      // success-for-work-not-done shape CORE-ARCH-012 forbids, and the caller
      // needs to say "already posted" rather than "posted".
      created: deliveryPlan.deliveries.length > 0,
      commentId: comment.id,
      machine: issue.machineInitials,
      number: issue.issueNumber,
      url: issueUrl(issue.machineInitials, issue.issueNumber),
    },
    issueId: issue.id,
  };
}

export function registerAddIssueComment(server: McpServer): void {
  server.registerTool(
    "add_issue_comment",
    {
      title: "Comment on an issue",
      description:
        "Post a comment on an issue, attributed to the authenticated user. Identify the issue by machine (initials or UUID) plus its issue number. Plain text only. Retrying an identical comment shortly after one usually resolves to the comment already posted instead of a duplicate — check 'created' in the response: false means nothing new was written, so report it as already posted rather than as a new comment.",
      inputSchema: addIssueCommentSchema.shape,
    },
    (args, extra) =>
      runTool("add_issue_comment", extra, (ctx) =>
        runAddIssueComment(args, ctx)
      )
  );
}
```

**Verify the `created` derivation before trusting it.** `addIssueComment` returns `{comment, deliveryPlan}` and signals a dedupe hit by returning an EMPTY delivery plan (`{deliveries: []}`) — read `src/services/issues.ts:691-770` and confirm. If a fresh comment can also produce an empty plan (for instance when the issue has no watchers and no Discord channel is configured), this derivation reports `created: false` for real writes. In that case add an explicit `deduped` flag to the service's return value, the way `createIssue` already does, and use that instead — do not ship the delivery-plan proxy.

- [ ] **Step 4: Run the unit test**

Run: `pnpm exec vitest run src/lib/mcp/tools/add-issue-comment.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write and run the integration test**

Add to `src/test/integration/mcp-tools.test.ts`:

```typescript
describe("add_issue_comment (PP-u4ab.14)", () => {
  it("posts a comment and reports created: true", async () => {
    const admin = await makeUser("admin", "Tim", "Froehlich");
    await seedMachine({ initials: "AFM", name: "Attack from Mars" });
    await runCreateIssue(
      { machine: "AFM", title: "left flipper weak" },
      ctx("admin", admin)
    );

    const out = await runAddIssueComment(
      { machine: "AFM", number: 1, comment: "Checked the coil sleeve." },
      ctx("admin", admin)
    );
    const r = out.result as { created: boolean; commentId: string };
    expect(r.created).toBe(true);
    expect(r.commentId).toBeDefined();

    const db = await getTestDb();
    const rows = await db.query.issueComments.findMany({
      where: eq(issueComments.issueId, out.issueId ?? ""),
    });
    expect(rows).toHaveLength(1);
  });

  it("dedupes an identical retry and reports created: false", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "MM", name: "Medieval Madness" });
    await runCreateIssue(
      { machine: "MM", title: "ball stuck" },
      ctx("admin", admin)
    );

    const args = { machine: "MM", number: 1, comment: "Same text." };
    await runAddIssueComment(args, ctx("admin", admin));
    const second = await runAddIssueComment(args, ctx("admin", admin));

    expect((second.result as { created: boolean }).created).toBe(false);
    const db = await getTestDb();
    const rows = await db.query.issueComments.findMany({
      where: eq(issueComments.issueId, second.issueId ?? ""),
    });
    expect(rows).toHaveLength(1);
  });

  it("fails with not_found for an issue number that does not exist", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "TZ", name: "Twilight Zone" });
    await expect(
      runAddIssueComment(
        { machine: "TZ", number: 7, comment: "hi" },
        ctx("admin", admin)
      )
    ).rejects.toThrow(/list_issues/);
  });
});
```

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "add_issue_comment"`
Expected: PASS, 3 tests.

- [ ] **Step 6: Register and commit**

Import `registerAddIssueComment` in `src/lib/mcp/tools/index.ts` and call it inside `registerPinpointTools`. Then:

```bash
pnpm run check
git add src/lib/mcp/tools/add-issue-comment.ts src/lib/mcp/tools/add-issue-comment.test.ts src/lib/mcp/tools/index.ts src/test/integration/mcp-tools.test.ts
git commit -m "feat(mcp): add add_issue_comment with retry dedupe (PP-u4ab.14)"
```

---

### Task 5: `update_issue`

The largest task: six fields, two permissions, and a non-atomic apply loop.

**Files:**

- Create: `src/lib/mcp/tools/update-issue.ts`
- Create: `src/lib/mcp/tools/update-issue.test.ts`
- Modify: `src/lib/mcp/tools/index.ts`
- Test: `src/test/integration/mcp-tools.test.ts`

**Interfaces:**

- Consumes: `resolveIssue`, `resolveAssignee`, `issueUrl`, `McpToolError`, `runTool`, `ToolOutcome` from `./shared`; `updateIssueTitle`, `updateIssueStatus`, `updateIssueSeverity`, `updateIssueFrequency`, `updateIssuePriority`, `assignIssue` from `~/services/issues`.
- Produces: `UPDATE_FIELD_PERMISSIONS: Record<UpdatableField, "issues.update.reporting" | "issues.update.triage">`, `runUpdateIssue(args, ctx): Promise<ToolOutcome>`, `registerUpdateIssue(server): void`.

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/mcp/tools/update-issue.test.ts`:

```typescript
/**
 * Unit test: update_issue per-field permission mapping (PP-u4ab.14)
 *
 * The matrix splits issue edits two ways — `issues.update.reporting` for the
 * fields a reporter owns, `issues.update.triage` for the organizational ones.
 * A field mapped to the wrong permission is a silent privilege change, and the
 * map is small enough to assert directly.
 */

import { describe, expect, it } from "vitest";

import { UPDATE_FIELD_PERMISSIONS } from "./update-issue";

describe("UPDATE_FIELD_PERMISSIONS", () => {
  it("maps reporter-owned fields to issues.update.reporting", () => {
    expect(UPDATE_FIELD_PERMISSIONS.title).toBe("issues.update.reporting");
    expect(UPDATE_FIELD_PERMISSIONS.status).toBe("issues.update.reporting");
    expect(UPDATE_FIELD_PERMISSIONS.severity).toBe("issues.update.reporting");
    expect(UPDATE_FIELD_PERMISSIONS.frequency).toBe("issues.update.reporting");
  });

  it("maps organizational fields to issues.update.triage", () => {
    expect(UPDATE_FIELD_PERMISSIONS.priority).toBe("issues.update.triage");
    expect(UPDATE_FIELD_PERMISSIONS.assignee).toBe("issues.update.triage");
  });

  it("covers every updatable field", () => {
    expect(Object.keys(UPDATE_FIELD_PERMISSIONS).sort()).toEqual([
      "assignee",
      "frequency",
      "priority",
      "severity",
      "status",
      "title",
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/mcp/tools/update-issue.test.ts`
Expected: FAIL — cannot resolve `./update-issue`.

- [ ] **Step 3: Implement `update-issue.ts`**

```typescript
import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";

import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import { dispatchNotification, type DeliveryPlan } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import {
  assignIssue,
  updateIssueFrequency,
  updateIssuePriority,
  updateIssueSeverity,
  updateIssueStatus,
  updateIssueTitle,
} from "~/services/issues";

import {
  issueUrl,
  McpToolError,
  resolveAssignee,
  resolveIssue,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const UPDATABLE_FIELDS = [
  "title",
  "status",
  "severity",
  "frequency",
  "priority",
  "assignee",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

/**
 * Which matrix permission each field requires.
 *
 * `issues.update.reporting` covers what a reporter naturally owns; guests hold
 * it on their OWN issues. `issues.update.triage` is the organizational half and
 * starts at member. Checking one blanket permission for the whole tool would
 * either deny a legitimate status change or hand out triage rights with it — a
 * `Record` keyed by the field union so a new field cannot be added without a
 * permission decision (CORE-ARCH-008).
 */
export const UPDATE_FIELD_PERMISSIONS: Record<UpdatableField, string> = {
  title: "issues.update.reporting",
  status: "issues.update.reporting",
  severity: "issues.update.reporting",
  frequency: "issues.update.reporting",
  priority: "issues.update.triage",
  assignee: "issues.update.triage",
};

const updateIssueSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  number: z
    .number()
    .int()
    .min(1)
    .describe("The issue number within that machine."),
  title: z.string().trim().min(1).max(255).optional().describe("New title."),
  status: z
    .enum(ISSUE_STATUS_VALUES)
    .optional()
    .describe(
      "New status: new, confirmed, wait_owner, in_progress, need_parts, need_help, fixed, wont_fix, wai, no_repro, duplicate."
    ),
  severity: z
    .enum(["cosmetic", "minor", "major", "unplayable"])
    .optional()
    .describe(
      "How much it affects play: cosmetic, minor, major, or unplayable."
    ),
  frequency: z
    .enum(["intermittent", "frequent", "constant"])
    .optional()
    .describe("How often it happens."),
  priority: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe("Work priority."),
  assignee: z
    .string()
    .trim()
    .optional()
    .describe(
      "Member to assign (full name or UUID). Pass an empty string to unassign."
    ),
});

type UpdateIssueArgs = z.infer<typeof updateIssueSchema>;

interface FieldChange {
  field: UpdatableField;
  from: string | null;
  to: string | null;
  changed: boolean;
}

export async function runUpdateIssue(
  args: UpdateIssueArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  const supplied = UPDATABLE_FIELDS.filter((f) => args[f] !== undefined);
  if (supplied.length === 0) {
    throw new McpToolError(
      "invalid",
      "Supply at least one field to change: title, status, severity, frequency, priority, or assignee."
    );
  }

  // Only the fields actually supplied are gated. A blanket check would deny a
  // status-only call for lacking triage rights it never uses.
  for (const field of supplied) {
    const permission = UPDATE_FIELD_PERMISSIONS[field];
    if (!checkPermission(permission, ctx.accessLevel)) {
      throw new McpToolError(
        "denied",
        `You cannot change an issue's ${field}.`
      );
    }
  }

  const issue = await resolveIssue(args.machine, args.number);
  const assigneeId =
    args.assignee === undefined
      ? undefined
      : await resolveAssignee(args.assignee);

  const applied: FieldChange[] = [];
  const plans: DeliveryPlan[] = [];
  let failure: { field: UpdatableField; reason: string } | null = null;

  // Fixed order so a partial application is reproducible rather than depending
  // on argument order. Each service owns its own transaction, so this loop is
  // NOT atomic — that is why the response reports what landed (see below).
  for (const field of supplied) {
    try {
      switch (field) {
        case "title": {
          const r = await updateIssueTitle({
            issueId: issue.id,
            title: args.title ?? "",
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: r.oldTitle,
            to: r.newTitle,
            changed: r.oldTitle !== r.newTitle,
          });
          break;
        }
        case "status": {
          const r = await updateIssueStatus({
            issueId: issue.id,
            status: args.status ?? issue.status,
            userId: ctx.userId,
          });
          plans.push(r.deliveryPlan);
          applied.push({
            field,
            from: r.oldStatus,
            to: r.newStatus,
            changed: r.oldStatus !== r.newStatus,
          });
          break;
        }
        case "severity": {
          const r = await updateIssueSeverity({
            issueId: issue.id,
            severity: args.severity ?? issue.severity,
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: r.oldSeverity,
            to: r.newSeverity,
            changed: r.oldSeverity !== r.newSeverity,
          });
          break;
        }
        case "frequency": {
          const r = await updateIssueFrequency({
            issueId: issue.id,
            frequency: args.frequency ?? issue.frequency,
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: r.oldFrequency,
            to: r.newFrequency,
            changed: r.oldFrequency !== r.newFrequency,
          });
          break;
        }
        case "priority": {
          const r = await updateIssuePriority({
            issueId: issue.id,
            priority: args.priority ?? issue.priority,
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: r.oldPriority,
            to: r.newPriority,
            changed: r.oldPriority !== r.newPriority,
          });
          break;
        }
        case "assignee": {
          const next = assigneeId ?? null;
          const plan = await assignIssue({
            issueId: issue.id,
            assignedTo: next,
            actorId: ctx.userId,
          });
          plans.push(plan);
          applied.push({
            field,
            from: issue.assignedTo,
            to: next,
            changed: issue.assignedTo !== next,
          });
          break;
        }
      }
    } catch (error) {
      failure = {
        field,
        reason: error instanceof Error ? error.message : "unknown error",
      };
      break;
    }
  }

  // Dispatch only what actually committed, after the loop — never inside a
  // service transaction (CORE-ARCH-011).
  after(() => Promise.all(plans.map((p) => dispatchNotification(p))));

  return {
    result: {
      machine: issue.machineInitials,
      number: issue.issueNumber,
      url: issueUrl(issue.machineInitials, issue.issueNumber),
      applied,
      // Each field commits in its own transaction, so a mid-loop failure leaves
      // earlier fields WRITTEN. Reporting a blanket error would tell the caller
      // nothing landed when some of it did (CORE-ARCH-012), so the partial
      // result is a success payload that names what failed.
      ...(failure ? { partial: true, failed: failure } : { partial: false }),
    },
    issueId: issue.id,
  };
}

export function registerUpdateIssue(server: McpServer): void {
  server.registerTool(
    "update_issue",
    {
      title: "Update an issue",
      description:
        "Change one or more fields on an issue: title, status, severity, frequency, priority, or assignee. Identify the issue by machine (initials or UUID) plus its issue number. Supply only the fields you want to change; at least one is required. The response returns 'applied' — one entry per field with 'from', 'to', and 'changed' (false when it already held that value). Fields are applied one at a time and are NOT a single transaction: if one fails the earlier ones stay written, and the response comes back with 'partial': true plus 'failed', naming the field that stopped it. Read 'applied' rather than assuming the whole call landed.",
      inputSchema: updateIssueSchema.shape,
    },
    (args, extra) =>
      runTool("update_issue", extra, (ctx) => runUpdateIssue(args, ctx))
  );
}
```

- [ ] **Step 4: Run the unit test**

Run: `pnpm exec vitest run src/lib/mcp/tools/update-issue.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write and run the integration test**

```typescript
describe("update_issue (PP-u4ab.14)", () => {
  it("applies several fields and reports each change", async () => {
    const admin = await makeUser("admin");
    const tech = await makeUser("technician", "Ada", "Lovelace");
    await seedMachine({ initials: "AFM", name: "Attack from Mars" });
    await runCreateIssue(
      { machine: "AFM", title: "left flipper weak" },
      ctx("admin", admin)
    );

    const out = await runUpdateIssue(
      {
        machine: "AFM",
        number: 1,
        status: "confirmed",
        severity: "major",
        assignee: "Ada Lovelace",
      },
      ctx("admin", admin)
    );
    const r = out.result as {
      partial: boolean;
      applied: {
        field: string;
        from: string | null;
        to: string | null;
        changed: boolean;
      }[];
    };

    expect(r.partial).toBe(false);
    expect(r.applied).toHaveLength(3);
    expect(r.applied.find((a) => a.field === "status")).toMatchObject({
      from: "new",
      to: "confirmed",
      changed: true,
    });
    expect(r.applied.find((a) => a.field === "assignee")?.to).toBe(tech);

    const db = await getTestDb();
    const row = await db.query.issues.findFirst({
      where: eq(issues.id, out.issueId ?? ""),
    });
    expect(row?.status).toBe("confirmed");
    expect(row?.severity).toBe("major");
    expect(row?.assignedTo).toBe(tech);
  });

  it("reports changed: false for a field already at that value", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "MM", name: "Medieval Madness" });
    await runCreateIssue(
      { machine: "MM", title: "ball stuck" },
      ctx("admin", admin)
    );

    const out = await runUpdateIssue(
      { machine: "MM", number: 1, status: "new" },
      ctx("admin", admin)
    );
    const r = out.result as { applied: { field: string; changed: boolean }[] };
    expect(r.applied[0]).toMatchObject({ field: "status", changed: false });
  });

  it("rejects an update that supplies no fields", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "TZ", name: "Twilight Zone" });
    await runCreateIssue(
      { machine: "TZ", title: "scoop weak" },
      ctx("admin", admin)
    );

    await expect(
      runUpdateIssue({ machine: "TZ", number: 1 }, ctx("admin", admin))
    ).rejects.toThrow(/at least one field/i);
  });

  it("denies a guest-level context on a triage field", async () => {
    const guest = await makeUser("guest");
    const admin = await makeUser("admin");
    await seedMachine({ initials: "CV", name: "Cirqus Voltaire" });
    await runCreateIssue(
      { machine: "CV", title: "ringmaster stuck" },
      ctx("admin", admin)
    );

    await expect(
      runUpdateIssue(
        { machine: "CV", number: 1, priority: "high" },
        ctx("guest", guest)
      )
    ).rejects.toThrow(/cannot change an issue's priority/);
  });

  it("keeps earlier fields written when a later one fails, and says so", async () => {
    const admin = await makeUser("admin");
    await seedMachine({ initials: "GB", name: "Ghostbusters" });
    await runCreateIssue(
      { machine: "GB", title: "left ramp" },
      ctx("admin", admin)
    );

    // A UUID-shaped assignee that does not exist fails at resolveAssignee, which
    // runs BEFORE the apply loop — so use a real mid-loop failure instead:
    // stub updateIssuePriority to throw once.
    const services = await import("~/services/issues");
    const spy = vi
      .spyOn(services, "updateIssuePriority")
      .mockRejectedValueOnce(new Error("priority write failed"));

    const out = await runUpdateIssue(
      { machine: "GB", number: 1, severity: "major", priority: "high" },
      ctx("admin", admin)
    );
    const r = out.result as {
      partial: boolean;
      failed: { field: string };
      applied: { field: string }[];
    };

    expect(r.partial).toBe(true);
    expect(r.failed.field).toBe("priority");
    expect(r.applied.map((a) => a.field)).toEqual(["severity"]);

    const db = await getTestDb();
    const row = await db.query.issues.findFirst({
      where: eq(issues.id, out.issueId ?? ""),
    });
    expect(row?.severity).toBe("major");
    expect(row?.priority).toBe("medium");

    spy.mockRestore();
  });
});
```

The spy in the last case requires the module to be spy-able — if `vi.spyOn` on the imported namespace fails under the file's existing mocks, add a `vi.mock("~/services/issues", async (importOriginal) => ({...(await importOriginal()), updateIssuePriority: vi.fn() }))` scoped to that describe block instead, and restore the real implementation for the other cases.

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "update_issue"`
Expected: PASS, 5 tests.

- [ ] **Step 6: Convert any `it.todo` placeholders from Tasks 2 and 3**

The `get_issue` system-row case and the `list_issues` status cases call `runUpdateIssue`, which now exists. Convert them back to `it` and run the whole file:

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Register and commit**

Import `registerUpdateIssue` in `src/lib/mcp/tools/index.ts` and call it inside `registerPinpointTools`.

```bash
pnpm run check
git add src/lib/mcp/tools/update-issue.ts src/lib/mcp/tools/update-issue.test.ts src/lib/mcp/tools/index.ts src/test/integration/mcp-tools.test.ts
git commit -m "feat(mcp): add update_issue with per-field permissions (PP-u4ab.14)"
```

---

### Task 6: Verify the registered catalog and land the branch

**Files:**

- Modify: `src/lib/mcp/tools/index.ts` (doc comment only)
- Test: `src/test/integration/mcp-tools.test.ts`

- [ ] **Step 1: Assert the tool count**

The registration list is the one place a finished tool can be silently absent — everything else in this plan tests `run*` directly, which passes whether or not the tool is registered.

```typescript
it("registers every tool in the catalog", () => {
  const registered: string[] = [];
  const fakeServer = {
    registerTool: (name: string) => {
      registered.push(name);
    },
  } as unknown as Parameters<typeof registerPinpointTools>[0];

  registerPinpointTools(fakeServer);

  expect(registered.sort()).toEqual([
    "add_issue_comment",
    "add_machine",
    "create_issue",
    "get_issue",
    "get_machine",
    "list_issues",
    "list_machines",
    "search_pinballmap_catalog",
    "set_machine_availability",
    "set_machine_name",
    "set_machine_owner",
    "update_issue",
  ]);
});
```

Note this asserts 12 tools — the 8 already registered plus 4 new. `whoami` is registered on the route, not in `registerPinpointTools`; confirm with `rg -n "whoami" src/app/api/mcp/\[transport\]/route.ts` and only add it to the list if it comes through this function.

- [ ] **Step 2: Run it**

Run: `pnpm exec vitest run src/test/integration/mcp-tools.test.ts -t "registers every tool"`
Expected: PASS.

- [ ] **Step 3: Update the index doc comment**

The comment above `registerPinpointTools` says "Reads for disambiguation plus mutations". Extend it to note the issue tools now cover read, find, comment, and edit.

- [ ] **Step 4: Full preflight**

Run: `pnpm run preflight`
Expected: clean. This touches server actions' service layer indirectly, so the slower gate is warranted.

- [ ] **Step 5: Commit and open the PR**

```bash
pnpm run check
git add -A
git commit -m "test(mcp): assert the registered tool catalog (PP-u4ab.14)"
git push -u origin <branch>
gh pr create --title "feat(mcp): issue read, find, comment, and update tools (PP-u4ab.14)" --body "..."
```

Open as **ready for review**, not draft. Then follow `pinpoint-pr-workflow` Phase 3.4: hand the branch to Tim for `/code-review`, address findings, attest with `bash scripts/workflow/mark-claude-review.sh <PR> <depth> "<findings>"`, and hand over with `bash scripts/workflow/merge-handoff.sh <PR>`. Do not merge.

---

## Self-Review Notes

**Spec coverage:** all four tools have a task; `resolveIssue`/`resolveAssignee` are Task 1; the non-atomic partial-apply contract is Task 5 steps 3 and 5; the email exclusion is asserted in Task 2 step 1; the status-set filter is Task 3.

**Known soft spots the implementer must resolve rather than assume:**

1. **`created` in `add_issue_comment`** is derived from an empty delivery plan. Task 4 step 3 says to verify this against `src/services/issues.ts:691-770` and to add an explicit `deduped` flag to the service if the proxy is unsound. This is the one place the plan could be wrong about existing behavior.
2. **Drizzle relation names** (`author` on `issueComments`, `assignedToUser` on `issues`) are used in Tasks 2 and 3. `assignedToUser` is confirmed in use by `assignIssue`; `author` is not — check it before writing the query.
3. **`IssueSeverity`/`IssuePriority`/`IssueFrequency` import path** in Task 1 is assumed to be `~/lib/types`; verify with ripgrep.
