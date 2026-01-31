# Machine List Filtering & Sorting Design

**Issue:** #841
**Date:** 2026-01-29
**Status:** Approved

## Overview

Add search, filtering, and sorting capabilities to the Machines list page (`/m`) following the pattern established in the Issues page, while maintaining the current card grid layout.

## Requirements

### MVP Filters

- **Search:** Filter by machine name or initials (exact match priority)
- **Status Filter:** Multi-select for Operational, Needs Service, Unplayable
- **Owner Filter:** Multi-select for machine owners (registered + invited)
- **Sort Options:** Name (A-Z, Z-A), Status (Worst/Best First), Open Issue Count (Most/Least), Date Added (Newest/Oldest)

### Future Extensibility

- Prepared for additional filters: Location, Era/Year, etc.
- Component structure supports easy addition of new filter types

## Architecture

### Approach: Hybrid Server-Side Filtering

**Rationale:** Machine status is derived from related issues, making database-level filtering complex. With a small dataset (20-300 machines), in-memory filtering is performant and simpler.

**Data Flow:**

1. Parse URL search params → typed filter object
2. Fetch all machines with issues, owners (single DB query)
3. Derive status for each machine (existing logic)
4. Apply filters in-memory (search, status, owner)
5. Sort filtered results in-memory
6. Render filtered/sorted machines in card grid

**Performance:** Negligible overhead. Current implementation already fetches all machines and derives status. Adding filtering/sorting on ~100 machines adds <1ms.

### URL State Management

Filter state persists in URL search params for shareability:

```
/m?q=attack&status=unplayable,needs_service&owner=user-123&sort=issues_desc
```

**Benefits:**

- Shareable/bookmarkable filter combinations
- Browser back/forward navigation works
- Deep linking to specific views

## Component Design

### New Components

**`MachineFilters.tsx`** - Filter UI component

- Adapted from `IssueFilters` but simplified (no expandable sections)
- Single filter bar with search + inline badges
- Filter controls: Status multi-select, Owner multi-select, Sort dropdown
- Uses existing `MultiSelect`, `Button`, `Badge` components

### Filter UI Layout

```
┌────────────────────────────────────────────────────────┐
│ [🔍 Search with inline badges]           [Clear]      │
├────────────────────────────────────────────────────────┤
│ [Status ▼] [Owner ▼]                        [Sort ▼]  │
└────────────────────────────────────────────────────────┘
```

**Search Bar:**

- Placeholder: "Search machines by name or initials..."
- 300ms debounce before URL update
- Active filter badges appear inline (Status, Owner selections)
- Clear button removes all filters

**Filter Controls:**

- Status: Multi-select dropdown (Operational, Needs Service, Unplayable)
- Owner: Multi-select dropdown with all users (registered + invited)
- Sort: Single-select dropdown with 8 options

## Filter Logic

### Search (Exact Match Priority)

```typescript
function matchesSearch(machine: Machine, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  // 1. Exact match on initials (case-insensitive)
  if (machine.initials.toLowerCase() === q) return true;

  // 2. Contains match on name
  if (machine.name.toLowerCase().includes(q)) return true;

  return false;
}
```

### Status Filtering

```typescript
function matchesStatus(
  machine: MachineWithStatus,
  selectedStatuses: MachineStatus[]
): boolean {
  if (selectedStatuses.length === 0) return true; // No filter
  return selectedStatuses.includes(machine.status);
}
```

### Owner Filtering

```typescript
function matchesOwner(machine: Machine, selectedOwnerIds: string[]): boolean {
  if (selectedOwnerIds.length === 0) return true; // No filter

  // Match either ownerId or invitedOwnerId
  return (
    selectedOwnerIds.includes(machine.ownerId) ||
    selectedOwnerIds.includes(machine.invitedOwnerId)
  );
}
```

### Sorting

**Sort Options:**

- `name_asc` - Name (A-Z) - Default
- `name_desc` - Name (Z-A)
- `status_desc` - Status (Worst First) - Unplayable → Needs Service → Operational
- `status_asc` - Status (Best First) - Operational → Needs Service → Unplayable
- `issues_desc` - Open Issues (Most First)
- `issues_asc` - Open Issues (Least First)
- `created_desc` - Date Added (Newest)
- `created_asc` - Date Added (Oldest)

**Status Priority Mapping:**

```typescript
const STATUS_PRIORITY = {
  unplayable: 3, // Highest priority (worst)
  needs_service: 2,
  operational: 1, // Lowest priority (best)
};
```

## Data Types

### MachineFilters Interface

```typescript
interface MachineFilters {
  q?: string; // Search query
  status?: MachineStatus[]; // ['operational', 'needs_service', 'unplayable']
  owner?: string[]; // User IDs (ownerId or invitedOwnerId)
  sort?: string; // 'name_asc', 'status_desc', etc.
}

type MachineStatus = "operational" | "needs_service" | "unplayable";
```

### URL Parameter Format

```typescript
parseMachineFilters(params: URLSearchParams): MachineFilters
```

**Parameter Mapping:**

- `q` → string
- `status` → comma-separated values → `MachineStatus[]`
- `owner` → comma-separated user IDs → `string[]`
- `sort` → string (validated against allowed values)

## File Structure

