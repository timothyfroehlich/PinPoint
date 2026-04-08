# Structured Timeline Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert timeline events from plain-text ProseMirror strings to structured JSON payloads with full cutover — new `event_data` column, SQL data migration, updated write/read paths, and migration validation against production data.

**Architecture:** Add a nullable `event_data` jsonb column to `issue_comments`. A Drizzle SQL migration parses existing ProseMirror-wrapped strings into structured JSON objects (discriminated union on `type`). The write path switches from template literal strings to structured objects. The read path prefers `event_data`, falling back to `docToPlainText(content)` for unmatched legacy rows. Visual output is unchanged.

**Tech Stack:** Drizzle ORM, PostgreSQL jsonb, TypeScript discriminated unions, Vitest (PGlite integration tests)

**Spec:** `docs/superpowers/specs/2026-04-07-structured-timeline-events-design.md`

---

## File Structure

| File                                                   | Responsibility                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `src/lib/timeline/events.ts`                           | `TimelineEventData` type, `createTimelineEvent()`, `formatTimelineEvent()` |
| `src/server/db/schema.ts`                              | Add `eventData` column to `issueComments` table                            |
| `src/lib/types/issue.ts`                               | Add `eventData` to `IssueCommentWithAuthor` Pick                           |
| `src/lib/types/database.ts`                            | Re-export `TimelineEventData` if needed for DB type inference              |
| `src/services/issues.ts`                               | 6 call sites updated from strings to structured objects                    |
| `src/components/issues/IssueTimeline.tsx`              | Read `eventData`, format for display, fallback to `content`                |
| `drizzle/0023_*.sql`                                   | DDL (add column) + DML (data migration)                                    |
| `src/test/integration/supabase/issue-services.test.ts` | Updated assertions: check `eventData` payloads                             |
| `src/lib/timeline/format.test.ts`                      | Unit tests for `formatTimelineEvent`                                       |

---

### Task 1: Define TimelineEventData type and formatTimelineEvent

**Files:**

- Modify: `src/lib/timeline/events.ts:1-42`
- Create: `src/lib/timeline/format.test.ts`

- [ ] **Step 1: Write failing tests for formatTimelineEvent**

Create `src/lib/timeline/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  formatTimelineEvent,
  type TimelineEventData,
} from "~/lib/timeline/events";

describe("formatTimelineEvent", () => {
  it("formats assigned event", () => {
    const event: TimelineEventData = { type: "assigned", assigneeName: "Tim" };
    expect(formatTimelineEvent(event)).toBe("Assigned to Tim");
  });

  it("formats unassigned event", () => {
    const event: TimelineEventData = { type: "unassigned" };
    expect(formatTimelineEvent(event)).toBe("Unassigned");
  });

  it("formats status_changed event", () => {
    const event: TimelineEventData = {
      type: "status_changed",
      from: "new",
      to: "in_progress",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Status changed from New to In Progress"
    );
  });

  it("formats severity_changed event", () => {
    const event: TimelineEventData = {
      type: "severity_changed",
      from: "minor",
      to: "unplayable",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Severity changed from Minor to Unplayable"
    );
  });

  it("formats priority_changed event", () => {
    const event: TimelineEventData = {
      type: "priority_changed",
      from: "low",
      to: "high",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Priority changed from Low to High"
    );
  });

  it("formats frequency_changed event", () => {
    const event: TimelineEventData = {
      type: "frequency_changed",
      from: "intermittent",
      to: "constant",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Frequency changed from Intermittent to Constant"
    );
  });

  it("handles unknown status enum values gracefully", () => {
    const event: TimelineEventData = {
      type: "status_changed",
      from: "unknown_val",
      to: "new",
    };
    // Should fall back to the raw value when enum lookup fails
    expect(formatTimelineEvent(event)).toBe(
      "Status changed from unknown_val to New"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/timeline/format.test.ts`
Expected: FAIL — `formatTimelineEvent` does not exist yet.

