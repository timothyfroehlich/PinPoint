# Machine Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the V1 Machine Timeline tab — a chronological log on every machine page that captures lifecycle events, issue events, and freeform Tiptap user comments with a single tag and a dropdown tag filter.

**Architecture:** A new `timeline_events` table (org-wide, `machineId` nullable for future PBM/global rows) stores everything as discriminated-union JSON variants. Machine mutation actions emit `lifecycle` rows; the five overlap issue actions duplicate-write — one row to `issueComments` (existing path, unchanged) and one row to `timeline_events` (new) in the same transaction. The timeline tab is a fresh route under `/m/[initials]/timeline/` with a compact-on-focus composer at the top, a Select-based tag filter, and a compact-log row renderer.

**Tech Stack:** Drizzle ORM, PostgreSQL jsonb, TypeScript strictest, Zod, Tiptap (existing `RichTextEditor`), shadcn/ui Select, Vitest (PGlite integration), Playwright.

**Spec:** `docs/superpowers/specs/2026-05-17-machine-timeline-design.md`

**Bead:** PP-0x98

---

## File Structure

| File                                                                   | Responsibility                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/timeline/machine-tags.ts`                                     | `TIMELINE_TAGS` const, `RESERVED_TAGS`, `TimelineTag` type, `tagSchema` Zod enum                       |
| `src/lib/timeline/machine-event-types.ts`                              | `MachineTimelineEventData` discriminated union                                                         |
| `src/lib/timeline/machine-events.ts`                                   | `createMachineTimelineEvent`, `createMachineComment`, `softDeleteMachineComment`, `getMachineTimeline` |
| `src/lib/timeline/format-machine-event.ts`                             | `formatMachineEvent(eventData): string` for system-event display text                                  |
| `src/server/db/schema.ts`                                              | Add `timelineEvents` table                                                                             |
| `drizzle/00XX_*.sql`                                                   | Generated migration (table + indexes)                                                                  |
| `src/app/(app)/m/actions.ts`                                           | Hook lifecycle emitters into 6 machine mutation actions                                                |
| `src/app/(app)/issues/actions.ts`                                      | Hook issue duplicate-write into 5 issue actions (already emit to issueComments)                        |
| `src/lib/permissions/matrix.ts`                                        | Add `machines.timeline.comment.delete` ownership-context permission                                    |
| `src/app/(app)/m/[initials]/timeline/page.tsx`                         | Server component: query, filter parsing, layout                                                        |
| `src/app/(app)/m/[initials]/timeline/actions.ts`                       | `addMachineCommentAction`, `deleteMachineCommentAction`                                                |
| `src/components/machines/MachineTabStrip.tsx`                          | Add `{ slug: "timeline", label: "Timeline" }` to TABS                                                  |
| `src/components/machines/timeline/MachineTimelineList.tsx`             | Top-level client component, holds the list + handles realtime if any                                   |
| `src/components/machines/timeline/MachineTimelineCommentRow.tsx`       | User-comment row renderer (avatar + body)                                                              |
| `src/components/machines/timeline/MachineTimelineSystemRow.tsx`        | System-event row renderer (italic single-line)                                                         |
| `src/components/machines/timeline/MachineTimelineTombstoneRow.tsx`     | Soft-deleted comment placeholder                                                                       |
| `src/components/machines/timeline/MachineTimelineComposer.tsx`         | Compact-on-focus composer with tag select                                                              |
| `src/components/machines/timeline/MachineTimelineFilter.tsx`           | Tag dropdown with `?tag=` URL param                                                                    |
| `src/lib/timeline/machine-tags.test.ts`                                | Unit tests for tag validation                                                                          |
| `src/lib/timeline/format-machine-event.test.ts`                        | Unit tests for system-event text rendering                                                             |
| `src/test/integration/supabase/machine-timeline-events.test.ts`        | Integration tests for write helpers + auto-event hooks                                                 |
| `src/test/integration/supabase/issue-actions-machine-timeline.test.ts` | Integration tests for issue actions' duplicate-write                                                   |
| `src/test/integration/supabase/machine-timeline-permissions.test.ts`   | Integration tests for delete ownership-context                                                         |
| `e2e/full/machine-timeline.spec.ts`                                    | E2E: comment add, delete, tag filter, reassignment dual-row                                            |
| `e2e/smoke/responsive-overflow.spec.ts`                                | Add new `/m/[initials]/timeline` route                                                                 |

---

### Task 1: Tag system (TS const + Zod enum + unit tests)

**Files:**

- Create: `src/lib/timeline/machine-tags.ts`
- Create: `src/lib/timeline/machine-tags.test.ts`

- [x] **Step 1: Write failing tests**

Create `src/lib/timeline/machine-tags.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  TIMELINE_TAGS,
  RESERVED_TAGS,
  tagSchema,
  userTagSchema,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";