### New Files

```
src/lib/machines/
  filters.ts                 - Filter types, parsing, validation
  filters-queries.ts         - In-memory filter/sort functions

src/components/machines/
  MachineFilters.tsx         - Filter UI component
```

### Modified Files

```
src/app/(app)/m/
  page.tsx                   - Add searchParams, integrate filtering
```

## Page Integration

### Updated `page.tsx` Structure

```typescript
interface MachinesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MachinesPage({ searchParams }: MachinesPageProps) {
  // 1. Auth check (existing)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fm");

  // 2. Parse filters
  const rawParams = await searchParams;
  const urlParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      Array.isArray(v) ? [[k, v.join(',')]] : v ? [[k, v]] : []
    )
  );
  const filters = parseMachineFilters(urlParams);

  // 3. Fetch all machines (existing query)
  const allMachines = await db.query.machines.findMany({
    orderBy: desc(machines.name),
    with: {
      issues: { columns: { status: true, severity: true } },
      owner: { columns: { id: true, name: true } },
      invitedOwner: { columns: { id: true, name: true } },
    },
  });

  // 4. Fetch all users for owner filter
  const allUsers = await db.query.userProfiles.findMany({
    orderBy: (u, { asc }) => [asc(u.name)],
    columns: { id: true, name: true },
  });

  // 5. Derive status (existing logic)
  const machinesWithStatus = allMachines.map(m => ({
    ...m,
    status: deriveMachineStatus(m.issues),
    openIssuesCount: m.issues.filter(i => !CLOSED_STATUSES.includes(i.status)).length,
  }));

  // 6. Apply filters
  const filteredMachines = applyMachineFilters(machinesWithStatus, filters);

  // 7. Sort
  const sortedMachines = sortMachines(filteredMachines, filters.sort ?? 'name_asc');

  // 8. Render
  return (
    <main>
      {/* Header - existing */}
      <MachineFilters users={allUsers} filters={filters} />

      {/* Machine grid - existing, but uses sortedMachines */}
      {sortedMachines.length === 0 ? (
        <EmptyState hasFilters={hasActiveMachineFilters(urlParams)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMachines.map(machine => (
            <MachineCard key={machine.id} machine={machine} />
          ))}
        </div>
      )}
    </main>
  );
}
```

### Empty State Handling

**No Machines (No Filters Active):**

```
No machines yet
[Add Your First Machine]
```

**No Matches (Filters Active):**

```
No machines match your filters
Try adjusting your search or filter criteria.
```

## Implementation Notes

### Code Reuse

- `useSearchFilters` hook - Reuse from Issues page for client-side URL updates
- `MultiSelect` component - Use existing component from shadcn/ui
- `Badge` component - Use for inline filter indicators
- Owner fetching pattern - Same as Issues (fetch both userProfiles + invitedUsers)

### Testing Strategy

**Unit Tests:**

- `parseMachineFilters()` - URL param parsing edge cases
- `matchesSearch()` - Exact match priority logic
- `sortMachines()` - All sort options, tie-breaking

**Integration Tests:**

- Filter combinations (search + status + owner)
- URL state synchronization
- Empty states

**E2E Tests:**

- Search by initials (exact match)
- Search by name (contains)
- Multi-select status filtering
- Owner filtering
- Sort order changes
- URL sharing (bookmark, copy/paste)

### Performance Considerations

**Current Scale:** 20-100 machines typical, 200-300 max
**Filtering Cost:** O(n) where n = machine count - negligible
**Sorting Cost:** O(n log n) - negligible for n < 1000
**Memory:** All machines already fetched for status derivation

**Conclusion:** No performance concerns. In-memory filtering is the right choice.

### Future Extensibility

**Adding New Filters (e.g., Location, Era):**

1. Add field to `MachineFilters` interface
2. Add URL param parsing in `parseMachineFilters()`
3. Add filter function in `filters-queries.ts`
4. Add `MultiSelect` to `MachineFilters.tsx` component
5. Add badge rendering logic

**Example - Adding Location Filter:**

```typescript
// filters.ts
interface MachineFilters {
  // ... existing
  location?: string[];  // NEW
}

// filters-queries.ts
function matchesLocation(machine: Machine, selectedLocations: string[]): boolean {
  if (selectedLocations.length === 0) return true;
  return selectedLocations.includes(machine.location);
}

// MachineFilters.tsx
<MultiSelect
  options={locationOptions}
  value={filters.location ?? []}
  onChange={(val) => pushFilters({ location: val })}
  placeholder="Location"
/>
```

## Migration Path

**Phase 1 (MVP):** Search, Status, Owner, Sort
**Phase 2:** Add Location filter (when schema updated)
**Phase 3:** Add Era/Year range filter
**Phase 4:** Consider pagination if collection grows beyond 500 machines

## Success Criteria

- ✅ Users can search machines by name or initials
- ✅ Users can filter by status to see "all unplayable machines"
- ✅ Users can filter by owner to see "my machines"
- ✅ Users can sort by issue count to prioritize repairs
- ✅ Filter state is shareable via URL
- ✅ Performance remains excellent (<100ms page load)
- ✅ UI maintains current card grid aesthetic
- ✅ Architecture supports future filter additions

## Open Questions

None - design approved.
