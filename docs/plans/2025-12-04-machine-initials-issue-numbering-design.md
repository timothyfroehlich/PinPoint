# Machine Initials and Issue Numbering Design

**Date:** 2025-12-04
**Status:** Approved
**Scope:** Pre-beta breaking change (fresh start)

## Overview

Replace UUID-based issue identification with human-friendly machine initials and sequential issue numbers. Issues will be identified as `MM-01`, `AFM-12`, etc., making them easier to reference in conversation and URLs.

## Key Decisions

### Identity Architecture

- **Machines:** Keep UUID as primary key, add unique `initials` field
- **Issues:** Keep UUID as primary key, add unique constraint on `(machine_initials, issue_number)`
- **User-facing:** All URLs and UI use initials + numbers, UUIDs never exposed to users
- **Permanence:** Machine initials are permanent and cannot be changed after creation

### Fresh Start Migration

- Pre-beta with no production data
- Breaking schema change with new seed data
- No migration files needed (per NON_NEGOTIABLES.md)
- Old UUID-based URLs will 404 (acceptable)

## Database Schema Changes

### Machines Table

**Add columns:**

```sql
initials        TEXT NOT NULL UNIQUE CHECK (initials ~ '^[A-Z0-9]{2,6}$')
next_issue_number  INTEGER NOT NULL DEFAULT 1
```

**Properties:**

- `initials`: 2-6 characters, alphanumeric, always uppercase
- `next_issue_number`: Atomic counter for issue numbering
- Unique constraint on `initials` (enforced by database)

### Issues Table

**Add columns:**

```sql
machine_initials  TEXT NOT NULL REFERENCES machines(initials) ON DELETE CASCADE
issue_number      INTEGER NOT NULL
```

**Remove column:**

```sql
machine_id UUID -- Remove UUID foreign key
```

**Add constraint:**

```sql
UNIQUE (machine_initials, issue_number)
```

**Properties:**

- Keep UUID as primary key for internal references
- Foreign key references `machines(initials)`, not `machines(id)`
- Composite unique key ensures no duplicate issue numbers per machine

### Related Tables

No changes needed to:

- `issue_comments` (references issues by UUID)
- `issue_watchers` (references issues by UUID)
- `notifications` (references issues by UUID)

## URL Structure

### New Routes (replace existing)

```
/m                     → Machine list page
/m/[id]                → Machine detail page
/m/[id]/report         → Report new issue form
/m/[id]/i              → Issues list for that machine
/m/[id]/i/[num]        → Specific issue detail page
```

**Route parameters:**

- `[id]` = machine initials (e.g., "MM")
- `[num]` = issue number (e.g., "01")

**Examples:**

- Medieval Madness machine: `/m/MM`
- Issue #1 for Medieval Madness: `/m/MM/i/01`
- Report issue for Monster Bash: `/m/MB/report`

### Removed Routes

- `/machines/*` (replaced by `/m/*`)
- `/issues/*` (replaced by `/m/[id]/i/*`)

## Issue Number Counter Logic

### Atomic Transaction

When creating a new issue:

```typescript
await db.transaction(async (tx) => {
  // 1. Lock machine row and get next number
  const machine = await tx.query.machines.findFirst({
    where: eq(machines.initials, machineInitials),
    // FOR UPDATE lock
  });

  const issueNumber = machine.next_issue_number;

  // 2. Create issue with assigned number
  await tx.insert(issues).values({
    id: uuid(),
    machine_initials: machineInitials,
    issue_number: issueNumber,
    title, description, severity, ...
  });

  // 3. Increment counter
  await tx.update(machines)
    .set({ next_issue_number: issueNumber + 1 })
    .where(eq(machines.initials, machineInitials));
});

// 4. Trigger notifications after transaction commits
```

### Key Properties

- **Atomic:** Row-level lock prevents race conditions
- **Sequential:** Numbers increment per machine (1, 2, 3, ...)
- **Gaps expected:** Transaction rollbacks, deleted issues
- **Never reused:** Like GitHub issue numbers, gaps are permanent

## Display Logic

### Issue ID Format

**Format:** `{INITIALS}-{NUMBER}`

**Helper function:**

```typescript
function formatIssueId(initials: string, number: number): string {
  return `${initials.toUpperCase()}-${number.toString().padStart(2, "0")}`;
}
```