- [ ] **Step 3: Implement TimelineEventData type and formatTimelineEvent**

Edit `src/lib/timeline/events.ts`. Add the type definition and format function **above** the existing `createTimelineEvent` function. The type goes at the top of the file after imports:

```typescript
import {
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
  FREQUENCY_CONFIG,
  type IssueStatus,
} from "~/lib/issues/status";
import type { IssueSeverity, IssuePriority, IssueFrequency } from "~/lib/types";

/**
 * Structured timeline event payload.
 * Discriminated union on `type` — stored as jsonb in the `event_data` column.
 */
export type TimelineEventData =
  | { type: "assigned"; assigneeName: string }
  | { type: "unassigned" }
  | { type: "status_changed"; from: string; to: string }
  | { type: "severity_changed"; from: string; to: string }
  | { type: "priority_changed"; from: string; to: string }
  | { type: "frequency_changed"; from: string; to: string };

/**
 * Convert a structured timeline event to a human-readable string.
 * Used by the timeline UI to display system events.
 */
export function formatTimelineEvent(event: TimelineEventData): string {
  switch (event.type) {
    case "assigned":
      return `Assigned to ${event.assigneeName}`;
    case "unassigned":
      return "Unassigned";
    case "status_changed":
      return `Status changed from ${statusLabel(event.from)} to ${statusLabel(event.to)}`;
    case "severity_changed":
      return `Severity changed from ${severityLabel(event.from)} to ${severityLabel(event.to)}`;
    case "priority_changed":
      return `Priority changed from ${priorityLabel(event.from)} to ${priorityLabel(event.to)}`;
    case "frequency_changed":
      return `Frequency changed from ${frequencyLabel(event.from)} to ${frequencyLabel(event.to)}`;
  }
}

function statusLabel(value: string): string {
  return STATUS_CONFIG[value as IssueStatus]?.label ?? value;
}

function severityLabel(value: string): string {
  return SEVERITY_CONFIG[value as IssueSeverity]?.label ?? value;
}

function priorityLabel(value: string): string {
  return PRIORITY_CONFIG[value as IssuePriority]?.label ?? value;
}

function frequencyLabel(value: string): string {
  return FREQUENCY_CONFIG[value as IssueFrequency]?.label ?? value;
}
```

**Important**: Keep the existing `createTimelineEvent` function unchanged for now — it will be updated in Task 3.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/timeline/format.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/events.ts src/lib/timeline/format.test.ts
git commit -m "feat(timeline): add TimelineEventData type and formatTimelineEvent"
```

---

### Task 2: Add eventData column to schema and generate migration

**Files:**

- Modify: `src/server/db/schema.ts:291-315`
- Modify: `src/lib/types/issue.ts:9-15`
- Generated: `drizzle/0023_*.sql` (Drizzle generates this)

- [ ] **Step 1: Add eventData column to schema**

Edit `src/server/db/schema.ts`. In the `issueComments` table definition, add the `eventData` column after the `isSystem` column (around line 300):

```typescript
eventData: jsonb("event_data").$type<TimelineEventData>(),
```

Also add the import at the top of the file:

```typescript
import { type TimelineEventData } from "~/lib/timeline/events";
```

- [ ] **Step 2: Add eventData to IssueCommentWithAuthor type**

Edit `src/lib/types/issue.ts`. Update the Pick to include `eventData`:

```typescript
export type IssueCommentWithAuthor = Pick<
  IssueComment,
  "id" | "content" | "createdAt" | "updatedAt" | "isSystem" | "eventData"
