# Issue Search and Filter Bar Design

**Date**: 2026-01-12
**Status**: Design Complete - Ready for Implementation
**Priority**: High - Core UX improvement

## Overview

Comprehensive search and filtering system for the issues list page, supporting free-form search, multi-select filters, sorting, and responsive mobile/desktop layouts.

## Goals

1. **Search**: Free-form text search across issue title, description, and machine name
2. **Primary Filters**: Status (with group shortcuts), Machine, Severity, Priority
3. **Advanced Filters**: Owner, Assignee, Reporter, Consistency, Date Range
4. **Sorting**: By created date, updated date, severity, priority
5. **Responsive**: Desktop-first design with compact mobile layout
6. **Shareable**: All filters reflected in URL parameters

## User Experience

### Desktop Layout

**Default state (collapsed):**

```
┌─────────────────────────────────────────────────────────────┐
│ [Search...................] [× Clear] [Status ▼] [Machine ▼]│
│ [Severity ▼] [Priority ▼] [Sort ▼] [+ More]                │
└─────────────────────────────────────────────────────────────┘
```

**Expanded state (+ More clicked):**

```
┌─────────────────────────────────────────────────────────────┐
│ [Search...................] [× Clear] [Status ▼] [Machine ▼]│
│ [Severity ▼] [Priority ▼] [Sort ▼] [− Less]                │
│ [Owner ▼] [Assignee ▼] [Reporter ▼] [Consistency ▼]        │
│ [Date Range: From] [To]                                      │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout (< 640px)

**Default state:**

```
┌─────────────────────────┐
│ [Search..........] [×]  │
│ [Status ▼] [Machine ▼]  │
│ [+ More Filters (0)]    │
└─────────────────────────┘
```

**Expanded state:**

```
┌─────────────────────────┐
│ [Search..........] [×]  │
│ [Status ▼] [Machine ▼]  │
│ [Severity ▼] [Priority ▼]│
│ [Sort ▼] [Owner ▼]      │
│ [Assignee ▼] [Reporter ▼]│
│ [Consistency ▼]         │
│ [Date: From] [To]       │
│ [− Hide Filters]        │
└─────────────────────────┘
```

## Component Architecture

### New Components

1. **MultiSelect Component**
   - Popover + Command (search) + Checkbox list
   - Props: `value`, `onChange`, `options`, `placeholder`, `searchPlaceholder`
   - Used by: Status, Machine, Severity, Priority, Owner, Assignee, Consistency

2. **DateRangePicker Component**
   - Popover + Calendar
   - Props: `from`, `to`, `onChange`
   - Used by: Date range filter

3. **SortDropdown Component**
   - DropdownMenu with single select
   - Shows current sort with checkmark
   - Options: Newest first, Oldest first, Recently updated, Severity, Priority

### Component Tree

```
IssueFilters (Client Component)
├── SearchInput (Input with debounce)
├── ClearButton (conditional)
├── StatusMultiSelect (MultiSelect)
├── MachineMultiSelect (MultiSelect)
├── SeverityMultiSelect (MultiSelect)
├── PriorityMultiSelect (MultiSelect)
├── SortDropdown (DropdownMenu)
└── MoreFiltersSection (expandable)
    ├── OwnerMultiSelect (MultiSelect)
    ├── AssigneeMultiSelect (MultiSelect)
    ├── ReporterSelect (single select or "anonymous")
    ├── ConsistencyMultiSelect (MultiSelect)
    └── DateRangePicker (DateRangePicker)
```

## URL Search Parameters

All filters stored in URL for shareability and browser history.

| Parameter     | Type            | Example                                 | Description            |
| ------------- | --------------- | --------------------------------------- | ---------------------- |
| `q`           | string          | `q=flipper`                             | Free-form search query |
| `status`      | comma-separated | `status=new,confirmed,fixed`            | Selected statuses      |
| `machine`     | comma-separated | `machine=TZ,MM,AFM`                     | Machine initials       |
| `severity`    | comma-separated | `severity=major,unplayable`             | Severity levels        |
| `priority`    | comma-separated | `priority=high,medium`                  | Priority levels        |
| `owner`       | comma-separated | `owner=uuid1,uuid2`                     | Machine owner IDs      |
| `assignee`    | comma-separated | `assignee=uuid1,uuid2`                  | Assignee user IDs      |
| `reporter`    | string          | `reporter=uuid` or `reporter=anonymous` | Reporter filter        |
| `consistency` | comma-separated | `consistency=frequent,constant`         | Consistency levels     |
| `date_from`   | ISO date        | `date_from=2025-01-01`                  | Start date for filter  |
| `date_to`     | ISO date        | `date_to=2025-12-31`                    | End date for filter    |
| `sort`        | string          | `sort=created_desc`                     | Sort order             |

### Default Behaviors

- **No status param**: Show all open statuses (new + in_progress groups)
- **No sort param**: Default to `created_desc` (newest first)
- **Invalid values**: Silently filter out invalid options, use valid subset
- **Empty filters**: Show all issues (no filters applied)

## Status Dropdown Structure

Special handling for status groups + individual statuses:

```
Status ▼
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
[Search status...]
☐ New (group)
☐ In Progress (group)
☐ Closed (group)
─────────────────
☐ New
☐ Confirmed
☐ In Progress
☐ Need Parts
☐ Need Help
☐ Pending Owner
☐ Fixed
☐ Won't Fix
☐ As Intended
☐ No Repro
☐ Duplicate
```

**Behavior:**

- Selecting "New (group)" auto-selects "New" + "Confirmed"
- Selecting individual statuses updates group to indeterminate if partial
- All statuses multi-selectable with checkboxes

## Data Fetching

### Cached Data Fetchers

Following `docs/patterns/data-fetching.md` pattern:

```typescript
// src/lib/data/issues.ts
import { cache } from "react";