**Examples:**

- MM-01 (first issue)
- MM-12 (twelfth issue)
- MM-105 (one hundred fifth issue)

### UI Components Requiring Updates

1. **Issue Cards** (lists, search results)
   - Add issue ID badge at top
   - Prominent display of formatted ID

2. **Issue Detail Page**
   - Show issue ID in page header
   - Breadcrumb: Machine Name > Issues > MM-01

3. **Search Results**
   - Display issue ID alongside title
   - Issue ID is clickable (links to issue)

4. **Machine Detail Page**
   - Issue list shows ID + title
   - Sort by issue number descending (newest first)

5. **Create Issue Form**
   - Preview next issue number: "Next issue will be MM-{next_number}"

## Machine Creation Flow

### Form Updates

**Add initials field:**

- Input: 2-6 characters, alphanumeric only
- Auto-uppercase transformation on input
- Real-time validation feedback
- **Warning:** "Machine initials are permanent and cannot be changed"

### Validation

**Zod schema:**

```typescript
const machineInitialsSchema = z
  .string()
  .min(2, "Initials must be at least 2 characters")
  .max(6, "Initials must be at most 6 characters")
  .regex(/^[A-Z0-9]+$/i, "Only letters and numbers allowed")
  .transform((val) => val.toUpperCase());
```

**Database constraint:**

```sql
CHECK (initials ~ '^[A-Z0-9]{2,6}$')
```

### Error Handling

**Duplicate initials:**

- Database unique constraint prevents duplicates
- Form error: "Initials 'MM' are already taken"
- User chooses alternative (no auto-suggestions)

## Error Handling and Edge Cases

### Invalid URLs

**Invalid machine initials:** `/m/XYZ` (doesn't exist)

- 404 page
- Link: "Go to machine list"

**Invalid issue number:** `/m/MM/i/999` (doesn't exist)

- 404 page
- Message: "Issue MM-999 not found"

### Counter Edge Cases

**Transaction rollback:**

- Number is skipped (expected behavior)
- Gap in sequence (MM-01, MM-03 if MM-02 failed)

**Deleted issues:**

- Number never reused (expected behavior)
- Permanent gaps like GitHub

**Concurrent creation:**

- Row-level lock prevents race conditions
- Second request waits for first to complete
- Both get unique sequential numbers

## Seed Data Updates

### Machines

Update `supabase/seed.sql` to include initials:

| Machine          | Initials   |
| ---------------- | ---------- |
| Medieval Madness | MM         |
| Monster Bash     | MB         |
| Attack from Mars | AFM        |
| Twilight Zone    | TZ         |
| (all others)     | (assigned) |

### Issues

Update issues to use:

- `machine_initials` (text) instead of `machine_id` (UUID)
- `issue_number` (integer) sequential per machine

## Testing Strategy

### Unit Tests

- `formatIssueId()` helper function
  - Padding (01, 12, 105)
  - Uppercase transformation
- Initials validation schema (Zod)
  - Length constraints (2-6 chars)
  - Pattern validation (alphanumeric only)

### Integration Tests

- Issue creation with counter increment
  - Transaction atomicity
  - Counter increments correctly
- Concurrent issue creation
  - No race conditions
  - Both get unique numbers
- Unique constraint violations
  - Duplicate initials rejected
  - Clear error messages
- Query by composite key
  - Lookup by `(machine_initials, issue_number)`
  - Performance validation

### E2E Tests

- Reuse/adapt existing issue creation smoke test
- Verify new URL structure works (`/m/MM/i/01`)
- Minimal coverage (most logic in integration tests)

## Implementation Notes

### Lookup Performance

- Unique constraint on `(machine_initials, issue_number)` creates index
- Lookups by composite key are efficient
- No performance concerns for expected scale

### Migration Path

- Pre-beta breaking change (no data preservation)
- Direct schema modification (no migration files)
- Fresh seed data with new structure
- Old URLs become 404 (acceptable)

### Future Considerations

**If initials changeability is needed later:**

- Add redirect mapping table (old_initials → new_initials)
- Update all issue display logic to show current initials
- Handle URL redirects from old to new
- Defer to post-MVP (not needed now)

## Open Questions

None. Design is complete and approved.