> & {
  author?: Pick<UserProfile, "id" | "name"> | null;
  images: IssueImage[];
};
```

- [ ] **Step 3: Generate the Drizzle migration**

Run: `pnpm run db:generate`

This creates `drizzle/0023_*.sql` with the `ALTER TABLE` to add the column. Note the generated filename — you'll need it for the next step.

Expected output: A new SQL file in `drizzle/` and updated `drizzle/meta/` files. The SQL should contain:

```sql
ALTER TABLE "issue_comments" ADD COLUMN "event_data" jsonb;
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/lib/types/issue.ts drizzle/
git commit -m "feat(timeline): add event_data column to issue_comments schema"
```

---

### Task 3: Write the SQL data migration

**Files:**

- Modify: `drizzle/0023_*.sql` (the file generated in Task 2)

- [ ] **Step 1: Append data migration SQL to the generated migration file**

Open the `drizzle/0023_*.sql` file generated in Task 2. After the `ALTER TABLE` statement, add a `-- statement-breakpoint` and then the data migration SQL.

**Critical label-to-enum mappings** (derived from `STATUS_CONFIG`, `SEVERITY_CONFIG`, etc.):

- Status: New→new, Confirmed→confirmed, In Progress→in_progress, Need Parts→need_parts, Need Help→need_help, Pending Owner→wait_owner, Fixed→fixed, As Intended→wai, Won't Fix→wont_fix, No Repro→no_repro, Duplicate→duplicate
- Severity: Cosmetic→cosmetic, Minor→minor, Major→major, Unplayable→unplayable
- Priority: Low→low, Medium→medium, High→high
- Frequency: Intermittent→intermittent, Frequent→frequent, Constant→constant

Append the following SQL after the existing `ALTER TABLE` statement:

```sql
-- statement-breakpoint

-- Data migration: Convert existing plain-text system events to structured event_data
-- Text is stored in ProseMirror format at: content->'content'->0->'content'->0->>'text'

-- Helper: extract the raw text from ProseMirror JSON
-- We use a CTE to avoid repeating the extraction expression

WITH event_text AS (
  SELECT
    id,
    content->'content'->0->'content'->0->>'text' AS txt
  FROM "issue_comments"
  WHERE is_system = true AND event_data IS NULL
)

-- 1. Assigned to <name>
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'assigned',
  'assigneeName', substring(et.txt FROM '^Assigned to (.+)$')
)
FROM event_text et
WHERE ic.id = et.id
  AND et.txt ~ '^Assigned to .+$';

-- statement-breakpoint

-- 2. Unassigned
UPDATE "issue_comments"
SET event_data = '{"type":"unassigned"}'::jsonb
WHERE is_system = true
  AND event_data IS NULL
  AND content->'content'->0->'content'->0->>'text' = 'Unassigned';

-- statement-breakpoint

-- 3. Status changed from <label> to <label>
-- Map display labels back to enum values using CASE expressions
WITH event_text AS (
  SELECT
    id,
    content->'content'->0->'content'->0->>'text' AS txt
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Status changed from .+ to .+$'
),
parsed AS (
  SELECT
    id,
    substring(txt FROM '^Status changed from (.+) to .+$') AS from_label,
    substring(txt FROM '^Status changed from .+ to (.+)$') AS to_label
  FROM event_text
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'status_changed',
  'from', CASE p.from_label
    WHEN 'New' THEN 'new'
    WHEN 'Confirmed' THEN 'confirmed'
    WHEN 'In Progress' THEN 'in_progress'
    WHEN 'Need Parts' THEN 'need_parts'
    WHEN 'Need Help' THEN 'need_help'
    WHEN 'Pending Owner' THEN 'wait_owner'
    WHEN 'Fixed' THEN 'fixed'
    WHEN 'As Intended' THEN 'wai'
    WHEN 'Won''t Fix' THEN 'wont_fix'
    WHEN 'No Repro' THEN 'no_repro'
    WHEN 'Duplicate' THEN 'duplicate'
    ELSE lower(replace(p.from_label, ' ', '_'))
  END,
  'to', CASE p.to_label
    WHEN 'New' THEN 'new'
    WHEN 'Confirmed' THEN 'confirmed'
    WHEN 'In Progress' THEN 'in_progress'
    WHEN 'Need Parts' THEN 'need_parts'
    WHEN 'Need Help' THEN 'need_help'
    WHEN 'Pending Owner' THEN 'wait_owner'
    WHEN 'Fixed' THEN 'fixed'
    WHEN 'As Intended' THEN 'wai'
    WHEN 'Won''t Fix' THEN 'wont_fix'
    WHEN 'No Repro' THEN 'no_repro'
    WHEN 'Duplicate' THEN 'duplicate'
    ELSE lower(replace(p.to_label, ' ', '_'))
  END
)
FROM parsed p
WHERE ic.id = p.id;