describe("machine-tags", () => {
  it("exposes the V1 tag list", () => {
    expect([...TIMELINE_TAGS]).toEqual([
      "lifecycle",
      "issue",
      "maintenance",
      "event",
      "cleaning",
    ]);
  });

  it("marks lifecycle and issue as reserved", () => {
    expect([...RESERVED_TAGS]).toEqual(["lifecycle", "issue"]);
  });

  it("tagSchema accepts any built-in tag", () => {
    for (const tag of TIMELINE_TAGS) {
      expect(tagSchema.parse(tag)).toBe(tag);
    }
  });

  it("tagSchema rejects unknown tags", () => {
    expect(() => tagSchema.parse("software_update")).toThrow();
    expect(() => tagSchema.parse("")).toThrow();
    expect(() => tagSchema.parse("LIFECYCLE")).toThrow();
  });

  it("userTagSchema rejects reserved tags", () => {
    expect(() => userTagSchema.parse("lifecycle")).toThrow();
    expect(() => userTagSchema.parse("issue")).toThrow();
    expect(userTagSchema.parse("maintenance")).toBe("maintenance");
    expect(userTagSchema.parse("event")).toBe("event");
    expect(userTagSchema.parse("cleaning")).toBe("cleaning");
  });

  it("TimelineTag type narrows correctly", () => {
    const t: TimelineTag = "maintenance";
    // @ts-expect-error — "software_update" is not in the union
    const bad: TimelineTag = "software_update";
    expect(t).toBe("maintenance");
    expect(bad).toBe("software_update"); // runtime still works, compile blocks
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/timeline/machine-tags.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement the module**

Create `src/lib/timeline/machine-tags.ts`:

```typescript
import { z } from "zod";

export const TIMELINE_TAGS = [
  "lifecycle",
  "issue",
  "maintenance",
  "event",
  "cleaning",
] as const;

export type TimelineTag = (typeof TIMELINE_TAGS)[number];

export const RESERVED_TAGS = [
  "lifecycle",
  "issue",
] as const satisfies readonly TimelineTag[];

export type ReservedTag = (typeof RESERVED_TAGS)[number];

export const tagSchema = z.enum(TIMELINE_TAGS);

export const userTagSchema = z
  .enum(TIMELINE_TAGS)
  .refine(
    (tag): tag is Exclude<TimelineTag, ReservedTag> =>
      !(RESERVED_TAGS as readonly string[]).includes(tag),
    { message: "Reserved tags cannot be applied to user comments" }
  );

const TAG_LABELS: Record<TimelineTag, string> = {
  lifecycle: "Lifecycle",
  issue: "Issue",
  maintenance: "Maintenance",
  event: "Event",
  cleaning: "Cleaning",
};

export function getTagLabel(tag: TimelineTag): string {
  return TAG_LABELS[tag];
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/timeline/machine-tags.test.ts`
Expected: PASS — 6 tests green.

- [x] **Step 5: Commit**

```bash
git add src/lib/timeline/machine-tags.ts src/lib/timeline/machine-tags.test.ts
git commit -m "feat(machines): machine timeline tag system (TS const + Zod enum) (PP-0x98)"
```

---

### Task 2: Event data discriminated union types

**Files:**

- Create: `src/lib/timeline/machine-event-types.ts`

- [x] **Step 1: Create the type module**

Create `src/lib/timeline/machine-event-types.ts`:

```typescript
import type { PresenceStatus } from "~/lib/types/machine";

/**
 * Discriminated union of every structured event variant that can be stored
 * in `timeline_events.event_data`. The `kind` field is the discriminator.
 *
 * Comment rows (sourceType='comment') have eventData = null and store the
 * ProseMirror document in `content` instead.
 */
export type MachineTimelineEventData =
  // === sourceType='lifecycle' (auto-emitted from machine mutation actions) ===
  | { kind: "machine_added" }
  | { kind: "owner_set"; toOwnerId: string; toOwnerName: string }
  | {
      kind: "owner_changed";
      fromOwnerId: string | null;
      fromOwnerName: string | null;
      toOwnerId: string | null;
      toOwnerName: string | null;
    }
  | { kind: "name_changed"; from: string; to: string }
  | { kind: "presence_changed"; from: PresenceStatus; to: PresenceStatus }
  | { kind: "description_updated" }
  | { kind: "tournament_notes_updated" }
  | { kind: "owner_requirements_updated" }
  | { kind: "owner_notes_updated" }
  // === sourceType='issue' (duplicate-written from issue actions) ===
  | {
      kind: "issue_opened";
      issueId: string;
      issueNumber: number;
      openedByName: string;
      title: string;
    }
  | {
      kind: "issue_closed";
      issueId: string;
      issueNumber: number;
      closedByName: string;
      title: string;
    }
  | {
      kind: "issue_status_changed";
      issueId: string;
      issueNumber: number;
      from: string;
      to: string;
    }
  | {
      kind: "issue_assigned";
      issueId: string;
      issueNumber: number;
      assigneeName: string;
    }
  | {
      kind: "issue_unassigned";
      issueId: string;
      issueNumber: number;
    }
  | {
      kind: "issue_reassigned_out";
      issueId: string;
      issueNumber: number;
      toMachineName: string;
      toMachineId: string;
    }
  | {
      kind: "issue_reassigned_in";
      issueId: string;
      issueNumber: number;
      fromMachineName: string;
      fromMachineId: string;
    };

export type MachineTimelineEventKind = MachineTimelineEventData["kind"];
```

Verify `~/lib/types/machine` exports `PresenceStatus`. If not, inline the union (`"on_the_floor" | "off_the_floor" | "on_loan" | "pending_arrival" | "removed"`) and add a `// TODO(PP-0x98): import from canonical location when factored out` comment, then fix in a later commit.

- [x] **Step 2: Verify TypeScript compiles**

Run: `pnpm run typecheck`
Expected: PASS — no errors.

- [x] **Step 3: Commit**

```bash
git add src/lib/timeline/machine-event-types.ts
git commit -m "feat(machines): MachineTimelineEventData discriminated union (PP-0x98)"
```

---

### Task 3: Add `timeline_events` table to Drizzle schema + migration

**Files:**

- Modify: `src/server/db/schema.ts` (add table)
- Generated: `drizzle/00XX_*.sql` (Drizzle generates)

- [x] **Step 1: Add the table to schema.ts**

Open `src/server/db/schema.ts`. After the `issueComments` table definition, add:

```typescript
export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    machineId: uuid("machine_id").references(() => machines.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceType: text("source_type").notNull(),
    tag: text("tag").notNull(),
    authorId: uuid("author_id").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    content: jsonb("content").$type<ProseMirrorDoc>(),
    eventData: jsonb("event_data").$type<MachineTimelineEventData>(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    machineCreatedIdx: index("timeline_events_machine_created").on(
      table.machineId,
      table.createdAt.desc()
    ),
    machineTagIdx: index("timeline_events_machine_tag").on(
      table.machineId,
      table.tag
    ),
  })
);
```

Add the imports near the top if missing:

```typescript
import { type MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
```

Check existing imports — `index`, `jsonb`, `text`, `timestamp`, `uuid`, `pgTable` should already be imported.

- [x] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: Drizzle creates `drizzle/00XX_<name>.sql` adding the `timeline_events` table + two indexes, plus a snapshot under `drizzle/meta/`. Verify the SQL contains `CREATE TABLE "timeline_events"`, both indexes, and the four foreign-key constraints.

- [x] **Step 3: Apply migration locally**

Run: `pnpm db:migrate`
Expected: Migration applies cleanly. Verify with `pnpm db:generate` — should report "No schema changes".

- [x] **Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/00XX_*.sql drizzle/meta/
git commit -m "feat(db): add timeline_events table (PP-0x98)"
```

---

### Task 4: Write helpers (`createMachineTimelineEvent`, `createMachineComment`, `softDeleteMachineComment`)

**Files:**

- Create: `src/lib/timeline/machine-events.ts`
- Create: `src/test/integration/supabase/machine-timeline-events.test.ts`

- [x] **Step 1: Write failing integration tests**

Create `src/test/integration/machine-timeline-events.test.ts` (PGlite location; the supabase/ path in the original draft was wrong — those are Supabase-service tests, not PGlite tests):

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import { useDb } from "~/test/integration/supabase/helpers/db";
import { seedOrgWithMachine } from "~/test/integration/supabase/helpers/seed";
import { timelineEvents } from "~/server/db/schema";
import {
  createMachineTimelineEvent,
  createMachineComment,
  softDeleteMachineComment,
} from "~/lib/timeline/machine-events";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

describe("machine-events helpers", () => {
  const db = useDb();

  beforeEach(async () => {
    await db().delete(timelineEvents);
  });

  describe("createMachineTimelineEvent", () => {
    it("inserts a lifecycle row with eventData and null content", async () => {
      const { machine, user } = await seedOrgWithMachine(db());

      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: { kind: "machine_added" },
          actorId: user.id,
        },
        db()
      );

      const rows = await db()
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machine.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        sourceType: "lifecycle",
        tag: "lifecycle",
        authorId: user.id,
        content: null,
        eventData: { kind: "machine_added" },
        deletedAt: null,
      });
    });

    it("inserts an issue row with structured eventData", async () => {
      const { machine, user } = await seedOrgWithMachine(db());

      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "issue",
          tag: "issue",
          eventData: {
            kind: "issue_opened",
            issueId: "00000000-0000-0000-0000-000000000001",
            issueNumber: 42,
            openedByName: "Tim",
            title: "Flipper broken",
          },
          actorId: user.id,
        },
        db()
      );

      const [row] = await db().select().from(timelineEvents);
      expect(row?.eventData).toEqual({
        kind: "issue_opened",
        issueId: "00000000-0000-0000-0000-000000000001",
        issueNumber: 42,
        openedByName: "Tim",
        title: "Flipper broken",
      });
    });
  });

  describe("createMachineComment", () => {
    it("inserts a comment row with content and null eventData", async () => {
      const { machine, user } = await seedOrgWithMachine(db());
      const doc: ProseMirrorDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Cleaned the playfield" }],
          },
        ],
      };

      await createMachineComment(
        machine.id,
        { content: doc, tag: "cleaning", authorId: user.id },
        db()
      );

      const [row] = await db().select().from(timelineEvents);
      expect(row).toMatchObject({
        sourceType: "comment",
        tag: "cleaning",
        authorId: user.id,
        content: doc,
        eventData: null,
      });
    });
  });

  describe("softDeleteMachineComment", () => {
    it("sets deletedAt + deletedBy without touching content", async () => {
      const { machine, user } = await seedOrgWithMachine(db());
      const doc: ProseMirrorDoc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x" }] },
        ],
      };
      await createMachineComment(
        machine.id,
        { content: doc, tag: "maintenance", authorId: user.id },
        db()
      );
      const [inserted] = await db().select().from(timelineEvents);
      if (!inserted) throw new Error("seed failed");

      await softDeleteMachineComment(inserted.id, { deletedBy: user.id }, db());

      const [row] = await db()
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.id, inserted.id));
      expect(row?.deletedAt).toBeInstanceOf(Date);
      expect(row?.deletedBy).toBe(user.id);
      expect(row?.content).toEqual(doc);
    });
  });
});
```

If `seedOrgWithMachine` doesn't exist, look in `src/test/integration/supabase/helpers/seed.ts` for the canonical seed helpers and either reuse an existing one (`seedOrgWithUser` + manual machine insert) or add `seedOrgWithMachine` to the helpers file in a small auxiliary step.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: FAIL — helpers module not found.

- [x] **Step 3: Implement the helpers**

Create `src/lib/timeline/machine-events.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { TxOrDb } from "~/server/db/types";
import { timelineEvents } from "~/server/db/schema";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

type SourceType = "comment" | "lifecycle" | "issue";

export interface CreateTimelineEventArgs {
  sourceType: Exclude<SourceType, "comment">;
  tag: TimelineTag;
  eventData: MachineTimelineEventData;
  actorId?: string;
}

export interface CreateMachineCommentArgs {
  content: ProseMirrorDoc;
  tag: TimelineTag;
  authorId: string;
}

export interface SoftDeleteArgs {
  deletedBy: string;
}

export async function createMachineTimelineEvent(
  machineId: string,
  args: CreateTimelineEventArgs,
  tx: TxOrDb
): Promise<void> {
  await tx.insert(timelineEvents).values({
    machineId,
    sourceType: args.sourceType,
    tag: args.tag,
    eventData: args.eventData,
    authorId: args.actorId ?? null,
  });
}

export async function createMachineComment(
  machineId: string,
  args: CreateMachineCommentArgs,
  tx: TxOrDb
): Promise<void> {
  await tx.insert(timelineEvents).values({
    machineId,
    sourceType: "comment",
    tag: args.tag,
    content: args.content,
    authorId: args.authorId,
  });
}

export async function softDeleteMachineComment(
  id: string,
  args: SoftDeleteArgs,
  tx: TxOrDb
): Promise<void> {
  await tx
    .update(timelineEvents)
    .set({
      deletedAt: new Date(),
      deletedBy: args.deletedBy,
    })
    .where(eq(timelineEvents.id, id));
}
```

Verify `~/server/db/types` exports `TxOrDb` (it's the canonical alias). If not, look for `Tx | typeof db` patterns elsewhere and follow what `createTimelineEvent` in `src/lib/timeline/events.ts` does.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: PASS — all 4 helper tests green.

- [x] **Step 5: Commit**

```bash
git add src/lib/timeline/machine-events.ts \
        src/test/integration/machine-timeline-events.test.ts \
        src/test/setup/pglite.ts \
        src/test/setup/schema.sql
git commit -m "feat(machines): machine-timeline write helpers + PGlite test infra (PP-0x98)"
```

Implementation notes (filed during execution):

- Real Drizzle transaction type is `DbTransaction` from `~/server/db`, not `TxOrDb` from `~/server/db/types`. Helpers default `tx = db` to mirror `createTimelineEvent` in `src/lib/timeline/events.ts`.
- PGlite, not Supabase: tests use `setupTestDb()` + `getTestDb()` from `~/test/setup/pglite` with raw factories (`createTestUser`, `createTestMachine`) inserted directly via `db.insert(...).values(factory())`.
- Pre-flight infra: added `await testDb.delete(schema.timelineEvents);` to `cleanupTestDb()` before all child-table deletes (FK ordering), and regenerated `src/test/setup/schema.sql` via `pnpm run test:_generate-schema` so the new table exists in the PGlite test schema.

---

### Task 5: `formatMachineEvent` text renderer + unit tests

**Files:**

- Create: `src/lib/timeline/format-machine-event.ts`
- Create: `src/lib/timeline/format-machine-event.test.ts`

- [x] **Step 1: Write failing unit tests**

Create `src/lib/timeline/format-machine-event.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatMachineEvent } from "~/lib/timeline/format-machine-event";

describe("formatMachineEvent", () => {
  it("formats machine_added", () => {
    expect(formatMachineEvent({ kind: "machine_added" })).toBe("Machine added");
  });

  it("formats owner_set", () => {
    expect(
      formatMachineEvent({
        kind: "owner_set",
        toOwnerId: "u1",
        toOwnerName: "Tim",
      })
    ).toBe("Owner set to Tim");
  });

  it("formats owner_changed (named -> named)", () => {
    expect(
      formatMachineEvent({
        kind: "owner_changed",
        fromOwnerId: "u1",
        fromOwnerName: "Alex",
        toOwnerId: "u2",
        toOwnerName: "Sam",
      })
    ).toBe("Owner changed from Alex to Sam");
  });

  it("formats owner_changed (named -> unassigned)", () => {
    expect(
      formatMachineEvent({
        kind: "owner_changed",
        fromOwnerId: "u1",
        fromOwnerName: "Alex",
        toOwnerId: null,
        toOwnerName: null,
      })
    ).toBe("Owner removed (was Alex)");
  });

  it("formats owner_changed (unassigned -> named)", () => {
    expect(
      formatMachineEvent({
        kind: "owner_changed",
        fromOwnerId: null,
        fromOwnerName: null,
        toOwnerId: "u2",
        toOwnerName: "Sam",
      })
    ).toBe("Owner set to Sam");
  });

  it("formats name_changed", () => {
    expect(
      formatMachineEvent({ kind: "name_changed", from: "ST", to: "ST LE" })
    ).toBe('Name changed from "ST" to "ST LE"');
  });

  it("formats presence_changed", () => {
    expect(
      formatMachineEvent({
        kind: "presence_changed",
        from: "on_the_floor",
        to: "off_the_floor",
      })
    ).toBe("Availability changed from On the floor to Off the floor");
  });

  it("formats prose-field markers", () => {
    expect(formatMachineEvent({ kind: "description_updated" })).toBe(
      "Description updated"
    );
    expect(formatMachineEvent({ kind: "tournament_notes_updated" })).toBe(
      "Tournament notes updated"
    );
    expect(formatMachineEvent({ kind: "owner_requirements_updated" })).toBe(
      "Owner requirements updated"
    );
    expect(formatMachineEvent({ kind: "owner_notes_updated" })).toBe(
      "Owner notes updated"
    );
  });

  it("formats issue_opened", () => {
    expect(
      formatMachineEvent({
        kind: "issue_opened",
        issueId: "i1",
        issueNumber: 42,
        openedByName: "Maria",
        title: "Flipper broken",
      })
    ).toBe("Issue #42 opened by Maria");
  });

  it("formats issue_closed", () => {
    expect(
      formatMachineEvent({
        kind: "issue_closed",
        issueId: "i1",
        issueNumber: 42,
        closedByName: "Tim",
        title: "Flipper broken",
      })
    ).toBe("Issue #42 closed by Tim");
  });

  it("formats issue_status_changed", () => {
    expect(
      formatMachineEvent({
        kind: "issue_status_changed",
        issueId: "i1",
        issueNumber: 42,
        from: "new",
        to: "in_progress",
      })
    ).toBe("Issue #42 status changed from New to In Progress");
  });

  it("formats issue_assigned", () => {
    expect(
      formatMachineEvent({
        kind: "issue_assigned",
        issueId: "i1",
        issueNumber: 42,
        assigneeName: "Tim",
      })
    ).toBe("Issue #42 assigned to Tim");
  });

  it("formats issue_unassigned", () => {
    expect(
      formatMachineEvent({
        kind: "issue_unassigned",
        issueId: "i1",
        issueNumber: 42,
      })
    ).toBe("Issue #42 unassigned");
  });

  it("formats issue_reassigned_out", () => {
    expect(
      formatMachineEvent({
        kind: "issue_reassigned_out",
        issueId: "i1",
        issueNumber: 42,
        toMachineId: "m2",
        toMachineName: "Iron Maiden",
      })
    ).toBe("Issue #42 moved to Iron Maiden");
  });

  it("formats issue_reassigned_in", () => {
    expect(
      formatMachineEvent({
        kind: "issue_reassigned_in",
        issueId: "i1",
        issueNumber: 42,
        fromMachineId: "m1",
        fromMachineName: "Stranger Things",
      })
    ).toBe("Issue #42 received from Stranger Things");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/timeline/format-machine-event.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement the formatter**

Create `src/lib/timeline/format-machine-event.ts`:

```typescript
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { PresenceStatus } from "~/lib/types/machine";
import { getIssueStatusLabel } from "~/lib/issue/status-labels";

const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  on_the_floor: "On the floor",
  off_the_floor: "Off the floor",
  on_loan: "On loan",
  pending_arrival: "Pending arrival",
  removed: "Removed",
};

export function formatMachineEvent(event: MachineTimelineEventData): string {
  switch (event.kind) {
    case "machine_added":
      return "Machine added";
    case "owner_set":
      return `Owner set to ${event.toOwnerName}`;
    case "owner_changed":
      if (event.toOwnerName === null && event.fromOwnerName !== null) {
        return `Owner removed (was ${event.fromOwnerName})`;
      }
      if (event.fromOwnerName === null && event.toOwnerName !== null) {
        return `Owner set to ${event.toOwnerName}`;
      }
      return `Owner changed from ${event.fromOwnerName ?? "—"} to ${event.toOwnerName ?? "—"}`;
    case "name_changed":
      return `Name changed from "${event.from}" to "${event.to}"`;
    case "presence_changed":
      return `Availability changed from ${PRESENCE_LABELS[event.from]} to ${PRESENCE_LABELS[event.to]}`;
    case "description_updated":
      return "Description updated";
    case "tournament_notes_updated":
      return "Tournament notes updated";
    case "owner_requirements_updated":
      return "Owner requirements updated";
    case "owner_notes_updated":
      return "Owner notes updated";
    case "issue_opened":
      return `Issue #${event.issueNumber} opened by ${event.openedByName}`;
    case "issue_closed":
      return `Issue #${event.issueNumber} closed by ${event.closedByName}`;
    case "issue_status_changed":
      return `Issue #${event.issueNumber} status changed from ${getIssueStatusLabel(event.from)} to ${getIssueStatusLabel(event.to)}`;
    case "issue_assigned":
      return `Issue #${event.issueNumber} assigned to ${event.assigneeName}`;
    case "issue_unassigned":
      return `Issue #${event.issueNumber} unassigned`;
    case "issue_reassigned_out":
      return `Issue #${event.issueNumber} moved to ${event.toMachineName}`;
    case "issue_reassigned_in":
      return `Issue #${event.issueNumber} received from ${event.fromMachineName}`;
  }
}
```

Verify `~/lib/issue/status-labels` exports `getIssueStatusLabel`. If the helper has a different name (look in `src/lib/issue/`), update the import. If no such helper exists, inline the status label map next to `PRESENCE_LABELS` using values from `STATUS_CONFIG` in `src/lib/issue/status.ts` (or equivalent — see existing issue timeline rendering).

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/timeline/format-machine-event.test.ts`
Expected: PASS — all 16 tests green.

- [x] **Step 5: Commit**

```bash
git add src/lib/timeline/format-machine-event.ts src/lib/timeline/format-machine-event.test.ts
git commit -m "feat(machines): formatMachineEvent text renderer (PP-0x98)"
```

---

### Task 6: `getMachineTimeline` read query

**Files:**

- Modify: `src/lib/timeline/machine-events.ts` (add export)
- Create: integration test (append to `machine-timeline-events.test.ts`)

- [x] **Step 1: Write failing tests (append to existing file)**

Append to `src/test/integration/supabase/machine-timeline-events.test.ts`:

```typescript
import { getMachineTimeline } from "~/lib/timeline/machine-events";

describe("getMachineTimeline", () => {
  it("returns rows newest-first, scoped to machineId", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    const otherMachine = await seedOrgWithMachine(db());

    await createMachineTimelineEvent(
      machine.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        actorId: user.id,
      },
      db()
    );
    await createMachineComment(
      machine.id,
      {
        content: { type: "doc", content: [] },
        tag: "maintenance",
        authorId: user.id,
      },
      db()
    );
    await createMachineTimelineEvent(
      otherMachine.machine.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
      },
      db()
    );

    const rows = await getMachineTimeline(db(), { machineId: machine.id });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.sourceType).toBe("comment");
    expect(rows[1]?.sourceType).toBe("lifecycle");
    expect(rows.every((r) => r.machineId === machine.id)).toBe(true);
  });

  it("filters by tag when provided", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    await createMachineComment(
      machine.id,
      {
        content: { type: "doc", content: [] },
        tag: "maintenance",
        authorId: user.id,
      },
      db()
    );
    await createMachineComment(
      machine.id,
      {
        content: { type: "doc", content: [] },
        tag: "cleaning",
        authorId: user.id,
      },
      db()
    );

    const rows = await getMachineTimeline(db(), {
      machineId: machine.id,
      tag: "maintenance",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tag).toBe("maintenance");
  });

  it("includes soft-deleted rows (UI handles tombstone display)", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    await createMachineComment(
      machine.id,
      {
        content: { type: "doc", content: [] },
        tag: "maintenance",
        authorId: user.id,
      },
      db()
    );
    const [row] = await db().select().from(timelineEvents);
    if (!row) throw new Error("seed failed");
    await softDeleteMachineComment(row.id, { deletedBy: user.id }, db());

    const rows = await getMachineTimeline(db(), { machineId: machine.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: FAIL — `getMachineTimeline` not exported.

- [x] **Step 3: Implement the query**

Append to `src/lib/timeline/machine-events.ts`:

```typescript
import { and, desc } from "drizzle-orm";
import { userProfiles } from "~/server/db/schema";
import type { TimelineTag } from "~/lib/timeline/machine-tags";

export interface GetMachineTimelineArgs {
  machineId: string;
  tag?: TimelineTag;
}

export interface MachineTimelineRow {
  id: string;
  machineId: string | null;
  createdAt: Date;
  sourceType: string;
  tag: string;
  authorId: string | null;
  authorName: string | null;
  content: ProseMirrorDoc | null;
  eventData: MachineTimelineEventData | null;
  deletedAt: Date | null;
  deletedById: string | null;
  deletedByName: string | null;
}

export async function getMachineTimeline(
  tx: TxOrDb,
  args: GetMachineTimelineArgs
): Promise<MachineTimelineRow[]> {
  const author = alias(userProfiles, "author");
  const deleter = alias(userProfiles, "deleter");

  const rows = await tx
    .select({
      id: timelineEvents.id,
      machineId: timelineEvents.machineId,
      createdAt: timelineEvents.createdAt,
      sourceType: timelineEvents.sourceType,
      tag: timelineEvents.tag,
      authorId: timelineEvents.authorId,
      authorName: author.name,
      content: timelineEvents.content,
      eventData: timelineEvents.eventData,
      deletedAt: timelineEvents.deletedAt,
      deletedById: timelineEvents.deletedBy,
      deletedByName: deleter.name,
    })
    .from(timelineEvents)
    .leftJoin(author, eq(timelineEvents.authorId, author.id))
    .leftJoin(deleter, eq(timelineEvents.deletedBy, deleter.id))
    .where(
      and(
        eq(timelineEvents.machineId, args.machineId),
        args.tag ? eq(timelineEvents.tag, args.tag) : undefined
      )
    )
    .orderBy(desc(timelineEvents.createdAt));

  return rows;
}
```

Add `alias` to the `drizzle-orm` import. Note: this query intentionally does NOT JOIN `machines` — the caller already knows the machine. It DOES join `userProfiles` twice (author + deleter) for display names.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: PASS — all 7 tests green (4 existing + 3 new).

- [x] **Step 5: Commit**

```bash
git add src/lib/timeline/machine-events.ts src/test/integration/supabase/machine-timeline-events.test.ts
git commit -m "feat(machines): getMachineTimeline read query with tag filter (PP-0x98)"
```

---

### Task 7: Auto-events on `createMachineAction`

**Files:**

- Modify: `src/app/(app)/m/actions.ts:91` (`createMachineAction`)
- Modify: `src/test/integration/supabase/machine-timeline-events.test.ts` (append)

- [x] **Step 1: Write failing integration test**

Append to `src/test/integration/supabase/machine-timeline-events.test.ts`:

```typescript
import { createMachineAction } from "~/app/(app)/m/actions";
import { withTestAuth } from "~/test/integration/supabase/helpers/auth";

describe("createMachineAction emits auto-events", () => {
  it("emits machine_added event", async () => {
    const { org, user } = await seedOrg(db());

    await withTestAuth(user, async () => {
      await createMachineAction({
        initials: "AAA",
        name: "Test Machine",
        modelId: null,
      });
    });

    const rows = await db()
      .select()
      .from(timelineEvents)
      .orderBy(timelineEvents.createdAt);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const lifecycle = rows.filter((r) => r.sourceType === "lifecycle");
    expect(lifecycle).toHaveLength(1);
    expect(lifecycle[0]?.eventData).toEqual({ kind: "machine_added" });
    expect(lifecycle[0]?.tag).toBe("lifecycle");
  });

  it("emits machine_added + owner_set when ownerId is provided", async () => {
    const { org, user } = await seedOrg(db());
    const owner = await seedUser(db(), { name: "Sam" });

    await withTestAuth(user, async () => {
      await createMachineAction({
        initials: "BBB",
        name: "Test 2",
        modelId: null,
        ownerId: owner.id,
      });
    });

    const lifecycle = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.sourceType, "lifecycle"));
    expect(lifecycle).toHaveLength(2);
    const kinds = lifecycle.map(
      (r) => (r.eventData as MachineTimelineEventData).kind
    );
    expect(kinds).toContain("machine_added");
    expect(kinds).toContain("owner_set");
  });
});
```

If `withTestAuth`, `seedOrg`, or `seedUser` don't exist, find their canonical equivalents in `src/test/integration/supabase/helpers/`. The existing pattern is documented in `.agent/skills/pinpoint-testing/SKILL.md` § "Server Actions with Auth" — follow whatever is currently established. Adjust the test seed scaffolding to match.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: FAIL — `createMachineAction` does not yet emit timeline events.

- [x] **Step 3: Modify `createMachineAction` to emit auto-events**

Open `src/app/(app)/m/actions.ts:91`. Find the transaction block in `createMachineAction`. Immediately after the machine is inserted (and inside the same transaction), add:

```typescript
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";

// ... inside the existing tx.transaction(async (tx) => { ... }) block,
// after `const [machine] = await tx.insert(machines).values({...}).returning();`:

await createMachineTimelineEvent(
  machine.id,
  {
    sourceType: "lifecycle",
    tag: "lifecycle",
    eventData: { kind: "machine_added" },
    actorId: currentUserId,
  },
  tx
);

if (machine.ownerId) {
  const ownerProfile = await tx.query.userProfiles.findFirst({
    where: eq(userProfiles.id, machine.ownerId),
    columns: { id: true, name: true },
  });
  if (ownerProfile?.name) {
    await createMachineTimelineEvent(
      machine.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: {
          kind: "owner_set",
          toOwnerId: ownerProfile.id,
          toOwnerName: ownerProfile.name,
        },
        actorId: currentUserId,
      },
      tx
    );
  }
}
```

Match the existing variable naming (the auth pattern likely already resolves `currentUserId` earlier in the action). If the action doesn't already use a `tx` variable, wrap the insert + emit in `db.transaction(async (tx) => {...})`.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: PASS — both new tests green.

- [x] **Step 5: Commit**

```bash
git add src/app/(app)/m/actions.ts src/test/integration/supabase/machine-timeline-events.test.ts
git commit -m "feat(machines): emit machine_added/owner_set timeline events on create (PP-0x98)"
```

---

### Task 8: Auto-events on `updateMachineAction` (name / owner / presence)

**Files:**

- Modify: `src/app/(app)/m/actions.ts:395` (`updateMachineAction`)
- Modify: integration test file (append)

- [x] **Step 1: Write failing tests**

Append to `src/test/integration/supabase/machine-timeline-events.test.ts`:

```typescript
import { updateMachineAction } from "~/app/(app)/m/actions";

describe("updateMachineAction emits per-field auto-events", () => {
  it("emits name_changed when name changes", async () => {
    const { machine, user } = await seedOrgWithMachine(db(), {
      name: "Original",
    });
    await withTestAuth(user, async () => {
      await updateMachineAction({ id: machine.id, name: "Updated" });
    });
    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const nameEvent = events.find(
      (e) => (e.eventData as MachineTimelineEventData)?.kind === "name_changed"
    );
    expect(nameEvent?.eventData).toEqual({
      kind: "name_changed",
      from: "Original",
      to: "Updated",
    });
  });

  it("emits owner_changed when owner changes (named -> named)", async () => {
    const alex = await seedUser(db(), { name: "Alex" });
    const sam = await seedUser(db(), { name: "Sam" });
    const { machine, user } = await seedOrgWithMachine(db(), {
      ownerId: alex.id,
    });
    await withTestAuth(user, async () => {
      await updateMachineAction({ id: machine.id, ownerId: sam.id });
    });
    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const ownerEvent = events.find(
      (e) => (e.eventData as MachineTimelineEventData)?.kind === "owner_changed"
    );
    expect(ownerEvent?.eventData).toMatchObject({
      kind: "owner_changed",
      fromOwnerId: alex.id,
      fromOwnerName: "Alex",
      toOwnerId: sam.id,
      toOwnerName: "Sam",
    });
  });

  it("emits presence_changed when presence changes", async () => {
    const { machine, user } = await seedOrgWithMachine(db(), {
      presenceStatus: "on_the_floor",
    });
    await withTestAuth(user, async () => {
      await updateMachineAction({
        id: machine.id,
        presenceStatus: "off_the_floor",
      });
    });
    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const presenceEvent = events.find(
      (e) =>
        (e.eventData as MachineTimelineEventData)?.kind === "presence_changed"
    );
    expect(presenceEvent?.eventData).toEqual({
      kind: "presence_changed",
      from: "on_the_floor",
      to: "off_the_floor",
    });
  });

  it("emits NO timeline event when no tracked field changed", async () => {
    const { machine, user } = await seedOrgWithMachine(db(), {
      name: "Same",
    });
    await withTestAuth(user, async () => {
      await updateMachineAction({ id: machine.id, name: "Same" });
    });
    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(0);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: FAIL — the action doesn't yet emit per-field events.

- [x] **Step 3: Modify `updateMachineAction`**

Open `src/app/(app)/m/actions.ts:395`. Inside the transaction, AFTER the update statement and BEFORE the transaction returns, fetch the previous row (before update), compare each tracked field, and emit an event per change. Pattern:

```typescript
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";

// At the start of the transaction, fetch the existing row:
const before = await tx.query.machines.findFirst({
  where: eq(machines.id, input.id),
  with: {
    owner: { columns: { id: true, name: true } },
  },
});
if (!before) throw new Error("Machine not found");

// ... perform the update (existing code) ...

// After update, fetch the new owner (if changed) for the event payload:
let afterOwnerName: string | null = before.owner?.name ?? null;
if (input.ownerId !== undefined && input.ownerId !== before.ownerId) {
  if (input.ownerId === null) {
    afterOwnerName = null;
  } else {
    const newOwner = await tx.query.userProfiles.findFirst({
      where: eq(userProfiles.id, input.ownerId),
      columns: { id: true, name: true },
    });
    afterOwnerName = newOwner?.name ?? null;
  }
}

// Emit per-field events:
if (input.name !== undefined && input.name !== before.name) {
  await createMachineTimelineEvent(
    input.id,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: { kind: "name_changed", from: before.name, to: input.name },
      actorId: currentUserId,
    },
    tx
  );
}

if (input.ownerId !== undefined && input.ownerId !== before.ownerId) {
  await createMachineTimelineEvent(
    input.id,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: {
        kind: "owner_changed",
        fromOwnerId: before.owner?.id ?? null,
        fromOwnerName: before.owner?.name ?? null,
        toOwnerId: input.ownerId,
        toOwnerName: afterOwnerName,
      },
      actorId: currentUserId,
    },
    tx
  );
}

if (
  input.presenceStatus !== undefined &&
  input.presenceStatus !== before.presenceStatus
) {
  await createMachineTimelineEvent(
    input.id,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: {
        kind: "presence_changed",
        from: before.presenceStatus,
        to: input.presenceStatus,
      },
      actorId: currentUserId,
    },
    tx
  );
}
```

Match the field-name conventions in `updateMachineAction`'s actual schema (e.g., `presenceStatus` vs `availability`). Inspect the existing implementation before editing.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: PASS — 4 new tests green.

- [x] **Step 5: Commit**

```bash
git add src/app/(app)/m/actions.ts src/test/integration/supabase/machine-timeline-events.test.ts
git commit -m "feat(machines): emit per-field lifecycle events on update (PP-0x98)"
```

---

### Task 9: Auto-events on the 4 prose-field actions

**Files:**

- Modify: `src/app/(app)/m/actions.ts:819` (`updateMachineDescription`)
- Modify: `src/app/(app)/m/actions.ts:831` (`updateMachineTournamentNotes`)
- Modify: `src/app/(app)/m/actions.ts:843` (`updateMachineOwnerRequirements`)
- Modify: `src/app/(app)/m/actions.ts:855` (`updateMachineOwnerNotes`)
- Modify: integration test file (append)

- [x] **Step 1: Write failing tests**

Append:

```typescript
import {
  updateMachineDescription,
  updateMachineTournamentNotes,
  updateMachineOwnerRequirements,
  updateMachineOwnerNotes,
} from "~/app/(app)/m/actions";

describe("prose-field actions emit marker events", () => {
  const cases = [
    {
      action: updateMachineDescription,
      kind: "description_updated" as const,
      field: "description" as const,
    },
    {
      action: updateMachineTournamentNotes,
      kind: "tournament_notes_updated" as const,
      field: "tournamentNotes" as const,
    },
    {
      action: updateMachineOwnerRequirements,
      kind: "owner_requirements_updated" as const,
      field: "ownerRequirements" as const,
    },
    {
      action: updateMachineOwnerNotes,
      kind: "owner_notes_updated" as const,
      field: "ownerNotes" as const,
    },
  ];

  for (const c of cases) {
    it(`${c.kind} emits a marker event`, async () => {
      const { machine, user } = await seedOrgWithMachine(db());
      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x" }] },
        ],
      };
      await withTestAuth(user, async () => {
        await c.action({ id: machine.id, [c.field]: doc });
      });
      const events = await db()
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machine.id));
      const marker = events.find(
        (e) => (e.eventData as MachineTimelineEventData)?.kind === c.kind
      );
      expect(marker).toBeDefined();
      expect(marker?.tag).toBe("lifecycle");
    });
  }
});
```

Implementation note: actual action signatures are `(machineId, value)` (the
plan example above is approximate). Tests were appended to
`src/test/integration/machine-timeline-actions.test.ts` (not a new
`machine-timeline-events` file) so the existing PGlite mocks and helpers
are reused. Added a fifth `no-op edit` test covering the equality guard.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: FAIL — 4 marker events not emitted.

- [x] **Step 3: Modify each prose-field action**

For each of the four actions, inside the transaction after the update statement, add the corresponding emit. Example for `updateMachineDescription`:

```typescript
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";

// inside the existing tx.transaction(async (tx) => { ... }):
// ... existing update logic ...

await createMachineTimelineEvent(
  input.id,
  {
    sourceType: "lifecycle",
    tag: "lifecycle",
    eventData: { kind: "description_updated" },
    actorId: currentUserId,
  },
  tx
);
```

Repeat for `updateMachineTournamentNotes` (kind: `"tournament_notes_updated"`), `updateMachineOwnerRequirements` (kind: `"owner_requirements_updated"`), and `updateMachineOwnerNotes` (kind: `"owner_notes_updated"`).

Important: only emit if the prose actually changed. Use JSON.stringify equality on the `before`/`after` documents, or rely on the existing action's "no-op detection" if one exists. If the action currently writes unconditionally, add a `JSON.stringify(before.field) !== JSON.stringify(input.value)` guard around the emit so empty-edits don't spam the timeline.

Implementation note: all four actions delegate to one internal helper
`updateMachineTextField`, so the change was made at a single edit point. A
`PROSE_FIELD_TO_EVENT_KIND` map (with `as const satisfies Record<..., MachineTimelineEventKind>`)
picks the right `kind` per field. The update is wrapped in `db.transaction`
and the emit runs inside the tx when the diff is non-zero. JSON equality uses
a canonical (sorted-keys) stringifier — PostgreSQL JSONB does not preserve
source key order so plain `JSON.stringify` produces false-positive diffs after
a round trip.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- machine-timeline-events`
Expected: PASS — 4 new tests green.

- [x] **Step 5: Commit**

```bash
git add src/app/(app)/m/actions.ts src/test/integration/supabase/machine-timeline-events.test.ts
git commit -m "feat(machines): emit marker events for prose-field edits (PP-0x98)"
```

---

### Task 10: Issue actions duplicate-write — issue create

**Files:**

- Modify: the issue create action (search for the create entry point in `src/app/(app)/issues/actions.ts` or wherever issues are created — see `src/services/issues.ts` for the actual mutation)
- Create: `src/test/integration/supabase/issue-actions-machine-timeline.test.ts`

- [x] **Step 1: Write failing test**

Create `src/test/integration/supabase/issue-actions-machine-timeline.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/test/integration/supabase/helpers/db";
import {
  seedOrgWithMachine,
  seedUser,
} from "~/test/integration/supabase/helpers/seed";
import { withTestAuth } from "~/test/integration/supabase/helpers/auth";
import { timelineEvents, issues, issueComments } from "~/server/db/schema";
import { createIssueAction } from "~/app/(app)/issues/actions";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";

describe("createIssueAction duplicate-writes to machine timeline", () => {
  const db = useDb();

  beforeEach(async () => {
    await db().delete(timelineEvents);
    await db().delete(issueComments);
    await db().delete(issues);
  });

  it("emits issue_opened to machine timeline AND preserves issueComments behavior", async () => {
    const { machine, user } = await seedOrgWithMachine(db());

    await withTestAuth(user, async () => {
      await createIssueAction({
        machineId: machine.id,
        title: "Flipper broken",
        reporterEmail: undefined,
      });
    });

    // Machine timeline got the issue_opened event:
    const mtEvents = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const issueOpened = mtEvents.find(
      (r) => (r.eventData as MachineTimelineEventData)?.kind === "issue_opened"
    );
    expect(issueOpened).toBeDefined();
    expect(issueOpened?.tag).toBe("issue");
    expect(issueOpened?.sourceType).toBe("issue");
    const data = issueOpened?.eventData as MachineTimelineEventData & {
      kind: "issue_opened";
    };
    expect(data.issueNumber).toBeGreaterThan(0);
    expect(data.title).toBe("Flipper broken");
    expect(data.openedByName).toBe(user.name);

    // issueComments still has its initial system row (existing behavior unchanged):
    const ic = await db().select().from(issueComments);
    expect(ic.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: FAIL — `timelineEvents` row is not emitted.

- [x] **Step 3: Add duplicate-write to `createIssueAction`**

Open the issue create action. Search for the line that creates the issue row (look for `tx.insert(issues)`). Find the surrounding transaction. After the `issues` row is inserted and after `createTimelineEvent` is called for `issueComments`, add the parallel emit to `timelineEvents`:

```typescript
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";

// inside the existing transaction, after issues row + issueComments are inserted:
await createMachineTimelineEvent(
  insertedIssue.machineId,
  {
    sourceType: "issue",
    tag: "issue",
    eventData: {
      kind: "issue_opened",
      issueId: insertedIssue.id,
      issueNumber: insertedIssue.number,
      openedByName: reporter.name,
      title: insertedIssue.title,
    },
    actorId: currentUserId,
  },
  tx
);
```

If the issue's reporter isn't readily available, use whatever name the existing `issueComments` system-event uses for "opened by" — match consistency.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: PASS — both assertions hold.

- [x] **Step 5: Commit**

```bash
git add src/app/(app)/issues/actions.ts src/services/issues.ts src/test/integration/supabase/issue-actions-machine-timeline.test.ts
git commit -m "feat(machines): duplicate-write issue_opened to machine timeline (PP-0x98)"
```

**Implementation note (PP-0x98 Task 10 actual landing, 2026-05-17):** The
duplicate-write was added directly to the `createIssue` service function in
`src/services/issues.ts` (not the action wrapper) since the transaction lives
in the service layer. Test landed at
`src/test/integration/machine-timeline-issue-actions.test.ts` (PGlite, not
the supabase/ subdir). `openedByName` resolution: prefer
`user_profiles.name` joined on `reportedBy`, fall back to `reporterName`,
finally "Anonymous" — never `reporterEmail` (AGENTS.md rule 10). The
existing lock+increment `.returning(...)` was extended with `id: machines.id`
so the helper has the machine UUID. 3 new tests added; 64-test regression
sweep (machine-timeline + machine-owner + supabase/issue-services + 2 unit
files using createIssue) all pass.

---

### Task 11: Issue actions duplicate-write — status changed (closed + intermediate)

**Files:**

- Modify: `src/app/(app)/issues/actions.ts:129` (`updateIssueStatusAction`) and/or `src/services/issues.ts:332` (where issue status changes happen and `createTimelineEvent` is called)
- Modify: `src/test/integration/supabase/issue-actions-machine-timeline.test.ts` (append)

- [x] **Step 1: Write failing tests (append)**

```typescript
import { updateIssueStatusAction } from "~/app/(app)/issues/actions";

describe("updateIssueStatusAction duplicate-writes to machine timeline", () => {
  it("emits issue_closed when status changes to a closed status", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    await withTestAuth(user, async () => {
      await createIssueAction({
        machineId: machine.id,
        title: "x",
      });
    });
    const [issue] = await db().select().from(issues);
    if (!issue) throw new Error("seed failed");

    await db().delete(timelineEvents); // ignore the open event

    await withTestAuth(user, async () => {
      await updateIssueStatusAction({ id: issue.id, status: "fixed" });
    });

    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const closedEvent = events.find(
      (e) => (e.eventData as MachineTimelineEventData)?.kind === "issue_closed"
    );
    expect(closedEvent).toBeDefined();
    expect(closedEvent?.tag).toBe("issue");
  });

  it("emits issue_status_changed when status changes to a non-closed status", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    await withTestAuth(user, async () => {
      await createIssueAction({ machineId: machine.id, title: "x" });
    });
    const [issue] = await db().select().from(issues);
    if (!issue) throw new Error("seed failed");
    await db().delete(timelineEvents);

    await withTestAuth(user, async () => {
      await updateIssueStatusAction({ id: issue.id, status: "in_progress" });
    });

    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const statusEvent = events.find(
      (e) =>
        (e.eventData as MachineTimelineEventData)?.kind ===
        "issue_status_changed"
    );
    expect(statusEvent).toBeDefined();
    expect(statusEvent?.eventData).toMatchObject({
      kind: "issue_status_changed",
      issueNumber: issue.number,
      from: "new",
      to: "in_progress",
    });
  });
});
```

The list of "closed" status enum values lives in the issue status config. Check `src/lib/issue/status.ts` (or the equivalent) for the canonical CLOSED_STATUSES const. Use whatever's already defined.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: FAIL — duplicate-write not in place.

- [x] **Step 3: Add duplicate-write to the status-change service**

Open `src/services/issues.ts:332` (where `createTimelineEvent` is called for `status_changed`). After that call, in the same transaction, add:

```typescript
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import { CLOSED_STATUSES } from "~/lib/issue/status";

const isClosing = CLOSED_STATUSES.includes(newStatus);
const eventData: MachineTimelineEventData = isClosing
  ? {
      kind: "issue_closed",
      issueId: issue.id,
      issueNumber: issue.number,
      closedByName: actor.name,
      title: issue.title,
    }
  : {
      kind: "issue_status_changed",
      issueId: issue.id,
      issueNumber: issue.number,
      from: oldStatus,
      to: newStatus,
    };

await createMachineTimelineEvent(
  issue.machineId,
  {
    sourceType: "issue",
    tag: "issue",
    eventData,
    actorId: actor.id,
  },
  tx
);
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: PASS — both new tests green.

- [x] **Step 5: Commit**

```bash
git add src/services/issues.ts src/test/integration/supabase/issue-actions-machine-timeline.test.ts
git commit -m "feat(machines): duplicate-write issue status changes to machine timeline (PP-0x98)"
```

**Implementation note:** real Server Action shape is `(prevState, formData)`, so
the duplicate-write was placed in the `updateIssueStatus` service
(`src/services/issues.ts:285`) rather than the action layer — same transaction
as the existing `createTimelineEvent` system row, atomic with the status update.
`CLOSED_STATUSES` lives at `~/lib/issues/status` (plural). Tests live in
`src/test/integration/machine-timeline-issue-actions.test.ts` (appended to
Task 10's file, three new specs: closed, intermediate, no-op). `closedByName`
resolves via `userProfiles.findFirst` with `name` column only — never email
(AGENTS.md rule 10). All 6 tests in the file green; 36-test regression sweep
(machine-timeline integration set) green; 44 unit tests touching
`updateIssueStatus` green.

---

### Task 12: Issue actions duplicate-write — assigned / unassigned

**Files:**

- Modify: the issue assignment service path (search for where `assigned` / `unassigned` events emit to `issueComments` — in `src/services/issues.ts` per existing patterns)
- Modify: integration test file (append)

- [ ] **Step 1: Write failing tests (append)**

```typescript
import { assignIssueAction } from "~/app/(app)/issues/actions";

describe("assignIssueAction duplicate-writes to machine timeline", () => {
  it("emits issue_assigned when issue is assigned", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    const assignee = await seedUser(db(), { name: "Tim" });
    await withTestAuth(user, async () => {
      await createIssueAction({ machineId: machine.id, title: "x" });
    });
    const [issue] = await db().select().from(issues);
    if (!issue) throw new Error("seed failed");
    await db().delete(timelineEvents);

    await withTestAuth(user, async () => {
      await assignIssueAction({ id: issue.id, assigneeId: assignee.id });
    });

    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const assigned = events.find(
      (e) =>
        (e.eventData as MachineTimelineEventData)?.kind === "issue_assigned"
    );
    expect(assigned?.eventData).toMatchObject({
      kind: "issue_assigned",
      issueId: issue.id,
      assigneeName: "Tim",
    });
  });

  it("emits issue_unassigned when assignee is cleared", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    const assignee = await seedUser(db(), { name: "Tim" });
    await withTestAuth(user, async () => {
      await createIssueAction({ machineId: machine.id, title: "x" });
    });
    const [issue] = await db().select().from(issues);
    if (!issue) throw new Error("seed failed");

    await withTestAuth(user, async () => {
      await assignIssueAction({ id: issue.id, assigneeId: assignee.id });
    });
    await db().delete(timelineEvents);
    await withTestAuth(user, async () => {
      await assignIssueAction({ id: issue.id, assigneeId: null });
    });

    const events = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const unassigned = events.find(
      (e) =>
        (e.eventData as MachineTimelineEventData)?.kind === "issue_unassigned"
    );
    expect(unassigned).toBeDefined();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: FAIL.

- [ ] **Step 3: Add duplicate-write to assignment service**

In the same `src/services/issues.ts` file (or wherever the `assigned`/`unassigned` events emit), after the existing `createTimelineEvent` calls, add the parallel emit pattern (assigned branch + unassigned branch):

```typescript
if (newAssigneeId === null) {
  await createMachineTimelineEvent(
    issue.machineId,
    {
      sourceType: "issue",
      tag: "issue",
      eventData: {
        kind: "issue_unassigned",
        issueId: issue.id,
        issueNumber: issue.number,
      },
      actorId: actor.id,
    },
    tx
  );
} else {
  await createMachineTimelineEvent(
    issue.machineId,
    {
      sourceType: "issue",
      tag: "issue",
      eventData: {
        kind: "issue_assigned",
        issueId: issue.id,
        issueNumber: issue.number,
        assigneeName: newAssignee.name,
      },
      actorId: actor.id,
    },
    tx
  );
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/issues.ts src/test/integration/supabase/issue-actions-machine-timeline.test.ts
git commit -m "feat(machines): duplicate-write issue assignment to machine timeline (PP-0x98)"
```

---

### Task 13: Issue actions duplicate-write — reassigned (dual rows)

**Files:**

- Modify: `src/app/(app)/issues/actions.ts:1006` (`reassignIssueMachineAction`) and/or its service
- Modify: integration test file (append)

- [ ] **Step 1: Write failing test**

```typescript
import { reassignIssueMachineAction } from "~/app/(app)/issues/actions";

describe("reassignIssueMachineAction duplicate-writes dual rows", () => {
  it("emits issue_reassigned_out on source AND issue_reassigned_in on destination", async () => {
    const { machine: source, user } = await seedOrgWithMachine(db(), {
      name: "Stranger Things",
    });
    const dest = await seedOrgWithMachine(db(), { name: "Iron Maiden" });
    await withTestAuth(user, async () => {
      await createIssueAction({ machineId: source.id, title: "x" });
    });
    const [issue] = await db().select().from(issues);
    if (!issue) throw new Error("seed failed");
    await db().delete(timelineEvents);

    await withTestAuth(user, async () => {
      await reassignIssueMachineAction({
        id: issue.id,
        toMachineId: dest.machine.id,
      });
    });

    const sourceEvents = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, source.id));
    const destEvents = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, dest.machine.id));

    const out = sourceEvents.find(
      (e) =>
        (e.eventData as MachineTimelineEventData)?.kind ===
        "issue_reassigned_out"
    );
    const into = destEvents.find(
      (e) =>
        (e.eventData as MachineTimelineEventData)?.kind ===
        "issue_reassigned_in"
    );

    expect(out?.eventData).toMatchObject({
      kind: "issue_reassigned_out",
      toMachineId: dest.machine.id,
      toMachineName: "Iron Maiden",
    });
    expect(into?.eventData).toMatchObject({
      kind: "issue_reassigned_in",
      fromMachineId: source.id,
      fromMachineName: "Stranger Things",
    });

    // Both events share the same createdAt (same transaction):
    expect(out?.createdAt.getTime()).toBe(into?.createdAt.getTime());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: FAIL.

- [ ] **Step 3: Add dual-write to reassign service**

In the reassign action's transaction, after the existing `createTimelineEvent` (the `machine_reassigned` event on `issueComments`), add two parallel emits to `timelineEvents`:

```typescript
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";

// inside the same transaction, after the existing emit:
await createMachineTimelineEvent(
  oldMachineId,
  {
    sourceType: "issue",
    tag: "issue",
    eventData: {
      kind: "issue_reassigned_out",
      issueId: issue.id,
      issueNumber: issue.number,
      toMachineId: newMachine.id,
      toMachineName: newMachine.name,
    },
    actorId: actor.id,
  },
  tx
);

await createMachineTimelineEvent(
  newMachine.id,
  {
    sourceType: "issue",
    tag: "issue",
    eventData: {
      kind: "issue_reassigned_in",
      issueId: issue.id,
      issueNumber: issue.number,
      fromMachineId: oldMachineId,
      fromMachineName: oldMachine.name,
    },
    actorId: actor.id,
  },
  tx
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:integration -- issue-actions-machine-timeline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/issues/actions.ts src/services/issues.ts src/test/integration/supabase/issue-actions-machine-timeline.test.ts
git commit -m "feat(machines): duplicate-write reassign dual rows to machine timelines (PP-0x98)"
```

---

### Task 14: Permission matrix — `machines.timeline.comment.delete`

**Files:**

- Modify: `src/lib/permissions/matrix.ts`
- Modify or Create: a unit/integration test for the matrix entry

- [ ] **Step 1: Inspect the existing matrix**

Open `src/lib/permissions/matrix.ts`. Find an existing ownership-context entry — for example `issues.update.reporting` uses `own` semantics. Note the pattern: roles map to scopes (`'all' | 'own' | 'none'`), and `checkPermission(key, accessLevel, ownershipCtx)` uses the ctx to decide.

- [ ] **Step 2: Add the new permission key**

Add to the matrix:

```typescript
"machines.timeline.comment.add": {
  guest: "none",
  member: "all",
  admin: "all",
  // (sole pre-existing scopes used in matrix; align with conventions)
},
"machines.timeline.comment.delete": {
  guest: "none",
  member: "own_or_machine_owner",  // see step 3 — may need a new scope
  admin: "all",
},
```

`own_or_machine_owner` is a new scope. Two paths:

- **Option A (simplest):** Add `"own_or_machine_owner"` as a recognized scope in the matrix-helper switch statement and pass `{ authorId, machineOwnerId, currentUserId }` as the ownership context. The helper checks `currentUserId === authorId || currentUserId === machineOwnerId`.
- **Option B (compose existing scopes):** Use `"own"` for the authorship check and add a separate check in the server action: `accessLevel === 'admin' || isAuthor || isMachineOwner`. The matrix only handles `own`; the action layers the owner check on top.

Pick the path most consistent with existing matrix patterns. Look at `issues.update.reporting` for the closest precedent. Document the chosen approach in the matrix file with an inline comment.

- [ ] **Step 3: Update `checkPermission` helper if a new scope was added**

If you took Option A above, open `src/lib/permissions/helpers.ts` (or wherever `checkPermission` is implemented) and extend the scope handling for `own_or_machine_owner`. Add a unit test alongside.

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions/matrix.ts src/lib/permissions/helpers.ts src/lib/permissions/*.test.ts
git commit -m "feat(permissions): add machine timeline comment delete permission (PP-0x98)"
```

---

### Task 15: Server actions — `addMachineCommentAction` + `deleteMachineCommentAction`

**Files:**

- Create: `src/app/(app)/m/[initials]/timeline/actions.ts`
- Create: `src/test/integration/supabase/machine-timeline-permissions.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `src/test/integration/supabase/machine-timeline-permissions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/test/integration/supabase/helpers/db";
import {
  seedOrgWithMachine,
  seedUser,
} from "~/test/integration/supabase/helpers/seed";
import { withTestAuth } from "~/test/integration/supabase/helpers/auth";
import { timelineEvents } from "~/server/db/schema";
import {
  addMachineCommentAction,
  deleteMachineCommentAction,
} from "~/app/(app)/m/[initials]/timeline/actions";

describe("addMachineCommentAction", () => {
  const db = useDb();
  beforeEach(async () => {
    await db().delete(timelineEvents);
  });

  it("inserts a comment with tag and author from current session", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    const result = await withTestAuth(user, async () => {
      return await addMachineCommentAction({
        machineId: machine.id,
        tag: "maintenance",
        contentJson: JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Cleaned" }] },
          ],
        }),
      });
    });
    expect(result.success).toBe(true);
    const [row] = await db().select().from(timelineEvents);
    expect(row?.authorId).toBe(user.id);
    expect(row?.tag).toBe("maintenance");
  });

  it("rejects a reserved tag", async () => {
    const { machine, user } = await seedOrgWithMachine(db());
    const result = await withTestAuth(user, async () => {
      return await addMachineCommentAction({
        machineId: machine.id,
        tag: "lifecycle",
        contentJson: JSON.stringify({ type: "doc", content: [] }),
      });
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/reserved/i);
  });

  it("rejects an unauthenticated user", async () => {
    const { machine } = await seedOrgWithMachine(db());
    const result = await addMachineCommentAction({
      machineId: machine.id,
      tag: "maintenance",
      contentJson: JSON.stringify({ type: "doc", content: [] }),
    });
    expect(result.success).toBe(false);
  });
});

describe("deleteMachineCommentAction permission scenarios", () => {
  const db = useDb();
  beforeEach(async () => {
    await db().delete(timelineEvents);
  });

  async function setupCommentByMember() {
    const machineOwner = await seedUser(db(), { name: "Owner" });
    const { machine } = await seedOrgWithMachine(db(), {
      ownerId: machineOwner.id,
    });
    const member = await seedUser(db(), { name: "Member" });
    const otherMember = await seedUser(db(), { name: "Other" });
    const admin = await seedUser(db(), { name: "Admin", role: "admin" });

    await withTestAuth(member, async () => {
      await addMachineCommentAction({
        machineId: machine.id,
        tag: "maintenance",
        contentJson: JSON.stringify({ type: "doc", content: [] }),
      });
    });
    const [comment] = await db().select().from(timelineEvents);
    if (!comment) throw new Error("seed failed");
    return { machine, machineOwner, member, otherMember, admin, comment };
  }

  it("author can delete own comment", async () => {
    const { member, comment } = await setupCommentByMember();
    const result = await withTestAuth(member, async () => {
      return await deleteMachineCommentAction({ id: comment.id });
    });
    expect(result.success).toBe(true);
    const [row] = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.id, comment.id));
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it("machine owner can delete another member's comment", async () => {
    const { machineOwner, comment } = await setupCommentByMember();
    const result = await withTestAuth(machineOwner, async () => {
      return await deleteMachineCommentAction({ id: comment.id });
    });
    expect(result.success).toBe(true);
  });

  it("site admin can delete any comment", async () => {
    const { admin, comment } = await setupCommentByMember();
    const result = await withTestAuth(admin, async () => {
      return await deleteMachineCommentAction({ id: comment.id });
    });
    expect(result.success).toBe(true);
  });

  it("non-owner non-author non-admin member CANNOT delete", async () => {
    const { otherMember, comment } = await setupCommentByMember();
    const result = await withTestAuth(otherMember, async () => {
      return await deleteMachineCommentAction({ id: comment.id });
    });
    expect(result.success).toBe(false);
    const [row] = await db()
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.id, comment.id));
    expect(row?.deletedAt).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test:integration -- machine-timeline-permissions`
Expected: FAIL — actions module not found.

- [ ] **Step 3: Implement the actions**

Create `src/app/(app)/m/[initials]/timeline/actions.ts`:

```typescript
"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { createClient } from "~/lib/supabase/server";
import { timelineEvents, machines, userProfiles } from "~/server/db/schema";
import { tagSchema, userTagSchema } from "~/lib/timeline/machine-tags";
import {
  createMachineComment,
  softDeleteMachineComment,
} from "~/lib/timeline/machine-events";
import { checkPermission } from "~/lib/permissions/helpers";
import { getAccessLevelForUser } from "~/lib/permissions/access";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const addSchema = z.object({
  machineId: z.string().uuid(),
  tag: userTagSchema,
  contentJson: z.string().min(1),
});

type ActionResult = { success: true } | { success: false; error: string };

export async function addMachineCommentAction(
  input: z.input<typeof addSchema>
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  let content: ProseMirrorDoc;
  try {
    content = JSON.parse(parsed.data.contentJson) as ProseMirrorDoc;
  } catch {
    return { success: false, error: "Invalid content JSON" };
  }

  await db.transaction(async (tx) => {
    const profile = await tx.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { id: true },
    });
    if (!profile) throw new Error("Profile not found");
    await createMachineComment(
      parsed.data.machineId,
      {
        content,
        tag: parsed.data.tag,
        authorId: profile.id,
      },
      tx
    );
  });

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, parsed.data.machineId),
    columns: { initials: true },
  });
  if (machine) {
    revalidatePath(`/m/${machine.initials}/timeline`);
  }

  return { success: true };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteMachineCommentAction(
  input: z.input<typeof deleteSchema>
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const row = await db.query.timelineEvents.findFirst({
    where: eq(timelineEvents.id, parsed.data.id),
    columns: { id: true, authorId: true, machineId: true, sourceType: true },
  });
  if (!row || row.sourceType !== "comment") {
    return { success: false, error: "Not found" };
  }
  if (!row.machineId) return { success: false, error: "Not deletable" };

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, row.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Not found" };

  const accessLevel = await getAccessLevelForUser(user.id);
  const isAuthor = row.authorId === user.id;
  const isMachineOwner = machine.ownerId === user.id;
  const allowed = accessLevel === "admin" || isAuthor || isMachineOwner;

  if (!allowed) {
    return { success: false, error: "Forbidden" };
  }

  await db.transaction(async (tx) => {
    await softDeleteMachineComment(parsed.data.id, { deletedBy: user.id }, tx);
  });

  revalidatePath(`/m/${machine.initials}/timeline`);
  return { success: true };
}
```

If `getAccessLevelForUser` doesn't exist with that exact name, find the canonical helper that turns a user-id into an access level enum value used by the matrix (look in `src/lib/permissions/`). Use whatever is established.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test:integration -- machine-timeline-permissions`
Expected: PASS — 7 tests green (3 add + 4 delete).

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/m/[initials]/timeline/actions.ts src/test/integration/supabase/machine-timeline-permissions.test.ts
git commit -m "feat(machines): add+delete machine timeline comment server actions (PP-0x98)"
```

---

### Task 16: Row renderer components (CommentRow, SystemRow, TombstoneRow) + RTL tests

**Files:**

- Create: `src/components/machines/timeline/MachineTimelineCommentRow.tsx`
- Create: `src/components/machines/timeline/MachineTimelineSystemRow.tsx`
- Create: `src/components/machines/timeline/MachineTimelineTombstoneRow.tsx`
- Create: corresponding `*.test.tsx` for each

- [ ] **Step 1: Write failing tests**

Create `src/components/machines/timeline/MachineTimelineCommentRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MachineTimelineCommentRow } from "./MachineTimelineCommentRow";

const baseRow = {
  id: "1",
  createdAt: new Date("2026-05-17T12:00:00Z"),
  authorId: "u1",
  authorName: "Tim",
  tag: "maintenance" as const,
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Rebuilt flippers" }],
      },
    ],
  },
};

describe("MachineTimelineCommentRow", () => {
  it("renders author name, time, tag, and body", () => {
    render(<MachineTimelineCommentRow row={baseRow} canDelete={false} />);
    expect(screen.getByText("Tim")).toBeInTheDocument();
    expect(screen.getByText("maintenance")).toBeInTheDocument();
    expect(screen.getByText("Rebuilt flippers")).toBeInTheDocument();
  });

  it("shows delete affordance when canDelete is true", () => {
    render(<MachineTimelineCommentRow row={baseRow} canDelete={true} />);
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("hides delete affordance when canDelete is false", () => {
    render(<MachineTimelineCommentRow row={baseRow} canDelete={false} />);
    expect(
      screen.queryByRole("button", { name: /delete/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT display the author's email anywhere", () => {
    render(
      <MachineTimelineCommentRow
        row={{ ...baseRow, authorName: "Tim" }}
        canDelete={false}
      />
    );
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
```

Create `src/components/machines/timeline/MachineTimelineSystemRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MachineTimelineSystemRow } from "./MachineTimelineSystemRow";

describe("MachineTimelineSystemRow", () => {
  it("renders formatted event text + tag chip + relative time", () => {
    render(
      <MachineTimelineSystemRow
        row={{
          id: "s1",
          createdAt: new Date("2026-05-17T12:00:00Z"),
          tag: "lifecycle",
          eventData: { kind: "machine_added" },
        }}
      />
    );
    expect(screen.getByText("Machine added")).toBeInTheDocument();
    expect(screen.getByText("lifecycle")).toBeInTheDocument();
  });

  it("renders issue link for issue_opened", () => {
    render(
      <MachineTimelineSystemRow
        row={{
          id: "s1",
          createdAt: new Date(),
          tag: "issue",
          eventData: {
            kind: "issue_opened",
            issueId: "i1",
            issueNumber: 42,
            openedByName: "Maria",
            title: "Flipper",
          },
        }}
        machineInitials="AAA"
      />
    );
    const link = screen.getByRole("link", { name: /#42/i });
    expect(link).toHaveAttribute("href", "/m/AAA/i/42");
  });
});
```

Create `src/components/machines/timeline/MachineTimelineTombstoneRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MachineTimelineTombstoneRow } from "./MachineTimelineTombstoneRow";

describe("MachineTimelineTombstoneRow", () => {
  it("renders deleter name and relative time, no content", () => {
    render(
      <MachineTimelineTombstoneRow
        deletedByName="Sam"
        deletedAt={new Date("2026-05-14T12:00:00Z")}
      />
    );
    expect(screen.getByText(/deleted by Sam/i)).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/machines/timeline/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the row components**

Create `src/components/machines/timeline/MachineTimelineCommentRow.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { RichTextRenderer } from "~/components/editor/RichTextRenderer";
import { formatRelativeTime } from "~/lib/format/time";
import { deleteMachineCommentAction } from "~/app/(app)/m/[initials]/timeline/actions";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

export interface MachineCommentRowData {
  id: string;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
  tag: TimelineTag;
  content: ProseMirrorDoc;
}

export function MachineTimelineCommentRow({
  row,
  canDelete,
}: {
  row: MachineCommentRowData;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-3 border-b py-3">
      <Avatar className="size-6 shrink-0">
        <AvatarFallback>
          {(row.authorName ?? "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-semibold">{row.authorName ?? "Unknown"}</span>{" "}
            <span className="text-muted-foreground">
              · {formatRelativeTime(row.createdAt)}
            </span>
          </div>
          <Badge variant="secondary">{row.tag}</Badge>
        </div>
        <div className="pt-1 text-sm">
          <RichTextRenderer content={row.content} />
        </div>
        {canDelete ? (
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await deleteMachineCommentAction({ id: row.id });
                });
              }}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

If `RichTextRenderer` doesn't exist, look in `src/components/editor/` — there's a render-only sibling of `RichTextEditor` for displaying ProseMirror content. Use that. If only the editor exists, render `<RichTextEditor content={row.content} editable={false} />`.

If `formatRelativeTime` doesn't exist in `~/lib/format/time`, use whatever PinPoint uses for the issue timeline (search for "ago" in `src/components/issues/IssueTimeline.tsx` to find the helper).

Create `src/components/machines/timeline/MachineTimelineSystemRow.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { formatRelativeTime } from "~/lib/format/time";
import { formatMachineEvent } from "~/lib/timeline/format-machine-event";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";

export interface MachineSystemRowData {
  id: string;
  createdAt: Date;
  tag: TimelineTag;
  eventData: MachineTimelineEventData;
}

export function MachineTimelineSystemRow({
  row,
  machineInitials,
}: {
  row: MachineSystemRowData;
  machineInitials?: string;
}) {
  const text = formatMachineEvent(row.eventData);
  const issueLink = extractIssueLink(row.eventData, machineInitials);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b py-1.5 text-xs italic text-muted-foreground">
      <span aria-hidden className="not-italic">
        ⚙
      </span>
      <span>
        {issueLink ? (
          <>
            {text.replace(/Issue #\d+/, "")}{" "}
            <Link href={issueLink.href} className="underline">
              #{issueLink.number}
            </Link>
          </>
        ) : (
          text
        )}
      </span>
      <span className="ml-auto" />
      <Badge variant="secondary">{row.tag}</Badge>
      <span>· {formatRelativeTime(row.createdAt)}</span>
    </div>
  );
}

function extractIssueLink(
  data: MachineTimelineEventData,
  machineInitials?: string
): { href: string; number: number } | null {
  if (!machineInitials) return null;
  if ("issueNumber" in data) {
    return {
      href: `/m/${machineInitials}/i/${data.issueNumber}`,
      number: data.issueNumber,
    };
  }
  return null;
}
```

Create `src/components/machines/timeline/MachineTimelineTombstoneRow.tsx`:

```tsx
import { formatRelativeTime } from "~/lib/format/time";

export function MachineTimelineTombstoneRow({
  deletedByName,
  deletedAt,
}: {
  deletedByName: string | null;
  deletedAt: Date;
}) {
  return (
    <div className="border-b py-1.5 text-xs italic text-muted-foreground">
      Comment deleted by {deletedByName ?? "an admin"} ·{" "}
      {formatRelativeTime(deletedAt)}
    </div>
  );
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/machines/timeline/`
Expected: PASS — all row-renderer tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/machines/timeline/
git commit -m "feat(machines): timeline row renderers (comment, system, tombstone) (PP-0x98)"
```

---

### Task 17: Compact composer with focus-expand + tag select

**Files:**

- Create: `src/components/machines/timeline/MachineTimelineComposer.tsx`
- Create: `src/components/machines/timeline/MachineTimelineComposer.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/machines/timeline/MachineTimelineComposer.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineTimelineComposer } from "./MachineTimelineComposer";

vi.mock("~/app/(app)/m/[initials]/timeline/actions", () => ({
  addMachineCommentAction: vi.fn(async () => ({ success: true })),
}));

describe("MachineTimelineComposer", () => {
  it("renders compact (one-line) by default", () => {
    render(<MachineTimelineComposer machineId="m1" />);
    expect(screen.getByText(/what did you do/i)).toBeInTheDocument();
    // Tag selector and full editor toolbar should NOT be visible:
    expect(
      screen.queryByRole("combobox", { name: /tag/i })
    ).not.toBeInTheDocument();
  });

  it("expands to full editor on focus/click", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineComposer machineId="m1" />);
    await user.click(screen.getByText(/what did you do/i));
    expect(screen.getByRole("combobox", { name: /tag/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
  });

  it("only offers non-reserved tags in the selector", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineComposer machineId="m1" />);
    await user.click(screen.getByText(/what did you do/i));
    await user.click(screen.getByRole("combobox", { name: /tag/i }));
    expect(
      screen.getByRole("option", { name: /maintenance/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /event/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /cleaning/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /lifecycle/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^issue$/i })
    ).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/machines/timeline/MachineTimelineComposer.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the composer**

Create `src/components/machines/timeline/MachineTimelineComposer.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RichTextEditor } from "~/components/editor/RichTextEditor";
import { addMachineCommentAction } from "~/app/(app)/m/[initials]/timeline/actions";
import {
  TIMELINE_TAGS,
  RESERVED_TAGS,
  getTagLabel,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const USER_TAGS = TIMELINE_TAGS.filter(
  (t): t is Exclude<TimelineTag, (typeof RESERVED_TAGS)[number]> =>
    !(RESERVED_TAGS as readonly string[]).includes(t)
);

export function MachineTimelineComposer({ machineId }: { machineId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [tag, setTag] = useState<TimelineTag>("maintenance");
  const [doc, setDoc] = useState<ProseMirrorDoc>({
    type: "doc",
    content: [],
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        onFocus={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm text-muted-foreground hover:border-foreground/20"
      >
        What did you do?
      </button>
    );
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <RichTextEditor content={doc} onChange={setDoc} />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Select value={tag} onValueChange={(v) => setTag(v as TimelineTag)}>
          <SelectTrigger aria-label="Tag" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_TAGS.map((t) => (
              <SelectItem key={t} value={t}>
                {getTagLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setExpanded(false);
              setDoc({ type: "doc", content: [] });
              setError(null);
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await addMachineCommentAction({
                  machineId,
                  tag,
                  contentJson: JSON.stringify(doc),
                });
                if (result.success) {
                  setDoc({ type: "doc", content: [] });
                  setExpanded(false);
                } else {
                  setError(result.error);
                }
              });
            }}
          >
            Post
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
```

Check that `RichTextEditor` accepts `content` + `onChange` props. If the existing component uses different prop names (e.g. `value`/`onValueChange`), adjust accordingly — look at how the issue comment composer uses it for the canonical pattern.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/machines/timeline/MachineTimelineComposer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/machines/timeline/MachineTimelineComposer.tsx src/components/machines/timeline/MachineTimelineComposer.test.tsx
git commit -m "feat(machines): compact-on-focus timeline composer (PP-0x98)"
```

---

### Task 18: Tag filter dropdown with URL param

**Files:**

- Create: `src/components/machines/timeline/MachineTimelineFilter.tsx`
- Create: `src/components/machines/timeline/MachineTimelineFilter.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/machines/timeline/MachineTimelineFilter.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineTimelineFilter } from "./MachineTimelineFilter";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/m/AAA/timeline",
}));

describe("MachineTimelineFilter", () => {
  it("renders 'All' as default selection", () => {
    render(<MachineTimelineFilter currentTag={undefined} />);
    expect(
      screen.getByRole("combobox", { name: /filter/i })
    ).toBeInTheDocument();
  });

  it("includes all five built-in tags as options", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTag={undefined} />);
    await user.click(screen.getByRole("combobox", { name: /filter/i }));
    expect(screen.getByRole("option", { name: /^all$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /lifecycle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^issue$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /maintenance/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /event/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /cleaning/i })
    ).toBeInTheDocument();
  });

  it("pushes ?tag= param on selection", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTag={undefined} />);
    await user.click(screen.getByRole("combobox", { name: /filter/i }));
    await user.click(screen.getByRole("option", { name: /maintenance/i }));
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("tag=maintenance")
    );
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/machines/timeline/MachineTimelineFilter.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the filter**

Create `src/components/machines/timeline/MachineTimelineFilter.tsx`:

```tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  TIMELINE_TAGS,
  getTagLabel,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";

const ALL = "__all__" as const;

export function MachineTimelineFilter({
  currentTag,
}: {
  currentTag: TimelineTag | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = currentTag ?? ALL;

  const handleChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL) params.delete("tag");
    else params.set("tag", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger aria-label="Filter by tag" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {TIMELINE_TAGS.map((t) => (
          <SelectItem key={t} value={t}>
            {getTagLabel(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/machines/timeline/MachineTimelineFilter.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/machines/timeline/MachineTimelineFilter.tsx src/components/machines/timeline/MachineTimelineFilter.test.tsx
git commit -m "feat(machines): timeline tag filter dropdown with URL param (PP-0x98)"
```

---

### Task 19: Timeline page server component + add to TABS

**Files:**

- Create: `src/app/(app)/m/[initials]/timeline/page.tsx`
- Modify: `src/components/machines/MachineTabStrip.tsx`

- [ ] **Step 1: Add 'Timeline' to the tab strip**

Open `src/components/machines/MachineTabStrip.tsx`. Update the `TABS` const:

```typescript
const TABS: readonly TabSpec[] = [
  { slug: "", label: "Info" },
  { slug: "maintenance", label: "Service" },
  { slug: "timeline", label: "Timeline" },
] as const;
```

If the tab strip computes badges per-tab (per the recent PR #1365), no badge logic is needed for Timeline in V1.

- [ ] **Step 2: Create the page**

Create `src/app/(app)/m/[initials]/timeline/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { getMachineTimeline } from "~/lib/timeline/machine-events";
import { tagSchema, type TimelineTag } from "~/lib/timeline/machine-tags";
import { MachineTimelineComposer } from "~/components/machines/timeline/MachineTimelineComposer";
import { MachineTimelineFilter } from "~/components/machines/timeline/MachineTimelineFilter";
import { MachineTimelineCommentRow } from "~/components/machines/timeline/MachineTimelineCommentRow";
import { MachineTimelineSystemRow } from "~/components/machines/timeline/MachineTimelineSystemRow";
import { MachineTimelineTombstoneRow } from "~/components/machines/timeline/MachineTimelineTombstoneRow";

interface PageProps {
  params: { initials: string };
  searchParams: { tag?: string };
}

export default async function MachineTimelinePage({
  params,
  searchParams,
}: PageProps) {
  const machine = await db.query.machines.findFirst({
    where: eq(machines.initials, params.initials),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) notFound();

  const parsedTag = searchParams.tag
    ? tagSchema.safeParse(searchParams.tag)
    : null;
  const tag: TimelineTag | undefined = parsedTag?.success
    ? parsedTag.data
    : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const isAuthenticated = currentUserId !== null;

  const rows = await getMachineTimeline(db, { machineId: machine.id, tag });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <MachineTimelineFilter currentTag={tag} />
      </div>
      {isAuthenticated ? (
        <MachineTimelineComposer machineId={machine.id} />
      ) : null}
      <div>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No activity yet — this machine's history will appear here as it's
            added, updated, and serviced.
          </p>
        ) : (
          rows.map((row) => {
            if (row.deletedAt) {
              return (
                <MachineTimelineTombstoneRow
                  key={row.id}
                  deletedByName={row.deletedByName}
                  deletedAt={row.deletedAt}
                />
              );
            }
            if (row.sourceType === "comment" && row.content) {
              const canDelete =
                isAuthenticated &&
                (currentUserId === row.authorId ||
                  currentUserId === machine.ownerId);
              return (
                <MachineTimelineCommentRow
                  key={row.id}
                  row={{
                    id: row.id,
                    createdAt: row.createdAt,
                    authorId: row.authorId,
                    authorName: row.authorName,
                    tag: row.tag as TimelineTag,
                    content: row.content,
                  }}
                  canDelete={canDelete}
                />
              );
            }
            if (row.eventData) {
              return (
                <MachineTimelineSystemRow
                  key={row.id}
                  row={{
                    id: row.id,
                    createdAt: row.createdAt,
                    tag: row.tag as TimelineTag,
                    eventData: row.eventData,
                  }}
                  machineInitials={machine.initials}
                />
              );
            }
            return null;
          })
        )}
      </div>
    </div>
  );
}
```

Note: the delete-permission check in the page only handles `author` and `machineOwner`. Admins also get `canDelete=true`, but checking admin status here requires loading the access level. Add admin support: import `getAccessLevelForUser` (from Task 14 work) and OR-in `accessLevel === 'admin'`. If the helper doesn't load conveniently in a server component, defer the admin button rendering to the action's response (admin clicks something else, server enforces).

- [ ] **Step 3: Type-check and run**

Run: `pnpm run typecheck`
Expected: PASS.

Run: `pnpm run check`
Expected: PASS.

- [ ] **Step 4: Spot-check in the dev server**

Run: `pnpm dev` (or `pnpm run dev:status` to verify it's already running)
Open: `http://localhost:3000/m/<initials>/timeline` (use an existing machine's initials from your seeded data)
Expected: tab strip shows three tabs, the page renders with a filter dropdown, an empty composer for authenticated users, and either an empty state or seeded events.

- [ ] **Step 5: Commit**

```bash
git add src/components/machines/MachineTabStrip.tsx src/app/(app)/m/[initials]/timeline/page.tsx
git commit -m "feat(machines): Timeline tab page + tab strip entry (PP-0x98)"
```

---

### Task 20: E2E smoke — add the new route to responsive-overflow

**Files:**

- Modify: `e2e/smoke/responsive-overflow.spec.ts`

- [ ] **Step 1: Inspect the existing route list**

Open `e2e/smoke/responsive-overflow.spec.ts`. The spec covers a list of routes. Identify how the existing machine route is referenced — likely something like `/m/${initials}/`. Note that the suite uses `assertNoHorizontalOverflow()` from `e2e/support/actions.ts`.

- [ ] **Step 2: Add the new route**

In the routes array, add an entry for the timeline tab. The exact pattern depends on the existing structure, but the addition is roughly:

```typescript
{ path: `/m/${SEEDED_MACHINE_INITIALS}/timeline`, name: "Machine Timeline" },
```

Use whatever variable holds the seeded machine initials in the spec. If the existing entries use a different shape, match it exactly.

- [ ] **Step 3: Run the smoke spec**

Run: `pnpm exec playwright test e2e/smoke/responsive-overflow.spec.ts --project=chromium`
Expected: PASS — new route renders without horizontal overflow at 1024×768.

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/responsive-overflow.spec.ts
git commit -m "test(e2e): add machine timeline route to responsive smoke (PP-0x98)"
```

---

### Task 21: E2E full — comment add + delete permission split + tag filter

**Files:**

- Create: `e2e/full/machine-timeline.spec.ts`

- [ ] **Step 1: Write the spec**

Create `e2e/full/machine-timeline.spec.ts`:

```typescript
import { test, expect } from "../support/test-base";

test.describe("Machine Timeline", () => {
  test("member can post a comment and see it appear", async ({
    page,
    asUser,
  }) => {
    await asUser("member");
    await page.goto(`/m/${process.env.E2E_SEEDED_MACHINE_INITIALS}/timeline`);
    await page.getByText(/what did you do/i).click();
    await page.getByRole("combobox", { name: /tag/i }).click();
    await page.getByRole("option", { name: /maintenance/i }).click();
    // The RichTextEditor area should have a focusable contenteditable region:
    await page.locator("[contenteditable]").first().fill("Rebuilt flippers");
    await page.getByRole("button", { name: /post/i }).click();
    await expect(page.getByText("Rebuilt flippers")).toBeVisible();
    await expect(page.getByText(/maintenance/i)).toBeVisible();
  });

  test("author can delete own comment via tombstone", async ({
    page,
    asUser,
  }) => {
    await asUser("member-author");
    await page.goto(`/m/${process.env.E2E_SEEDED_MACHINE_INITIALS}/timeline`);
    // Assumes seed has a comment by member-author. Click its Delete button.
    await page
      .getByRole("button", { name: /delete/i })
      .first()
      .click();
    await expect(page.getByText(/comment deleted/i)).toBeVisible();
  });

  test("non-owner non-author member sees no Delete button on others' comments", async ({
    page,
    asUser,
  }) => {
    await asUser("member-other");
    await page.goto(`/m/${process.env.E2E_SEEDED_MACHINE_INITIALS}/timeline`);
    // There's a seeded comment from member-author. No delete button visible:
    await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
  });

  test("tag filter URL param round-trips", async ({ page, asUser }) => {
    await asUser("member");
    await page.goto(
      `/m/${process.env.E2E_SEEDED_MACHINE_INITIALS}/timeline?tag=maintenance`
    );
    await expect(page.getByRole("combobox", { name: /filter/i })).toContainText(
      /maintenance/i
    );
    // Filter narrows results — assert at least one maintenance row is present
    // and no rows tagged 'lifecycle' show:
    const lifecycleChips = page.getByText(/^lifecycle$/);
    await expect(lifecycleChips).toHaveCount(0);
  });

  test("reassigning an issue shows the event on BOTH machines", async ({
    page,
    asUser,
  }) => {
    await asUser("admin");
    // Open an existing issue on machine A and reassign to machine B.
    // Then verify both timelines show the corresponding event.
    const machineA = process.env.E2E_SEEDED_MACHINE_INITIALS!;
    const machineB = process.env.E2E_SECOND_MACHINE_INITIALS!;
    const issueNumber = process.env.E2E_SEEDED_ISSUE_NUMBER!;
    await page.goto(`/m/${machineA}/i/${issueNumber}`);
    // Open the issue-actions menu, click Reassign, pick destination, confirm.
    // Selectors come from src/app/(app)/m/[initials]/i/[issueNumber]/
    //   issue-actions-menu.tsx and reassign-machine-form.tsx.
    await page.getByTestId("issue-actions-menu-trigger").click();
    await page.getByTestId("issue-actions-menu-reassign").click();
    await page.getByTestId(`reassign-option-${machineB}`).click();
    await page.getByTestId("reassign-confirm").click();
    await page.goto(`/m/${machineA}/timeline`);
    await expect(page.getByText(`moved to`)).toBeVisible();
    await page.goto(`/m/${machineB}/timeline`);
    await expect(page.getByText(`received from`)).toBeVisible();
  });
});
```

The above spec uses placeholder env vars (`E2E_SEEDED_MACHINE_INITIALS`, `E2E_SECOND_MACHINE_INITIALS`, `E2E_SEEDED_ISSUE_NUMBER`) and an `asUser` fixture. Wire them to whatever the existing E2E fixtures and seed expose. See `e2e/support/` and the seed file referenced in `pinpoint-e2e` skill.

If `member-author` and `member-other` roles aren't already in the seed, update `src/server/db/seed/` (or the equivalent E2E seed) to add them, OR adjust the spec to create the necessary state in `beforeAll` per the e2e/full pattern.

- [ ] **Step 2: Run the spec**

Run: `pnpm exec playwright test e2e/full/machine-timeline.spec.ts --project=chromium`
Expected: PASS — all 5 scenarios.

If a scenario depends on per-test fresh DB state, prefer running the whole file (`pnpm exec playwright test e2e/full/machine-timeline.spec.ts --project=chromium`) rather than individual tests, per the AGENTS.md guidance on shared `beforeAll` state.

- [ ] **Step 3: Commit**

```bash
git add e2e/full/machine-timeline.spec.ts
git commit -m "test(e2e): machine timeline add/delete/filter/reassign (PP-0x98)"
```

---

### Task 22: Preflight + final pass + push for PR

**Files:**

- N/A — verification + push

- [ ] **Step 1: Run preflight**

Run: `pnpm run preflight`
Expected: PASS — types, lint, format, unit tests, integration tests, build all green. If anything fails, fix and re-run before continuing.

- [ ] **Step 2: Re-run smoke**

Run: `pnpm run smoke`
Expected: PASS — chromium + mobile chrome smoke green for all routes including new `/m/[initials]/timeline`.

- [ ] **Step 3: Update spec to reflect "Status: Implemented"**

Open `docs/superpowers/specs/2026-05-17-machine-timeline-design.md` and change `**Status**: Design` to `**Status**: Implemented (PP-0x98)`.

- [ ] **Step 4: Commit the status change**

```bash
git add docs/superpowers/specs/2026-05-17-machine-timeline-design.md
git commit -m "docs(machines): mark machine timeline spec as Implemented (PP-0x98)"
```

- [ ] **Step 5: Push and open PR**

Run:

```bash
git push -u origin HEAD
gh pr create --title "feat(machines): machine timeline V1 (PP-0x98)" --body "$(cat <<'EOF'
## Summary

- New Timeline tab on every machine detail page
- Captures lifecycle events (added, owner/name/availability/prose-field changes) and issue events (open, close, status, assign, reassign) as structured discriminated-union rows in a new `timeline_events` table
- User comments via the existing Tiptap `RichTextEditor`, with a single tag from a 5-value built-in list (`lifecycle`, `issue` reserved; `maintenance`, `event`, `cleaning` open)
- Compact-on-focus composer at the top, dropdown tag filter with `?tag=` URL param, compact-log row anatomy (italic single-line system events with leading ⚙, multi-line user comments with avatar + tag chip)
- Permissions: any signed-in member can comment; author OR machine owner OR site admin can soft-delete; no editing
- Schema designed to extend to PinballMap, iScored, and global org events without restructuring

Spec: `docs/superpowers/specs/2026-05-17-machine-timeline-design.md`
Bead: PP-0x98

## Test plan

- [x] Unit: tag enum, formatter (`pnpm run check`)
- [x] Integration: helpers + 6 lifecycle hooks + 5 issue-action hooks + permission split (`pnpm test:integration -- machine-timeline`)
- [x] E2E: comment add, delete permission split, tag filter URL, reassignment dual-row (`pnpm exec playwright test e2e/full/machine-timeline.spec.ts`)
- [x] Smoke: new route covered in responsive-overflow at all viewports

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Run the post-PR labeling skill**

Use `pinpoint-ready-to-review` skill to wait for CI green + handle Copilot review + apply the ready-for-review label per project convention.
