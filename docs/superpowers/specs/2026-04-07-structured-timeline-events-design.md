# Structured Timeline Events

**Date**: 2026-04-07
**Bead**: PinPoint-cks
**Status**: Design

## Summary

Convert timeline events from plain-text strings stored as ProseMirror documents to structured JSON payloads. Full cutover: new column, data migration, updated write path, updated read path. No visual UI changes.

## Problem

Timeline events (system-generated entries like "Status changed from New to In Progress") are stored as opaque strings wrapped in ProseMirror JSON. This prevents programmatic querying by event type, future UI enhancements, and clean data modeling. The display text is baked into the storage format.

## Design

### Structured Event Schema

Discriminated union on `type`. The `from`/`to` fields store **enum values** (e.g., `"new"`, `"in_progress"`), not display labels. Labels are derived at render time.

```typescript
type TimelineEventData =
  | { type: "assigned"; assigneeName: string }
  | { type: "unassigned" }
  | { type: "status_changed"; from: string; to: string }
  | { type: "severity_changed"; from: string; to: string }
  | { type: "priority_changed"; from: string; to: string }
  | { type: "frequency_changed"; from: string; to: string };
```

### Database Change

Add nullable `event_data jsonb` column to `issue_comments` table.

**Schema addition** (`src/server/db/schema.ts`):

```typescript
eventData: jsonb("event_data").$type<TimelineEventData>(),
```

Column is nullable because user comments (non-system rows) will always have `event_data = NULL`.

### SQL Data Migration (migration 0023)

Parse existing ProseMirror-wrapped text strings into structured JSON for all `is_system = true` rows. Uses PostgreSQL jsonb operators to extract the text node, then regex matching for the 6 known patterns.

**Text extraction**: The text content lives at `content->'content'->0->'content'->0->>'text'` in every system event row.

**Patterns to match** (in order):

| Regex                                   | Structured output                                    |
| --------------------------------------- | ---------------------------------------------------- |
| `^Assigned to (.+)$`                    | `{"type":"assigned","assigneeName":"$1"}`            |
| `^Unassigned$`                          | `{"type":"unassigned"}`                              |
| `^Status changed from (.+) to (.+)$`    | `{"type":"status_changed","from":"$1","to":"$2"}`    |
| `^Severity changed from (.+) to (.+)$`  | `{"type":"severity_changed","from":"$1","to":"$2"}`  |
| `^Priority changed from (.+) to (.+)$`  | `{"type":"priority_changed","from":"$1","to":"$2"}`  |
| `^Frequency changed from (.+) to (.+)$` | `{"type":"frequency_changed","from":"$1","to":"$2"}` |

**Label-to-enum mapping**: The `from`/`to` values in existing strings are **display labels** (e.g., "In Progress"), but the structured format stores enum values (e.g., "in_progress"). The migration SQL must map labels back to enum values. Known mappings:

- **Status**: New→new, Confirmed→confirmed, In Progress→in_progress, Need Parts→need_parts, Need Help→need_help, Pending Owner→wait_owner, Fixed→fixed, As Intended→wai, Won't Fix→wont_fix, No Repro→no_repro, Duplicate→duplicate
- **Severity**: Cosmetic→cosmetic, Minor→minor, Major→major, Unplayable→unplayable
- **Priority**: Low→low, Medium→medium, High→high
- **Frequency**: Intermittent→intermittent, Frequent→frequent, Constant→constant

**Note**: Some older events may have stored raw enum values directly (e.g., "in_progress" instead of "In Progress") depending on when `getIssueStatusLabel()` was introduced. The migration must handle both — try label mapping first, fall back to storing the raw value.

**Unmatched rows**: Any `is_system = true` row whose text doesn't match a known pattern gets `event_data = NULL`. The read path falls back to `docToPlainText(content)` for these rows.

### Write Path Changes

**`src/lib/timeline/events.ts`** — `createTimelineEvent` signature changes:

```typescript
// Before:
createTimelineEvent(issueId: string, content: string, tx?, actorId?)

// After:
createTimelineEvent(issueId: string, event: TimelineEventData, tx?, actorId?)
```

The function writes:

- `event_data`: the structured payload
- `content`: an empty ProseMirror doc `{type: "doc", content: []}` to satisfy the existing `NOT NULL` constraint
- `isSystem: true`
- `authorId`: the actor