-- statement-breakpoint

-- 4. Severity changed from <label> to <label>
WITH event_text AS (
  SELECT
    id,
    content->'content'->0->'content'->0->>'text' AS txt
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Severity changed from .+ to .+$'
),
parsed AS (
  SELECT
    id,
    substring(txt FROM '^Severity changed from (.+) to .+$') AS from_label,
    substring(txt FROM '^Severity changed from .+ to (.+)$') AS to_label
  FROM event_text
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'severity_changed',
  'from', CASE p.from_label
    WHEN 'Cosmetic' THEN 'cosmetic'
    WHEN 'Minor' THEN 'minor'
    WHEN 'Major' THEN 'major'
    WHEN 'Unplayable' THEN 'unplayable'
    ELSE lower(p.from_label)
  END,
  'to', CASE p.to_label
    WHEN 'Cosmetic' THEN 'cosmetic'
    WHEN 'Minor' THEN 'minor'
    WHEN 'Major' THEN 'major'
    WHEN 'Unplayable' THEN 'unplayable'
    ELSE lower(p.to_label)
  END
)
FROM parsed p
WHERE ic.id = p.id;

-- statement-breakpoint

-- 5. Priority changed from <label> to <label>
WITH event_text AS (
  SELECT
    id,
    content->'content'->0->'content'->0->>'text' AS txt
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Priority changed from .+ to .+$'
),
parsed AS (
  SELECT
    id,
    substring(txt FROM '^Priority changed from (.+) to .+$') AS from_label,
    substring(txt FROM '^Priority changed from .+ to (.+)$') AS to_label
  FROM event_text
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'priority_changed',
  'from', CASE p.from_label
    WHEN 'Low' THEN 'low'
    WHEN 'Medium' THEN 'medium'
    WHEN 'High' THEN 'high'
    ELSE lower(p.from_label)
  END,
  'to', CASE p.to_label
    WHEN 'Low' THEN 'low'
    WHEN 'Medium' THEN 'medium'
    WHEN 'High' THEN 'high'
    ELSE lower(p.to_label)
  END
)
FROM parsed p
WHERE ic.id = p.id;

-- statement-breakpoint

-- 6. Frequency changed from <label> to <label>
WITH event_text AS (
  SELECT
    id,
    content->'content'->0->'content'->0->>'text' AS txt
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Frequency changed from .+ to .+$'
),
parsed AS (
  SELECT
    id,
    substring(txt FROM '^Frequency changed from (.+) to .+$') AS from_label,
    substring(txt FROM '^Frequency changed from .+ to (.+)$') AS to_label
  FROM event_text
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'frequency_changed',
  'from', CASE p.from_label
    WHEN 'Intermittent' THEN 'intermittent'
    WHEN 'Frequent' THEN 'frequent'
    WHEN 'Constant' THEN 'constant'
    ELSE lower(p.from_label)
  END,
  'to', CASE p.to_label
    WHEN 'Intermittent' THEN 'intermittent'
    WHEN 'Frequent' THEN 'frequent'
    WHEN 'Constant' THEN 'constant'
    ELSE lower(p.to_label)
  END
)
FROM parsed p
WHERE ic.id = p.id;
```

- [ ] **Step 2: Test the migration locally against dev data**

Run: `pnpm run db:reset`

This drops tables, re-runs all migrations (including the new 0023), and seeds. Verify no errors.

- [ ] **Step 3: Verify migration results locally**

Run a quick query against local dev DB to check that seed data system events got migrated. Use the local Supabase Postgres:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT
    event_data,
    content->'content'->0->'content'->0->>'text' AS original_text
  FROM issue_comments
  WHERE is_system = true
  LIMIT 10;
"
```

