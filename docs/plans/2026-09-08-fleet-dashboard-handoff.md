# Handoff: Production `/fleet` Base Table & Dashboard (Codex Session)

**Date**: 2026-09-08  
**Worktree**: `/Users/froeht/.gemini/antigravity/worktrees/PinPoint/prototype_machine_status_page`  
**Branch**: `feat/fleet-dashboard-base-table` (tracking `origin/feat/fleet-dashboard-base-table`)  
**Bead**: `PP-izsx` (Epic: `[Wayfinder Map] Full Machine / PinballMap Status Page Prototype`) / `PP-izsx.1` (`/fleet base table with sticky header & pinned machine column`) & `PP-o355.7.1`  
**Authoritative Spec**: [`docs/feature-specs/fleet.md`](file:///Users/froeht/.gemini/antigravity/worktrees/PinPoint/prototype_machine_status_page/docs/feature-specs/fleet.md) (Status: **approved**, merged in PR #2066)

---

## 1. Executive Summary & Context

We prototyped and validated the `/fleet` dashboard with Tim under prototype mode, refined the design, updated the feature spec (`docs/feature-specs/fleet.md`), had the spec reviewed and approved, merged the spec to `main` (PR #2066), and locked all decisions in Bead `PP-izsx`.

Per Tim's directive (_"I want to get what we have actually implemented in the code, I don't want to build too many things at once"_), the scope is **bounded to the base table, KPI summary strip, and URL filter controls**.

- **In Scope**: Base table with sticky headers, sticky 2-line machine column, 6 connected KPI cards, unified search & multi-select filters, View Options (column toggles + page size), and `member+` access control.
- **Out of Scope (Deferred to future beads)**: Side inspection drawer (`PP-izsx.4`), edition near-miss tags (`PP-izsx.2`).

---

## 2. Locked Decisions (Do Not Re-litigate)

1. **Route & Access**: `/fleet` requires `member+` access (members, technicians, admins). Unauthenticated visitors redirect to `/login?redirectTo=/fleet`; guests receive `<Forbidden role={role} backUrl="/m" />`.
2. **No Eras**: Dropped from spec, filters, and table per Tim's explicit decision.
3. **Machine Identity Column**: Strictly two lines (`CORE-RESP-001` compliant):
   - Line 1: Machine title + uppercase initials badge.
   - Line 2: `[Manufacturer] · [Year] · [Owner]` (or `[Manufacturer] · [Year]` if unassigned).
   - Presence and Playability badges are **not** in this column; they live in their own dedicated columns.
4. **Last Serviced Metric**:
   - Scope: strictly maintenance-tagged timeline events and service touches (`tag in ['maintenance', 'adjustment', 'parts', 'upgrade', 'cleaning', 'inspection']` and `deletedAt is null`).
   - Empty state: displays `"Never"` when no service event exists.
5. **Canonical PBM KPIs**:
   - **In Sync with PBM**: Percentage of machines with listing intent On whose observed lineup presence matches intent without availability contradiction (canonical states `on`, `shared`, and `flag` over `total_intent_on`). Inactive integration (`not_configured` or `waiting`) or zero denominator displays `"—"`.
   - **Discrepancies**: Unique machines requiring operator action: playability `needs_service` or `unplayable`, lineup `outOfSync` (states `missing` and `lingering`), or availability contradiction (state `alert`).
6. **Filters & URL State**:
   - Unified search input across title, initials, manufacturer, and model name.
   - Multi-select dropdowns for Presence, Playability, Pinball Map sync state, and Owner.
   - Active filter tray with dismissible pill chips and a "Clear all" button.
   - URL parameter synchronization via soft client navigation (`q`, `presence`, `status`, `pbm`, `owner`, `sort`, `dir`, `page`, `pageSize`).

---

## 3. Reference Prototype Artifacts

A complete working prototype was previously tested and verified. Its JSX markup, CSS classes, and mock patterns are preserved for reference at:

- **`tmp/prototype-backup/machine-status-page/page.tsx`** (Full table layout, sticky CSS, KPI cards, filter controls, View Options)
- **`tmp/prototype-backup/machine-status-page/fleet-data.ts`** (Field mappings and mock types)

_(Note: `tmp/` is gitignored so it will not interfere with commits or `prototype-clean-guard.sh`.)_

---

## 4. Implementation Blueprint

### 4.1 Permissions Matrix

Edit [`src/lib/permissions/matrix.ts`](file:///Users/froeht/.gemini/antigravity/worktrees/PinPoint/prototype_machine_status_page/src/lib/permissions/matrix.ts):
Add `machines.fleet.view` under the `machines` category:

```ts
{
  id: "machines.fleet.view",
  label: "View fleet status dashboard",
  description: "View the fleet-wide status and Pinball Map synchronization dashboard at /fleet",
  access: {
    unauthenticated: false,
    guest: false,
    member: true,
    technician: true,
    admin: true,
  },
}
```

### 4.2 Data Layer & Server Query

Create [`src/lib/fleet/types.ts`](file:///Users/froeht/.gemini/antigravity/worktrees/PinPoint/prototype_machine_status_page/src/lib/fleet/types.ts) and [`src/lib/fleet/queries.ts`](file:///Users/froeht/.gemini/antigravity/worktrees/PinPoint/prototype_machine_status_page/src/lib/fleet/queries.ts):

- Implement `getFleetData()`:
  1. Fetch all machines with relations: `issues` (`status`, `severity`, `createdAt`), `owner` (`id`, `name`), `invitedOwner` (`id`, `name`).
  2. Read stored Pinball Map singleton state via `getPinballMapState()` from `~/lib/pinballmap/state`.
  3. Query latest service date per machine:
     ```ts
     const serviceEvents = await db
       .select({
         machineId: timelineEvents.machineId,
         lastServicedAt: sql<Date>`max(${timelineEvents.createdAt})`,
       })
       .from(timelineEvents)
       .where(
         and(
           inArray(timelineEvents.tag, [
             "maintenance",
             "adjustment",
             "parts",
             "upgrade",
             "cleaning",
             "inspection",
           ]),
           isNull(timelineEvents.deletedAt)
         )
       )
       .groupBy(timelineEvents.machineId);
     ```
  4. Build `sameTitle` siblings map for same `pinballmapMachineId` machines so `derivePbmListingView` gets accurate coverage.
  5. Derive `PbmListingView` for each machine using `derivePbmListingView` (`~/lib/pinballmap/listing-state`).
  6. Derive playability status using `deriveMachineStatus` (`~/lib/machines/status`).
  7. Compute summary KPI metrics per §1 & §2.4:
     - `total`: machines.length
     - `onFloorCount`: machines with presence `on_the_floor`
     - `operationalOnFloorCount`: machines with presence `on_the_floor` and playability `operational`
     - `openIssuesTotal`: count of open issues across all machines
     - `machinesWithIssuesCount`: count of machines with at least one open issue
     - `inSyncListingCount`: machines where `intent === 'on'` and canonical state is `on`, `shared`, or `flag`
     - `totalIntentOnCount`: machines where `intent === 'on'`
     - `discrepancyCount`: unique machines where playability is `needs_service` or `unplayable`, OR PBM `outOfSync` is true (`missing`, `lingering`), OR PBM state is `alert`
     - `pbmConfigured`: `pbmState?.locationId != null`
     - `pbmWaiting`: snapshot is missing while configured

### 4.3 Production Components (`src/components/fleet/`)

1. **`FleetKpiCards.tsx`**:
   - 6 cards in a connected responsive strip (`grid-cols-2 md:grid-cols-3 lg:grid-cols-6`).
   - Cards: Total Machines, On Floor, Operational, Open Issues, In Sync with PBM, Discrepancies.
   - Format: Big number, label, and secondary percentage/subtext badge.
   - Empty/Inactive: Display `"—"` if denominator is 0 or if PBM integration is inactive.
2. **`FleetToolbar.tsx`**:
   - Unified text search input (`SearchX` clear button).
   - Multi-select dropdowns for Presence, Playability, Pinball Map Status, Owner (using Radix Popover/Command or existing MultiSelect pattern).
   - Active filter chips tray with dismissible badge pills and "Clear all" button.
   - View Options popover: checkboxes to toggle optional columns (`Owner`, `Manufacturer`, `Year`, `PBM Intent`) and page size selector (`25`, `50`, `100`).
3. **`FleetTable.tsx`**:
   - Container: `overflow-x-auto relative rounded-lg border border-border bg-card`.
   - Sticky header: `sticky top-0 z-20 bg-muted/95 backdrop-blur shadow-sm`.
   - Pinned Machine Identity column: `sticky left-0 z-10 bg-card` (and `z-30` at header intersection) with right border or inset shadow.
   - Line 1: Machine title link to `/m/${initials}` + uppercase initials badge.
   - Line 2: `[Manufacturer] · [Year] · [Owner]`.
   - Status badges:
     - `Presence`: `<MachinePresenceBadge status={row.presenceStatus} />`
     - `Playability`: `<MachineStatusBadge status={row.playabilityStatus} />`
     - `Open Issues`: Badge with open issue count; styled by highest severity (`unplayable` > `needs_service` > `operational`).
     - `Last Serviced`: Formatted relative time (`2d ago`, `3w ago`, `2mo ago`) or `"Never"`.
     - `Pinball Map Status`: Semantic diagnostic badge based on `pbmState.name` (`on`, `shared`, `flag`, `off`, `covered`, `missing`, `lingering`, `alert`, `sync_off`, `no_model`, `uncataloged`).
   - Sorting: Column headers clickable, updating `sort` and `dir` URL parameters, with `aria-sort`.
4. **`FleetDashboard.tsx`**:
   - Client Component wrapping KPI cards, toolbar, table, and pagination.
   - Manages client-side filtering, sorting, and pagination.
   - Syncs URL parameters (`q`, `presence`, `status`, `pbm`, `owner`, `sort`, `dir`, `page`, `pageSize`) via `next/navigation` without full page reloads.

### 4.4 Page Route (`src/app/(app)/fleet/page.tsx`)

- Server Component:
  ```tsx
  export default async function FleetPage() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login?redirectTo=/fleet");
    }
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
    const accessLevel = getAccessLevel(profile?.role);
    if (!checkPermission("machines.fleet.view", accessLevel)) {
      return <Forbidden role={profile?.role ?? null} backUrl="/m" />;
    }
    const fleetData = await getFleetData();
    const users = await getUnifiedUsers();
    return (
      <PageContainer size="wide">
        <PageHeader
          title="Machine & PinballMap Status"
          description="Fleet-wide audit of operational playability and Pinball Map synchronization."
        />
        <FleetDashboard initialData={fleetData} users={users} />
      </PageContainer>
    );
  }
  ```

### 4.5 Navigation Item

In [`src/components/layout/user-menu-client.tsx`](file:///Users/froeht/.gemini/antigravity/worktrees/PinPoint/prototype_machine_status_page/src/components/layout/user-menu-client.tsx):

- Add "Fleet Status" link to the UserMenu dropdown for users with `machines.fleet.view`.

---

## 5. Verification Checklist

1. `pnpm run check`: Must pass static gate (~9s) with zero errors.
2. `pnpm run test src/lib/fleet/`: Unit tests for KPI calculations and Last Serviced queries.
3. `pnpm run test src/components/fleet/`: Unit tests for table rendering and filter mechanics.
4. Early UI Review (PP-4c4b): Preview the rendered `/fleet` page on local dev server (port 3340 in slot 34) and capture screenshots across viewports for Tim before opening the PR.
5. Beads: After PR merges, close `PP-izsx.1` and `PP-o355.7.1` (keep `PP-izsx` epic open for remaining child tasks).
