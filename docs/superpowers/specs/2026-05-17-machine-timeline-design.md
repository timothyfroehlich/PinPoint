# Machine Timeline

**Date**: 2026-05-17
**Bead**: PP-0x98
**Status**: Implemented (PP-0x98)

## Summary

Add a "Timeline" tab to the machine detail page that shows a chronological log of everything that's happened to a machine: lifecycle events (added, owner/name/availability changed, prose-field edits), issue events (opened, closed, status changes, assignments, reassignments to/from this machine), and freeform user comments. Comments support rich text via the existing Tiptap editor and carry a single tag from a fixed built-in tag list. Tags can be filtered via a dropdown. The schema is built for future expansion to PinballMap sync events, high-score events, and other per-machine activity sources.

## Problem

Machines have no audit/log surface today. Maintainers want to record what they did (rebuilt flippers, cleaned playfield, brought to a festival) without filing an issue. Owners want to see who changed what and when. Future integrations (PinballMap, iScored) need a place to land per-machine activity. The issue timeline solves the equivalent problem for issues, but its schema is issue-specific and the events it tracks don't cover machine-record changes.

## Design

### Database

New table `timeline_events`. Org-wide (machineId nullable to leave room for future org-global events like PinballMap scan rows that don't map to a specific machine yet).

```typescript
// src/server/db/schema.ts
export const timelineEvents = pgTable("timeline_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  machineId: uuid("machine_id").references(() => machines.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sourceType: text("source_type").notNull(), // 'comment' | 'lifecycle' | 'issue' (V1)
  tag: text("tag").notNull(), // see tag enum below
  authorId: uuid("author_id").references(() => userProfiles.id), // null for system/external events
  content: jsonb("content").$type<ProseMirrorDoc>(), // user-comment body
  eventData: jsonb("event_data").$type<TimelineEventData>(), // structured payload for non-comment events
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => userProfiles.id),
});
```

Indexes:

```sql
CREATE INDEX timeline_events_machine_created ON timeline_events(machine_id, created_at DESC);
CREATE INDEX timeline_events_tag ON timeline_events(machine_id, tag);
```

Why `machineId` is nullable even though V1 always sets it: future PinballMap orphan events (a PBM sync finds an update for an opdb_id we don't have a machine for yet) need somewhere to land. With `machineId IS NULL`, those rows live in the table waiting for a matching machine to be created, at which point a backfill UPDATE attaches them.

### Tag system

Built-in only for V1. TypeScript const, no DB table, no admin UI.

```typescript
// src/lib/timeline/tags.ts
export const TIMELINE_TAGS = [
  "lifecycle", // reserved — auto-applied to machine-record events
  "issue", // reserved — auto-applied to issue events
  "maintenance",
  "event",
  "cleaning",
] as const;

export type TimelineTag = (typeof TIMELINE_TAGS)[number];

export const RESERVED_TAGS: readonly TimelineTag[] = ["lifecycle", "issue"];
```

Zod schema validates `tag` is one of the values. Comment composer rejects reserved tags. UI shows color-coded chips (specific palette deferred to implementation, matching PinPoint design bible).

If a user later asks for a new built-in tag (`parts_ordered`, etc.), it's a one-line TS change + Zod regeneration. If users start asking for custom tags, that's a follow-up (new `timeline_tags` table, admin UI, matrix entries — about 2.5 days of work).

### Event data shape

Discriminated union by `sourceType` + an inner `kind` for lifecycle events.

```typescript
// src/lib/timeline/types.ts
export type MachineTimelineEventData =
  // sourceType='lifecycle'
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
  | { kind: "description_updated" } // jsonb prose — marker only, no diff
  | { kind: "tournament_notes_updated" }
  | { kind: "owner_requirements_updated" }
  | { kind: "owner_notes_updated" }
  // sourceType='issue' (cross-references mirrored from issue actions)
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
  | { kind: "issue_unassigned"; issueId: string; issueNumber: number }
  | {
      kind: "issue_reassigned_out";
      issueId: string;
      issueNumber: number;
      toMachineName: string;
      toMachineId: string;
    } // this machine's view: issue moved AWAY
  | {
      kind: "issue_reassigned_in";
      issueId: string;
      issueNumber: number;
      fromMachineName: string;
      fromMachineId: string;
    }; // this machine's view: issue moved HERE
```

For `sourceType='comment'`, `eventData` is null and `content` holds the ProseMirror document.

### Reassignment semantics

When an issue moves from machine A to machine B:

1. `issueComments` gets one row recording the reassign (existing behavior, unchanged)
2. `timelineEvents` gets **two** rows in the same transaction:
   - Machine A's timeline: `{kind: 'issue_reassigned_out', toMachineName: 'B', ...}`, tag=`issue`
   - Machine B's timeline: `{kind: 'issue_reassigned_in', fromMachineName: 'A', ...}`, tag=`issue`

Each machine's timeline tells the story from its own perspective. The user explicitly called this out ("issue closed (including when issues get moved from one machine to another)") — reassignment is a first-class event on both sides, not an issue-closed event.

### Write path

New helper, symmetric with the existing `createTimelineEvent` for issues.

```typescript
// src/lib/timeline/machine-events.ts
export async function createMachineTimelineEvent(
  machineId: string,
  args: {
    sourceType: "lifecycle" | "issue";
    tag: TimelineTag;
    eventData: MachineTimelineEventData;
    actorId?: string;
  },
  tx?: TxOrDb
): Promise<void> {
  /* ... */
}

export async function createMachineComment(
  machineId: string,
  args: { content: ProseMirrorDoc; tag: TimelineTag; authorId: string },
  tx?: TxOrDb
): Promise<void> {
  /* ... */
}

export async function softDeleteMachineComment(
  id: string,
  args: { deletedBy: string },
  tx?: TxOrDb
): Promise<void> {
  /* ... */
}
```

Server actions that mutate a machine call `createMachineTimelineEvent` inside the same transaction as the mutation. Specifically (file: `src/app/(app)/m/actions.ts`):

| Action                           | Emits                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `createMachineAction`            | `{kind: 'machine_added'}` and (if `ownerId` set) `{kind: 'owner_set', ...}`      |
| `updateMachineAction`            | One event per changed field: `name_changed`, `owner_changed`, `presence_changed` |
| `updateMachineDescription`       | `{kind: 'description_updated'}`                                                  |
| `updateMachineTournamentNotes`   | `{kind: 'tournament_notes_updated'}`                                             |
| `updateMachineOwnerRequirements` | `{kind: 'owner_requirements_updated'}`                                           |
| `updateMachineOwnerNotes`        | `{kind: 'owner_notes_updated'}`                                                  |

Server actions that mutate an issue but affect a machine (file: `src/app/(app)/issues/actions.ts`) emit to both `issueComments` (existing) and `timelineEvents` (new). The duplicate-write is mandatory for correctness — they must share a transaction. Affected actions:

| Action                                | Issue timeline (existing) | Machine timeline (new)                                                                 |
| ------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| Issue create (opened)                 | initial issue row         | `issue_opened` on the issue's machine                                                  |
| `updateIssueStatusAction` (to closed) | `status_changed`          | `issue_closed` on the issue's machine                                                  |
| `updateIssueStatusAction` (other)     | `status_changed`          | `issue_status_changed` on the machine                                                  |
| `assignIssueAction`                   | `assigned` / `unassigned` | `issue_assigned` / `issue_unassigned`                                                  |
| `reassignIssueMachineAction`          | `machine_reassigned`      | `issue_reassigned_out` on source machine, `issue_reassigned_in` on destination machine |

### Permissions

| Capability            | Audience                                                   | Matrix entry                                            |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| View timeline tab     | Same as machine detail page (no special restriction)       | No new entry                                            |
| Add comment           | Any authenticated user (mirrors `comments.add` for issues) | New: `machines.timeline.comment.add` (authenticated)    |
| Edit comment          | **Not allowed.** Comments are immutable once posted.       | None                                                    |
| Delete comment (soft) | Author OR the machine's owner OR site admin                | New: `machines.timeline.comment.delete` (ownership ctx) |

The delete check uses an ownership context: `accessLevel === 'admin' || authorId === currentUserId || machineOwnerId === currentUserId`. Mirrors how issue ownership "own" works in the existing matrix.

Soft delete: `deletedAt` and `deletedBy` are set; `content` is **not** scrubbed (preserved for moderation audit). The UI shows a tombstone ("Comment deleted by <name>") and hides the original content from everyone (including admins) — preservation is only for DB-level audit if abuse needs investigation.

### UI

**Tab integration**: add a third entry to the `TABS` array in `src/components/machines/MachineTabStrip.tsx`:

```typescript
const TABS: readonly TabSpec[] = [
  { slug: "", label: "Info" },
  { slug: "maintenance", label: "Service" },
  { slug: "timeline", label: "Timeline" },
] as const;
```

New route: `src/app/(app)/m/[initials]/timeline/page.tsx`.

**Page layout** (top to bottom):

1. Tab strip (existing component, picks up new tab automatically)
2. Filter dropdown: "Tag: All ▾" — selecting a tag adds `?tag=...` to the URL
3. Compact composer: a single-line `<button>` styled like an input ("What did you do?") that on focus/click expands inline into the full `RichTextEditor` with format bar + tag select + Post button. Mirrors GitHub/Reddit compact-composer pattern. Unauthenticated viewers see no composer at all.
4. Timeline list, newest first

**Row anatomy** (compact log style):

- **User comments** (2+ lines): avatar (22px) on the left, name + relative time + tag chip on the meta row, body content below. Comments are visually heavier than system events.
- **System events** (single-line italic): leading ⚙ icon, italic text ("Tim changed owner from Alex to Sam", "Issue #42 opened by Maria"), tag chip and time right-aligned. Dense, scannable.
- Deleted comments show a tombstone single-line in muted text: "Comment deleted by <name> · 3d ago".

**Time display**: relative ("2h ago") with absolute on hover/tooltip, matching the existing issue timeline pattern.

**Pagination**: match the existing issue timeline pattern (likely "load more" or infinite scroll — implementer decides based on what's already there).

### Empty state

For a brand-new machine with no events yet: a single illustrated card ("No activity yet — your machine's history will appear here as it's added, updated, and serviced."). The composer is still visible above.

## Out of scope (V1)

- **Custom tags** — defer until users ask. Pure TS const + Zod for V1.
- **Tag filter chips** — dropdown is V1, prominent chip row is V2 if usage warrants.
- **Comment edit** — fully blocked. Re-add only if real users ask.
- **Cross-cutting unification with `issueComments`** — `issueComments` stays as-is. New table coexists. Future migration is non-breaking (adds nullable `issueId` column to `timelineEvents`, backfills, rewires issue detail page). 2-3 day side-project, do it when motivated.
- **Pre-filtered sub-tabs (Issues sub-tab on machine, global PBM tab)** — schema supports it (`WHERE machineId = X AND sourceType = 'issue'` or `WHERE sourceType = 'pinballmap_change'`), but no UI in V1.
- **Notifications** — adding a comment does not notify the machine owner in V1. Worth revisiting once we have notification infra reuse.

## Future extensions (schema-ready, no V1 work)

- **PinballMap sync events** — add `'pinballmap_scan' | 'pinballmap_change'` to `sourceType` enum. Add a nullable lookup field (likely just store `opdbId` inside `eventData`, GIN-index `eventData` for orphan lookup). Orphan promotion when a machine is later created with a matching opdb_id: `UPDATE timelineEvents SET machineId = $new WHERE machineId IS NULL AND eventData->>'opdbId' = $opdbId`. PBM exposes `user_submissions`, `machine_conditions`, `location_machine_xrefs`, `machine_score_xrefs` resources (verified via WebFetch of PBM API docs); each maps to a `pinballmap_change` variant.
- **iScored / high scores** — same pattern. `'highscore'` sourceType, eventData carries `{player, score, gameMode, date}`.
- **Per-org events** (broadcasts, admin announcements) — `machineId IS NULL`, scoped via an eventual `organizationId` column when PinPoint goes multi-tenant.
- **Comment editing**, **rich diff display for prose-field edits**, **threaded replies** — all additive, no schema change needed.

## Verification

After implementation:

1. **Schema migration applies cleanly**: `pnpm db:reset && pnpm db:migrate` succeeds, `pnpm db:generate` reports no further changes.
2. **Auto-events fire**: Create a machine → timeline shows `machine_added`. Update name/owner/presence → corresponding lifecycle event appears. Edit each prose field → marker event appears. Open an issue on the machine → both the issue timeline AND the machine timeline show the event. Close/reassign/status-change/assign → both timelines update transactionally.
3. **Reassignment shows on both machines**: Move issue #42 from Machine A to Machine B → A's timeline shows `issue_reassigned_out`, B's shows `issue_reassigned_in`. The two events share a `createdAt`.
4. **Permissions**: As an authenticated non-owner, add a comment → succeeds. Edit it → no UI affordance. Delete it → succeeds (author). As the machine's owner, delete someone else's comment → succeeds. As an unauthenticated viewer, see no composer.
5. **Tag filter**: Apply `?tag=maintenance` to the URL → only maintenance entries render. Dropdown reflects current selection. Sharing the URL preserves the filter.
6. **Soft delete**: Delete a comment → tombstone appears with deleter name + time. Content is hidden from UI but `deleted_at` is set in DB.
7. **E2E smoke**: Add `/m/[initials]/timeline` to `e2e/smoke/responsive-overflow.spec.ts` so the new route is covered at all three viewport widths.
8. **Bug-class layer split** (per non-negotiable §2.1.9):
   - **Unit**: tag-validation, eventData discriminated-union narrowing, time-formatter
   - **Integration (PGlite)**: each server action emits the correct event row; permission ownership-context for delete; duplicate-write transaction integrity (issue actions writing to both tables atomically)
   - **E2E (Playwright)**: golden-path comment add → renders, owner-delete other's comment → succeeds, member-delete other's comment → blocked, tag filter URL works, reassignment shows on both machines