**`src/services/issues.ts`** — All 6 call sites change from template literals to structured objects:

```typescript
// Before:
createTimelineEvent(
  issueId,
  `Status changed from ${oldLabel} to ${newLabel}`,
  tx,
  actorId
);

// After:
createTimelineEvent(
  issueId,
  { type: "status_changed", from: oldValue, to: newValue },
  tx,
  actorId
);
```

Note: `from`/`to` use the raw enum values, not display labels.

### Read Path Changes

**`src/lib/types/issue.ts`** — `IssueCommentWithAuthor` adds `eventData`:

```typescript
export type IssueCommentWithAuthor = Pick<
  IssueComment,
  "id" | "content" | "createdAt" | "updatedAt" | "isSystem" | "eventData"
> & { ... };
```

**`src/components/issues/IssueTimeline.tsx`** — System event rendering:

1. If `eventData` is present, generate display text from the structured payload using label functions (`getIssueStatusLabel`, etc.)
2. If `eventData` is NULL, fall back to `docToPlainText(content)` (handles unmatched legacy rows)

A new pure function `formatTimelineEvent(event: TimelineEventData): string` produces the same human-readable strings as today:

- `{ type: "assigned", assigneeName: "Tim" }` → `"Assigned to Tim"`
- `{ type: "status_changed", from: "new", to: "in_progress" }` → `"Status changed from New to In Progress"`

Visual output is identical to the current UI.

### Data Fetching

The Drizzle relational query in the issue detail page (`src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx`) already fetches all columns from `issue_comments`. The new `event_data` column will be included automatically via the `comments` relation.

## Testing Strategy

### Unit Tests

- `formatTimelineEvent` — all 6 event types produce correct display strings
- `createTimelineEvent` — writes structured `event_data` and empty `content` doc

### Integration Tests

- Existing `issue-services.test.ts` updated: assertions check `event_data` payloads instead of content strings
- Verify round-trip: create event → read back → `formatTimelineEvent` produces expected text

### Migration Validation Against Production Data

**Required before merge.** This is not optional.

1. **Create prod backup**: `pnpm run db:backup` (requires Supabase CLI linked to production)
2. **Seed local DB**: `pnpm run db:seed:from-prod`
3. **Run migration**: `pnpm run db:migrate`
4. **Verify completeness**: Query for unmatched rows:
   ```sql
   SELECT id, content->'content'->0->'content'->0->>'text' as text
   FROM issue_comments
   WHERE is_system = true AND event_data IS NULL;
   ```
   Expected: zero rows (or a small number of truly unexpected patterns)
5. **Verify correctness**: Spot-check structured payloads:
   ```sql
   SELECT event_data, content->'content'->0->'content'->0->>'text' as original_text
   FROM issue_comments
   WHERE is_system = true AND event_data IS NOT NULL
   LIMIT 20;
   ```
6. **Verify UI**: Start dev server, navigate to an issue with timeline events, confirm display is unchanged

### E2E Tests

Existing E2E tests that create/view issues with status changes should pass unchanged (visual output is the same).

## Files Changed

| File                                                   | Change                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `src/server/db/schema.ts`                              | Add `eventData` column                                              |
| `src/lib/timeline/events.ts`                           | New types, updated `createTimelineEvent`, new `formatTimelineEvent` |
| `src/services/issues.ts`                               | 6 call sites → structured objects                                   |
| `src/lib/types/issue.ts`                               | Add `eventData` to `IssueCommentWithAuthor`                         |
| `src/components/issues/IssueTimeline.tsx`              | Read `eventData`, fallback to `content`                             |
| `drizzle/0023_*.sql`                                   | DDL + data migration                                                |
| `src/test/integration/supabase/issue-services.test.ts` | Updated assertions                                                  |

## What This Does NOT Include

- No UI visual changes (same gray text rendering)
- No new event types beyond the existing 6
- No removal of the `content` column (still used by user comments; system events write an empty doc)
- No removal of `plainTextToDoc` usage (still used by user comments)

## Follow-up Work

Separate bead for future consideration:

- Rich UI rendering (icons, colored badges per event type)
- New event types (e.g., "title changed", "description edited")
- Eventually make `content` nullable for system events and stop writing the empty doc placeholder
