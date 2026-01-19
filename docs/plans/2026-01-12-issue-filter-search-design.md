# Issue Search and Filter Bar Design v2.0

**Date**: 2026-01-19
**Status**: Design Complete — Ready for Implementation
**Priority**: High — Core UX improvement
**Reference Mockup**: `/src/app/(app)/mockup/filters/page.tsx`

---

## Overview

Comprehensive search and filtering system for the Issues List page. This design doc captures the finalized mockup implementation with all design decisions documented for agent handoff.

## Goals

1. **Search**: Free-form text search across issue title, ID, and machine name
2. **Primary Filters**: Status (with group shortcuts), Machine, Severity, Priority, Assignee
3. **Advanced Filters**: Owner, Reporter, Consistency, Date Range (expandable section)
4. **Sorting**: By column headers + View Options dropdown
5. **Pagination**: Configurable page sizes (15/25/50) with split controls in header
6. **Responsive**: Dynamic column hiding based on available whitespace
7. **Shareable**: All filters reflected in URL parameters (core requirement)

---

## User Experience

### Desktop Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────────┐ [Clear]   │
│ │ 🔍 Search issues...                   [AFM ×] [TZ ×] [+2] │           │
│ └──────────────────────────────────────────────────────────────┘           │
├────────────────────────────────────────────────────────────────────────────┤
│ [Status ▼]  [Machine ▼]  [Severity ▼]  [Priority ▼]  [Assignee ▼] [+ More] │
├────────────────────────────────────────────────────────────────────────────┤
│ (Expanded: Owner, Reporter, Consistency, Date Range)                       │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ ⚡ ISSUES LOG [15]           1-15 of 15 [◀│▶]          [View Options ▼]    │
├────────────────────────────────────────────────────────────────────────────┤
│ Issue              │ Status    │ Priority  │ Severity  │ Assignee │Modified│
├────────────────────────────────────────────────────────────────────────────┤
│ AFM-101 — Attack   │ 🟢 New    │ 🔴 High   │ ⚠ Major   │ Tim F.   │ 2h ago │
│ from Mars          │           │           │           │          │        │
│ Flipper not resp...│           │           │           │          │        │
└────────────────────────────────────────────────────────────────────────────┘
```

### Key Layout Decisions

1. **Search Bar**: Full-width input with inline filter badges
2. **Filter Badges**: Positioned absolutely on right side of input, collapse into `+X` when text approaches
3. **Clear Button**: Always visible, outside search bar
4. **More/Less Toggle**: Inline expansion for advanced filters
5. **Pagination**: Split design in header (`1-15 of 97 [◀│▶]`)
6. **View Options**: Dropdown for sort options not on table headers

---

## Component Architecture

### Search Bar with Responsive Badges

The search bar is a complex component with the following behavior:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 [input text here____________] [Badge1 ×] [Badge2 ×] [+3]    │
└─────────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**
- Hidden `<span>` measures input text width using `getBoundingClientRect()`
- `ResizeObserver` recalculates badge layout on container resize
- Badges positioned with `position: absolute; right: 12px`
- Input `paddingRight` dynamically matches badge area width
- Badges have `z-index: 20`, input has `z-index: 10`

**Badge Behavior:**
- **Order**: Most recently added filter appears leftmost (shifts others right/into overflow)
- **Overflow**: When text approaches badges, rightmost badges collapse into `+X` indicator
- **Click X**: Removes that specific filter
- **Click +X Badge**: Opens popover showing all hidden badges with X buttons

**Badge Display Format:**
- Machines: Use abbreviation (e.g., "AFM" not "Attack from Mars")
- Status Groups: "Status: New", "Status: In Progress", "Status: Closed"
- Individual Statuses: Show status label directly
- Other filters: Show value label

### MultiSelect Component

Popover + Command (searchable) + Checkbox list:

```typescript
interface MultiSelectProps {
  options?: Option[];           // Flat options
  groups?: GroupedOption[];     // Grouped options (for Status)
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}
```

**Status Dropdown Special Behavior:**
- Group headers ("New", "In Progress", "Closed") have checkboxes
- Clicking group checkbox selects/deselects all statuses in group
- Partial selection shows **indeterminate** state on group checkbox

### Pagination Component

**Split Design (Header Position):**
```
┌─────────────────────────────────────────────────────────────────┐
│ ISSUES LOG [15]        1-15 of 97 [◀│▶]        [View Options ▼] │
└─────────────────────────────────────────────────────────────────┘
```

**Configuration:**
- Page sizes: 15 (default), 25, 50
- Page size selector in View Options dropdown
- Auto-reset to page 1 when any filter changes

---

## Issue Table Design

### Column Widths

| Column   | Width        | Responsive            | Notes                          |
|----------|--------------|----------------------|--------------------------------|
| Issue    | `flex-1`     | Always visible       | Min-width 200px, no wrapping   |
| Status   | `150px`      | Dynamic hide         | Icon + Label, 2-line max       |
| Priority | `150px`      | Dynamic hide         | Icon + Label, 2-line max       |
| Severity | `150px`      | Dynamic hide         | Icon + Label, 2-line max       |
| Assignee | `150px`      | Hide at 950px        | Text only (no avatar), 2-line  |
| Modified | `150px`      | Hide at 1100px       | Right-aligned, 2-line max      |

### Dynamic Column Hiding

> [!IMPORTANT]
> Columns should hide dynamically based on available whitespace, not just breakpoints.

**Algorithm:**
1. Calculate Issue column natural width (content + padding)
2. If Issue column whitespace < 50px, begin hiding rightmost optional columns
3. Hide order: Modified → Assignee → Severity → Priority → Status
4. Before hiding, allow metadata columns to shrink their internal padding

### Issue Column Format

```
AFM-101 — Attack from Mars
Left flipper not responding to button press
```

- **Line 1**: `{machine_initials}-{issue_number} — {machine_full_name}`
- **Line 2**: Issue title (truncated with ellipsis)
- **Separator**: Em-dash (—)
- **No text wrapping** on Issue column content

### Sorting Behavior

**Bi-state Column Sort:**
- Click column header: `desc` → `asc` → `desc` (no unsorted state)
- Active sort shows arrow icon (up/down)
- Inactive columns show muted up/down icon on hover

**Default Sort**: `updatedAt` descending (confirmed with product owner)

**Secondary Sort**: Always `updatedAt desc` as tiebreaker

**Issue Column Sort**: Sorts by machine initials first, then issue number (numeric, not lexicographic)

**View Options Dropdown Sorts:**
- Assignee
- Modified (updatedAt)
- Created (createdAt)

---

## URL Search Parameters

All filters stored in URL for shareability. **Core requirement.**

| Parameter     | Type            | Example                           |
|---------------|-----------------|-----------------------------------|
| `q`           | string          | `q=flipper`                       |
| `status`      | comma-separated | `status=new,confirmed`            |
| `machine`     | comma-separated | `machine=TZ,MM,AFM`               |
| `severity`    | comma-separated | `severity=major,unplayable`       |
| `priority`    | comma-separated | `priority=high,medium`            |
| `assignee`    | comma-separated | `assignee=uuid1,uuid2`            |
| `owner`       | comma-separated | `owner=uuid1`                     |
| `reporter`    | string          | `reporter=uuid` or `anonymous`    |
| `consistency` | comma-separated | `consistency=frequent,constant`   |
| `date_from`   | ISO date        | `date_from=2026-01-01`            |
| `date_to`     | ISO date        | `date_to=2026-12-31`              |
| `sort`        | string          | `sort=updated_desc`               |
| `page`        | number          | `page=2`                          |
| `page_size`   | number          | `page_size=25`                    |

### Default Behaviors

- **No status param**: Show all open statuses (new + in_progress groups)
- **No sort param**: Default to `updated_desc`
- **No page param**: Default to page 1
- **No page_size param**: Default to 15
- **Invalid values**: Silently filter out, use valid subset

---

## Filter Logic

All multi-select filters use **OR within, AND across**:

```
(status = "new" OR status = "confirmed")
AND (machine = "TZ" OR machine = "MM")
AND (severity = "major" OR severity = "unplayable")
```

---

## Empty States

1. **No issues, no filters**: "No issues yet. Report your first issue!"
2. **No issues, filters active**: "No issues found. Adjust your filters to see more issues."
3. **No machines in dropdown**: Disable machine filter, show "No machines yet"

---

## Testing Strategy

Following PinPoint's testing pyramid (70% unit / 25% integration / 5% E2E):

### Unit Tests (~15 tests)

```typescript
// src/test/unit/lib/issues/filters.test.ts
describe("parseIssueFilters", () => {
  it("parses comma-separated status values");
  it("filters out invalid status values");
  it("defaults to open statuses when no status param");
  it("parses date range correctly");
  it("handles multiple machine initials");
});