Verify: rows with known patterns have `event_data` populated. If no system events exist in seed data, that's OK — prod migration testing (Task 6) will validate.

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "feat(timeline): add SQL data migration for structured event_data"
```

---

### Task 4: Update write path — createTimelineEvent and all call sites

**Files:**

- Modify: `src/lib/timeline/events.ts:30-42` (the createTimelineEvent function)
- Modify: `src/services/issues.ts:182, 309-314, 563-566, 648-653, 709-714, 770-775`

- [ ] **Step 1: Update createTimelineEvent to accept structured events**

Edit `src/lib/timeline/events.ts`. Replace the existing `createTimelineEvent` function (lines 30-42) with:

```typescript
/**
 * Create a system timeline event for an issue.
 *
 * Writes the structured event to `event_data` and an empty ProseMirror doc
 * to `content` (which satisfies the NOT NULL constraint).
 *
 * @param issueId - The issue to add the event to
 * @param event - Structured event payload
 * @param tx - Optional database transaction
 * @param actorId - Optional user ID of the person who performed the action
 */
export async function createTimelineEvent(
  issueId: string,
  event: TimelineEventData,
  tx: DbTransaction = db,
  actorId?: string | null
): Promise<void> {
  await tx.insert(issueComments).values({
    issueId,
    eventData: event,
    content: { type: "doc", content: [] } as ProseMirrorDoc,
    isSystem: true,
    authorId: actorId ?? null,
  });
}
```

Also update the imports at the top of the file — remove the `plainTextToDoc` import (it's no longer needed in this file) and add the `ProseMirrorDoc` type import:

```typescript
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
```

- [ ] **Step 2: Update call site — issue creation assignment (line 182)**

In `src/services/issues.ts`, find the call at line 182:

```typescript
// Before:
await createTimelineEvent(issue.id, `Assigned to ${assigneeName}`, tx);

// After:
await createTimelineEvent(issue.id, { type: "assigned", assigneeName }, tx);
```

- [ ] **Step 3: Update call site — status change (lines 309-314)**

```typescript
// Before:
const oldLabel = getIssueStatusLabel(oldStatus);
const newLabel = getIssueStatusLabel(status);
await createTimelineEvent(
  issueId,
  `Status changed from ${oldLabel} to ${newLabel}`,
  tx,
  userId
);

// After:
await createTimelineEvent(
  issueId,
  { type: "status_changed", from: oldStatus, to: status },
  tx,
  userId
);
```

Remove the `oldLabel` and `newLabel` variables since they're no longer needed. If `getIssueStatusLabel` is only used for the timeline event at this location, remove that import reference too (but check — it may be used elsewhere in the file).

- [ ] **Step 4: Update call site — assignment change (lines 563-566)**

```typescript
// Before:
const eventMessage = assignedTo ? `Assigned to ${assigneeName}` : "Unassigned";
await createTimelineEvent(issueId, eventMessage, tx, actorId);

// After:
const event: TimelineEventData = assignedTo
  ? { type: "assigned", assigneeName }
  : { type: "unassigned" };
await createTimelineEvent(issueId, event, tx, actorId);
```

Add the `TimelineEventData` import at the top of `issues.ts`:

```typescript
import {
  createTimelineEvent,
  type TimelineEventData,
} from "~/lib/timeline/events";
```

- [ ] **Step 5: Update call site — severity change (lines 648-653)**

```typescript
// Before:
const oldLabel = getIssueSeverityLabel(oldSeverity as IssueSeverity);
const newLabel = getIssueSeverityLabel(severity);
await createTimelineEvent(
  issueId,
  `Severity changed from ${oldLabel} to ${newLabel}`,
  db,
  userId
);