export const getFilteredIssues = cache(
  async (filters: IssueFilters, sort: SortOption) => {
    return await db.query.issues.findMany({
      where: buildWhereConditions(filters),
      orderBy: buildOrderBy(sort),
      with: {
        machine: { columns: { name: true } },
        reportedByUser: { columns: { name: true } },
        assignedToUser: { columns: { name: true } },
      },
      limit: 100,
    });
  }
);

export const getMachines = cache(async () => {
  return await db.query.machines.findMany({
    columns: { initials: true, name: true },
    orderBy: asc(machines.name),
  });
});

export const getMachineOwners = cache(async () => {
  return await db
    .selectDistinct({ id: userProfiles.id, name: userProfiles.name })
    .from(userProfiles)
    .innerJoin(machines, eq(machines.ownerId, userProfiles.id))
    .orderBy(asc(userProfiles.name));
});

export const getAssignableUsers = cache(async () => {
  return await db.query.userProfiles.findMany({
    columns: { id: true, name: true },
    where: inArray(userProfiles.role, ["member", "admin"]),
    orderBy: asc(userProfiles.name),
  });
});
```

### Server Component Usage

```typescript
// src/app/(app)/issues/page.tsx
const [issues, machines, owners, users] = await Promise.all([
  getFilteredIssues(filters, sort),
  getMachines(),
  getMachineOwners(),
  getAssignableUsers(),
]);
```

## Query Building

### Filter Logic

All multi-select filters use **OR within, AND across**:

- "Major OR Unplayable" (within severity filter)
- AND "Machine TZ OR MM" (within machine filter)
- AND "Status new OR confirmed" (within status filter)

```typescript
function buildWhereConditions(filters: IssueFilters) {
  const conditions = [
    filters.statuses?.length
      ? inArray(issues.status, filters.statuses)
      : undefined,
    filters.machines?.length
      ? inArray(issues.machineInitials, filters.machines)
      : undefined,
    filters.severities?.length
      ? inArray(issues.severity, filters.severities)
      : undefined,
    filters.priorities?.length
      ? inArray(issues.priority, filters.priorities)
      : undefined,
    filters.search
      ? or(
          ilike(issues.title, `%${filters.search}%`),
          ilike(issues.description, `%${filters.search}%`)
          // Machine name search requires join
        )
      : undefined,
    filters.dateFrom
      ? gte(issues.createdAt, new Date(filters.dateFrom))
      : undefined,
    filters.dateTo
      ? lte(issues.createdAt, new Date(filters.dateTo))
      : undefined,
  ].filter(Boolean);

  return and(...conditions);
}
```

### Search Implementation

For machine name search, join machine table and include in OR condition:

```typescript
// Include machine relation in query
with: {
  machine: {
    columns: { name: true },
  },
}