describe("buildSortOrder", () => {
  it("returns updatedAt desc for default");
  it("handles issue column sort (machine + number)");
  it("cycles between asc and desc only");
});

describe("calculateVisibleBadges", () => {
  it("shows all badges when space available");
  it("collapses rightmost badges first");
  it("reserves space for +X indicator");
});

describe("filterBadgeOrder", () => {
  it("orders badges by most recently added");
  it("moves new filters to leftmost position");
});
```

### Integration Tests (~5 tests)

```typescript
// src/test/integration/supabase/issue-filtering.test.ts
describe("Issue Filtering Queries", () => {
  it("filters by multiple statuses with OR logic");
  it("combines multiple filter types with AND logic");
  it("sorts by machine initials then issue number numerically");
  it("paginates correctly with offset and limit");
  it("applies date range filter to createdAt");
});
```

### E2E Tests (~3 tests)

```typescript
// e2e/smoke/issue-filtering.spec.ts
test("filter issues and verify URL updates", async ({ page }) => {
  await page.goto("/issues");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByLabel("New").check();
  await expect(page).toHaveURL(/status=new/);
});

test("search issues with badge display", async ({ page }) => {
  // Type search, verify badges collapse appropriately
});

test("pagination persists through filter changes", async ({ page }) => {
  // Navigate to page 2, apply filter, verify reset to page 1
});
```

---

## Implementation Checklist

### Phase 1: Core Components
- [ ] `MultiSelect` component with grouped options support
- [ ] `DateRangePicker` component
- [ ] Search bar with responsive badge system
- [ ] Pagination controls with page size selector

### Phase 2: URL State Management
- [ ] Parse all filter params from URL
- [ ] Sync filter state to URL on changes
- [ ] Handle invalid/malformed params gracefully
- [ ] Implement debounced search (300ms)

### Phase 3: Data Layer
- [ ] Build `buildWhereConditions()` query logic
- [ ] Implement `buildOrderBy()` with issue column special case
- [ ] Add pagination with proper offset/limit
- [ ] Cached data fetchers following `docs/patterns/data-fetching.md`

### Phase 4: Table Implementation
- [ ] Dynamic column hiding algorithm
- [ ] Standardized 150px column widths
- [ ] 2-line max with `line-clamp-2`
- [ ] Assignee without avatar icons
- [ ] Bi-state sorting on column headers

### Phase 5: Testing
- [ ] Unit tests for filter parsing and validation
- [ ] Integration tests for query building
- [ ] E2E tests for critical filter workflows

---

## Success Criteria

- [ ] All 12 filter types functional (search, status, machine, severity, priority, assignee, owner, reporter, consistency, date range, sort, page)
- [ ] URL updates on every filter change (shareable links work)
- [ ] Badges collapse correctly as user types
- [ ] +X popover shows hidden badges with clear buttons
- [ ] Column hiding is smooth and doesn't cause layout jank
- [ ] Pagination resets on filter change
- [ ] Tests pass at all pyramid levels
- [ ] Mobile layout remains usable (horizontal scroll on table)

---

## Files to Create/Modify

**New:**
- `src/components/ui/multi-select.tsx` (upgrade from mockup)
- `src/components/ui/date-range-picker.tsx`
- `src/lib/issues/filters.ts` (URL parsing, query building)
- `src/test/unit/lib/issues/filters.test.ts`
- `src/test/integration/supabase/issue-filtering.test.ts`
- `e2e/smoke/issue-filtering.spec.ts`

**Modify:**
- `src/app/(app)/issues/page.tsx` (main issues page)
- `src/components/issues/IssueList.tsx` (table component)
- `src/components/issues/IssueFilters.tsx` (filter bar)

---

## Future Enhancements (Out of Scope)

- Saved filter sets per user
- Filter presets ("My open issues", "High priority unassigned")
- Advanced search syntax (field:value queries)
- Export filtered results to CSV
- Multi-select issues for batch operations (tracked: Issue #807)