// After:
await createTimelineEvent(
  issueId,
  { type: "severity_changed", from: oldSeverity, to: severity },
  db,
  userId
);
```

- [ ] **Step 6: Update call site — priority change (lines 709-714)**

```typescript
// Before:
const oldLabel = getIssuePriorityLabel(oldPriority as IssuePriority);
const newLabel = getIssuePriorityLabel(priority);
await createTimelineEvent(
  issueId,
  `Priority changed from ${oldLabel} to ${newLabel}`,
  db,
  userId
);

// After:
await createTimelineEvent(
  issueId,
  { type: "priority_changed", from: oldPriority, to: priority },
  db,
  userId
);
```

- [ ] **Step 7: Update call site — frequency change (lines 770-775)**

```typescript
// Before:
const oldLabel = getIssueFrequencyLabel(oldFrequency as IssueFrequency);
const newLabel = getIssueFrequencyLabel(frequency);
await createTimelineEvent(
  issueId,
  `Frequency changed from ${oldLabel} to ${newLabel}`,
  db,
  userId
);

// After:
await createTimelineEvent(
  issueId,
  { type: "frequency_changed", from: oldFrequency, to: frequency },
  db,
  userId
);
```

- [ ] **Step 8: Clean up unused label imports in issues.ts**

After updating all call sites, check if `getIssueSeverityLabel`, `getIssuePriorityLabel`, `getIssueFrequencyLabel` are still used elsewhere in `issues.ts`. If only used for timeline events, remove the imports. `getIssueStatusLabel` may still be used elsewhere — check before removing.

- [ ] **Step 9: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: No type errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/timeline/events.ts src/services/issues.ts
git commit -m "feat(timeline): update write path to produce structured event_data"
```

---

### Task 5: Update read path — IssueTimeline rendering

**Files:**

- Modify: `src/components/issues/IssueTimeline.tsx:54-67, 232-258, 416-431`

- [ ] **Step 1: Update TimelineEvent interface to include eventData**

In `src/components/issues/IssueTimeline.tsx`, update the `TimelineEvent` interface (around line 54) to include `eventData`:

```typescript
interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  author: {
    id?: string | null;
    name: string;
    avatarFallback: string;
  };
  createdAt: Date;
  updatedAt: Date;
  content: ProseMirrorDoc | null;
  eventData?: TimelineEventData | null;
  images?: IssueImage[];
  isSystem: boolean;
}
```

Add the import at the top:

```typescript
import {
  formatTimelineEvent,
  type TimelineEventData,
} from "~/lib/timeline/events";
```

- [ ] **Step 2: Update comment normalization to pass eventData through**

In the `commentEvents` mapping (around line 416-431), add `eventData`:

```typescript
const commentEvents: TimelineEvent[] = issue.comments.map((c) => {
  const authorName = c.author?.name ?? "System";
  return {
    id: c.id,
    type: c.isSystem ? "system" : "comment",
    author: {
      id: c.author?.id ?? null,
      name: authorName,
      avatarFallback: authorName.slice(0, 2).toUpperCase(),
    },
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    content: c.content,
    eventData: c.eventData,
    images: c.images,
    isSystem: c.isSystem,
  };
});
```

- [ ] **Step 3: Update system event rendering to use eventData**

In the `TimelineItem` component, find the system event content rendering (around lines 253-257):

```typescript
// Before:
{event.content && (
  <div className="leading-relaxed text-foreground/80">
    {docToPlainText(event.content)}
  </div>
)}

// After:
<div className="leading-relaxed text-foreground/80">
  {event.eventData
    ? formatTimelineEvent(event.eventData)
    : event.content
      ? docToPlainText(event.content)
      : null}
</div>
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/issues/IssueTimeline.tsx
git commit -m "feat(timeline): update read path to render from structured eventData"
```

---

### Task 6: Update integration tests

**Files:**

- Modify: `src/test/integration/supabase/issue-services.test.ts`

- [ ] **Step 1: Update status change test assertions**

In `issue-services.test.ts`, update the status change test (around line 116-147):