// Filter in-memory or use sql template for cross-table search
// Option 1: Fetch all, filter in JS (simpler for MVP)
// Option 2: Use sql`...` for database-level search (more performant)
```

### Sort Options

```typescript
function buildOrderBy(sort: SortOption) {
  switch (sort) {
    case "created_desc":
      return desc(issues.createdAt);
    case "created_asc":
      return asc(issues.createdAt);
    case "updated_desc":
      return desc(issues.updatedAt);
    case "severity_desc":
      return desc(issues.severity);
    case "priority_desc":
      return desc(issues.priority);
    default:
      return desc(issues.createdAt);
  }
}
```

## Component Behavior

### Search Input

- **Debounce**: 300ms delay before updating URL
- **Clear button**: Shows when text entered, clears on click
- **Placeholder**: "Search issues..."
- **Updates**: `q` URL param

### Multi-Select Dropdowns

- **Display when empty**: "All {Machines|Statuses|etc.}"
- **Display when 1 selected**: Show single name
- **Display when 2+ selected**: "{Count} {Items}" (e.g., "3 Machines")
- **Search**: Fuzzy search via Command component
- **Selection**: Checkboxes, immediate URL update on change

### Sort Dropdown

- **Display**: Show current sort (e.g., "Newest first ✓")
- **Options**:
  - Newest first (created_desc)
  - Oldest first (created_asc)
  - Recently updated (updated_desc)
  - Severity: High → Low (severity_desc)
  - Priority: High → Low (priority_desc)

### More Filters Toggle

- **Default**: "+ More" button
- **Expanded**: "− Less" button
- **Badge**: Shows count if any overflow filters active: "+ More (3)"
- **Behavior**: Inline expansion (no drawer/modal)
- **State**: Persists during session (local component state)

### Clear Filters Button

- **Shows when**: Any filter active (non-default state)
- **Action**: Navigate to `/issues` (clears all params)
- **Icon**: X icon + "Clear" text

## Navigation Behavior

**URL Update Strategy:**

- Use Next.js `router.push()` with new search params
- **No full page reload** - client-side navigation only
- Server Component re-executes with new params
- Issues list updates via server fetch
- Filter component state preserved (dropdowns stay open)

**Search Debouncing:**

- Wait 300ms after user stops typing before updating URL
- Prevents 13 navigations while typing "twilight zone"
- Single navigation after pause

## Edge Cases & Validation

### Invalid URL Parameters

- **Invalid status values**: Filter out, use valid subset
- **Invalid UUIDs**: Ignore invalid IDs
- **Malformed dates**: Ignore and don't apply date filter
- **Unknown sort**: Fall back to default `created_desc`

**Strategy**: Silently ignore invalid values (no redirects, no errors shown)

### Empty States

1. **No issues, no filters**: "No issues yet. Report your first issue!"
2. **No issues, filters active**: "No issues found. Try adjusting filters."
3. **No machines in dropdown**: Disable machine filter, show "No machines yet"
4. **No owners/assignees**: Show empty dropdown with "No users found"

### Filter Conflicts

Not applicable - all filters are additive (AND logic across filters)

## Responsive Breakpoints

- **Mobile**: < 640px - Minimal filters visible, expansion required
- **Tablet**: 640px - 1024px - Two filters per row
- **Desktop**: > 1024px - Full layout with all primary filters visible

## Testing Strategy

### Unit Tests

```typescript
// src/lib/issues/filters.test.ts
describe("parseIssueFilters", () => {
  it("parses comma-separated status values");
  it("filters out invalid status values");
  it("defaults to open statuses when no status param");
  it("parses date range correctly");
  it("handles multiple machine initials");
});
```

### Integration Tests (PGlite)

```typescript
// src/test/integration/supabase/issue-filtering.test.ts
describe("Issue Filtering Queries", () => {
  it("filters by multiple statuses");
  it("filters by machine initials");
  it("searches across title and description");
  it("applies date range filter");
  it("combines multiple filters with AND logic");
});
```

### E2E Tests (Playwright)

```typescript
// e2e/smoke/issue-filtering.spec.ts
test("filter issues by status group");
test("search issues by text");
test("sort issues by priority");
test("combine multiple filters");
test("clear all filters");
```

**Coverage Goals**: 70% unit, 25% integration, 5% E2E

## Implementation Phases

### Phase 1: Foundation (Components)

1. Add shadcn components: `pnpm dlx shadcn@latest add popover command calendar`
2. Build `MultiSelect` component (Popover + Command + Checkbox)
3. Build `DateRangePicker` component (Popover + Calendar)
4. Build `SortDropdown` component (DropdownMenu)

### Phase 2: Data Layer

1. Create cached data fetchers in `src/lib/data/issues.ts`
2. Update issues page to parse all new search params
3. Build `buildWhereConditions()` query logic
4. Implement search across title/description/machine name
5. Add `buildOrderBy()` sort logic

### Phase 3: UI Assembly

1. Refactor `IssueFilters` component with new layout
2. Replace current filters with MultiSelect components
3. Add expandable "More Filters" section with toggle
4. Add responsive mobile layout
5. Add debounced search input

### Phase 4: Testing & Polish

1. Unit tests for filter parsing and validation
2. Integration tests for query building
3. E2E test for critical filter workflows
4. Performance check with 100+ issues
5. Mobile testing on actual devices

## Key Files

**New Files:**

- `src/components/ui/multi-select.tsx`
- `src/components/ui/date-range-picker.tsx`
- `src/lib/data/issues.ts`
- `src/lib/issues/filters.ts` (helper functions)
- `src/test/integration/supabase/issue-filtering.test.ts`
- `e2e/smoke/issue-filtering.spec.ts`

**Modified Files:**

- `src/components/issues/IssueFilters.tsx` (major refactor)
- `src/app/(app)/issues/page.tsx` (query expansion)

## Success Criteria

1. ✅ All 12 filter types functional (search, status, machine, severity, priority, sort, owner, assignee, reporter, consistency, date range)
2. ✅ Multi-select works with search for all applicable filters
3. ✅ URL reflects all active filters (shareable links)
4. ✅ Mobile layout compact and usable
5. ✅ Search debounced (no excessive requests)
6. ✅ Queries perform well with 100+ issues
7. ✅ Clear button removes all filters
8. ✅ Browser back/forward works correctly
9. ✅ Tests pass (unit, integration, E2E)
10. ✅ Works without JavaScript (progressive enhancement for form submit)

## Future Enhancements (Out of Scope)

- Saved filter sets per user (1.0)
- Filter presets ("My open issues", "High priority unassigned", etc.)
- Advanced search syntax (field:value queries)
- Export filtered results to CSV
- Real-time filter updates (WebSocket)
- Filter analytics (most common filter combinations)