```typescript
it("should update status and create timeline event", async () => {
  const db = await getTestDb();
  const newStatus = "in_progress";

  await updateIssueStatus({
    issueId: testIssue.id,
    status: newStatus,
    userId: testUser.id,
  });

  const updated = await db.query.issues.findFirst({
    where: eq(issues.id, testIssue.id),
  });

  expect(updated?.status).toBe(newStatus);

  // Verify timeline event
  const events = await db.query.issueComments.findMany({
    where: eq(issueComments.issueId, testIssue.id),
    orderBy: desc(issueComments.createdAt),
  });

  const statusEvent = events.find(
    (e) => e.isSystem && (e.eventData as any)?.type === "status_changed"
  );
  expect(statusEvent).toBeDefined();
  expect(statusEvent?.eventData).toEqual({
    type: "status_changed",
    from: "new",
    to: "in_progress",
  });
  expect(statusEvent?.authorId).toBe(testUser.id);
});
```

- [ ] **Step 2: Update severity change test assertions**

```typescript
it("should update severity and create timeline event", async () => {
  const db = await getTestDb();
  const newSeverity = "unplayable";

  await updateIssueSeverity({
    issueId: testIssue.id,
    severity: newSeverity,
    userId: testUser.id,
  });

  const updated = await db.query.issues.findFirst({
    where: eq(issues.id, testIssue.id),
  });

  expect(updated?.severity).toBe(newSeverity);

  const event = await db.query.issueComments.findFirst({
    where: eq(issueComments.issueId, testIssue.id),
    orderBy: desc(issueComments.createdAt),
  });

  expect(event?.eventData).toEqual({
    type: "severity_changed",
    from: "minor",
    to: "unplayable",
  });
  expect(event?.authorId).toBe(testUser.id);
});
```

- [ ] **Step 3: Update priority change test assertions**

```typescript
it("should update priority and create timeline event", async () => {
  const db = await getTestDb();
  const newPriority = "high";

  await updateIssuePriority({
    issueId: testIssue.id,
    priority: newPriority,
    userId: testUser.id,
  });

  const updated = await db.query.issues.findFirst({
    where: eq(issues.id, testIssue.id),
  });

  expect(updated?.priority).toBe(newPriority);

  const event = await db.query.issueComments.findFirst({
    where: eq(issueComments.issueId, testIssue.id),
    orderBy: desc(issueComments.createdAt),
  });

  expect(event?.eventData).toEqual({
    type: "priority_changed",
    from: "low",
    to: "high",
  });
  expect(event?.authorId).toBe(testUser.id);
});
```

- [ ] **Step 4: Update frequency change test assertions**

```typescript
it("should update frequency and create timeline event", async () => {
  const db = await getTestDb();
  const newFrequency = "constant";

  await updateIssueFrequency({
    issueId: testIssue.id,
    frequency: newFrequency,
    userId: testUser.id,
  });

  const updated = await db.query.issues.findFirst({
    where: eq(issues.id, testIssue.id),
  });

  expect(updated?.frequency).toBe(newFrequency);

  const event = await db.query.issueComments.findFirst({
    where: eq(issueComments.issueId, testIssue.id),
    orderBy: desc(issueComments.createdAt),
  });

  expect(event?.eventData).toEqual({
    type: "frequency_changed",
    from: "intermittent",
    to: "constant",
  });
  expect(event?.authorId).toBe(testUser.id);
});
```

- [ ] **Step 5: Remove unused docToPlainText import if no longer needed**

Check if `docToPlainText` is still used in the test file. The `createIssue` tests (line 237+) still use `plainTextToDoc`, so keep that. But `docToPlainText` was only used for timeline event assertions — remove it if all references are gone.

- [ ] **Step 6: Run all integration tests**

Run: `pnpm exec vitest run src/test/integration/supabase/issue-services.test.ts`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/test/integration/supabase/issue-services.test.ts
git commit -m "test(timeline): update integration tests to assert structured eventData"
```

---

### Task 7: Run preflight checks

**Files:** None — validation only.

- [ ] **Step 1: Run pnpm run check**

Run: `pnpm run check`
Expected: Types, lint, format, unit tests all pass.

- [ ] **Step 2: Run full preflight**

Run: `pnpm run preflight`
Expected: All checks pass including build and integration tests.

- [ ] **Step 3: Fix any issues found**

If preflight fails, fix the issues and re-run. Common issues:

- Unused imports (from removed label function calls)
- Type mismatches in test assertions
- Lint warnings on `any` casts in test assertions (use `as unknown as TimelineEventData` instead)

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: address preflight issues"
```

---

### Task 8: Test migration against production data

**Files:** None — validation only. This task is **required before merge**.

- [ ] **Step 1: Create production database backup**

Run: `pnpm run db:backup`

This requires the Supabase CLI to be linked to the production project (`pinpoint-prod`, ref `udhesuizjsgxfeotqybn`). If not linked, run `supabase link --project-ref udhesuizjsgxfeotqybn` first.

Expected: Backup file created at `~/.pinpoint/db-backups/pinpoint_prod_<timestamp>.sql`

- [ ] **Step 2: Seed local database from production backup**

Run: `pnpm run db:seed:from-prod`

This will prompt for confirmation. Type `y`. It drops local tables, runs all migrations (including the new 0023 with data migration), then loads production data.

**Important**: The migration runs as part of `db:migrate` _before_ the prod data is loaded. So the prod data's `event_data` column will be NULL after seeding. You need to re-run just the data migration portion.

- [ ] **Step 3: Re-run the data migration against production data**

Since `db:seed:from-prod` loads raw prod data _after_ migrations, the data migration UPDATE statements need to run again. Extract and run just the UPDATE statements from the migration file:

```bash
# Extract the data migration SQL (everything after the ALTER TABLE line)
# and run it against local DB
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f <(
  sed -n '/-- Data migration/,$p' drizzle/0023_*.sql
)
```

- [ ] **Step 4: Verify migration completeness — check for unmatched rows**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT
    id,
    content->'content'->0->'content'->0->>'text' AS original_text
  FROM issue_comments
  WHERE is_system = true AND event_data IS NULL;
"
```

Expected: Zero rows returned. If any rows appear, their `original_text` values represent string patterns not handled by the migration. Add additional CASE/regex handling for any unexpected patterns.

- [ ] **Step 5: Verify migration correctness — spot-check structured payloads**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT
    event_data->>'type' AS event_type,
    event_data,
    content->'content'->0->'content'->0->>'text' AS original_text
  FROM issue_comments
  WHERE is_system = true AND event_data IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 20;
"
```

Verify: The `event_data` JSON matches what you'd expect from the `original_text`. Status labels should map to correct enum values (e.g., "In Progress" → `in_progress`, "As Intended" → `wai`, "Pending Owner" → `wait_owner`).

- [ ] **Step 6: Verify migration statistics**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT
    event_data->>'type' AS event_type,
    count(*) AS count
  FROM issue_comments
  WHERE is_system = true AND event_data IS NOT NULL
  GROUP BY event_data->>'type'
  ORDER BY count DESC;
"
```

This shows the distribution of event types in production data. Sanity check: all 6 types should appear (assuming all event types have been used at least once in production).

- [ ] **Step 7: Verify UI renders correctly with production data**

Start the dev server: `pnpm run dev`

Navigate to several issues that have timeline events. Verify:

- System events display the same text as before
- No blank or missing event text
- No JavaScript console errors
- User comments still render normally with rich text

- [ ] **Step 8: Document results**

Record the migration results (row counts, any unmatched patterns, any issues found) in the PR description for reviewer reference.

---

### Task 9: Create PR

- [ ] **Step 1: Push branch and create PR**

```bash
git push -u origin HEAD
```

Create PR with title like `feat(timeline): convert events to structured data (PinPoint-cks)` and include:

- Summary of what changed
- Migration validation results from Task 8
- Note that visual output is unchanged
