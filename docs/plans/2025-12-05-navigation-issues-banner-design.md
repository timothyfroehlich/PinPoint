# Navigation, Issues List & Pre-Beta Banner Design

**Date**: December 5, 2025
**Status**: Approved
**Related Issues**: #562, #558, #579

## Overview

This design addresses navigation cleanup, issues list page creation, sidebar improvements, and pre-beta warning banner implementation to prepare PinPoint for public preview.

## Goals

1. Fix broken navigation links in top Navigation component
2. Create unified `/issues` list page with filtering (hybrid approach)
3. Clean up redundant navigation elements between Sidebar and UserMenu
4. Make Sidebar collapsible to icon-only mode
5. Add pre-beta warning banner to all pages

## Route Structure

### New Routes

- `/issues` - All issues list with optional query params for filtering
- `/m/[initials]/issues` - Redirects to `/issues?machine=[initials]`

### Updated Routes

- `/report` - Remains public/authenticated issue creation form
- `/m` - Machines list (fix any `/machines` references)
- `/m/[initials]` - Machine detail page
- `/m/[initials]/report` - Machine-specific issue creation
- `/m/[initials]/i/[issueNumber]` - Issue detail

### Removed Routes

- `/issues/new` - Skipped, use `/report` instead
- `/machines` - Use `/m` instead

## Component Changes

### 1. Sidebar (`src/components/layout/Sidebar.tsx`)

**Navigation Items** (in order):

1. Dashboard (LayoutDashboard icon) → `/dashboard`
2. Issues (AlertTriangle icon) → `/issues`
3. Machines (Gamepad2 icon) → `/m`
4. **Report Issue** (Wrench icon, button style) → `/report`
5. Admin (Settings icon, admin-only) → `/admin/users`

**Removed Items**:

- Settings link (bottom) - redundant with UserMenu
- Sign Out button (bottom) - redundant with UserMenu

**Collapsible Feature**:

**Expanded State** (default, ~256px):

- Full APC logo
- Icon + text labels for all items
- Toggle button at bottom with ChevronLeft icon

**Collapsed State** (~64px):

- Custom PinPoint logo icon (to be created by user)
- Icons only with tooltips on hover
- Toggle button shows ChevronRight icon

**State Management**:

- Client Component for toggle functionality
- Store state in localStorage: `sidebar-collapsed: true/false`
- Smooth Tailwind transitions for width change
- Sidebar remains full height (`h-screen`)

### 2. Top Navigation (`src/components/layout/navigation.tsx`)

**Authenticated State Changes**:

- **Remove** quick links section entirely (Issues, Report, Machines buttons)
- Keep only: Logo + UserMenu
- Logo links to `/dashboard`

**Unauthenticated State**:

- No changes (keep Logo, "Report Issue", Sign In, Sign Up)

### 3. DashboardLayout Header (`src/components/layout/DashboardLayout.tsx`)

**Changes**:

- **Remove** `<h1>Dashboard</h1>` static text
- Keep only: NotificationList + UserMenu
- Cleaner header, more space for dynamic content

### 4. UserMenu (`src/components/layout/user-menu-client.tsx`)

**No Changes**:

- Keep existing items: Profile (disabled), Settings, Sign Out
- This is now the only place for Settings/Sign Out (removed from Sidebar)

## New Page: /issues

**File**: `src/app/(app)/issues/page.tsx`

**Layout Structure**:

```
┌──────────────────────────────────────────────────────────┐
│ Header                                                   │
│   Title: "Issues" or "Issues for [Machine Name]"        │
│   Filters: [Status ▼] [Severity ▼] [Priority ▼] [Machine ▼] │
│   [Clear Filters] (when active)                         │
├──────────────────────────────────────────────────────────┤
│ GitHub-Style Issue Rows                                  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ [Status] [Severity] [Priority]                     │  │
│ │ MM-123: Issue Title                                │  │
│ │ Machine Name • Created by User • 2 days ago        │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ [Status] [Severity] [Priority]                     │  │
│ │ MM-124: Another Issue                              │  │
│ │ Machine Name • Created by User • 1 day ago         │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Empty State: "No issues found" + link to /report        │
└──────────────────────────────────────────────────────────┘
```

**Filters**:

- Status dropdown: new, in_progress, resolved
- Severity dropdown: minor, playable, unplayable
- Priority dropdown: low, medium, high
- Machine dropdown: All machines from database
- Clear Filters button (visible when filters active)

**Query Parameters**:

```
?machine=MM
&status=open
&severity=unplayable
&priority=high
```

**Data Fetching**:

```typescript
// Server Component reads searchParams
const { machine, status, severity, priority } = searchParams;

const issuesQuery = await db.query.issues.findMany({
  where: and(
    machine ? eq(issues.machineInitials, machine) : undefined,
    status ? eq(issues.status, status) : undefined,
    severity ? eq(issues.severity, severity) : undefined,
    priority ? eq(issues.priority, priority) : undefined
  ),
  orderBy: desc(issues.createdAt),
  with: {
    machine: { columns: { id: true, name: true, initials: true } },
    reportedByUser: { columns: { name: true } },
  },
});
```

**Progressive Enhancement**:

- Filter controls as form with method="GET"
- Works without JavaScript (form submission updates URL)
- Client Component enhances with onChange handlers for better UX

**Issue Row Click**:

- Navigate to `/m/[machineInitials]/i/[issueNumber]`
- Hover state: background highlight

## Pre-Beta Warning Banner

**File**: `src/components/layout/PreBetaBanner.tsx`

**Placement**:

- Root layout (`src/app/layout.tsx`)
- Appears on ALL pages (public + authenticated)
- Position: Top of page, above all other content
- Always visible (no dismiss)
- Sticky or fixed positioning

**Content**:

```
ℹ️  Pre-Beta Notice: PinPoint is in active development.
    Data may be reset at any time. Do not rely on this for production tracking.
```

**Visual Design**:

- Background: `bg-blue-50 dark:bg-blue-900`
- Border: `border-b border-blue-200 dark:border-blue-700`
- Text: `text-blue-800 dark:text-blue-200`
- Icon: Lucide `Info` icon
- Height: ~40-48px (compact)
- Padding: `px-4 py-2`
- Responsive: Text wraps on mobile if needed

**Implementation**:

- Server Component (no interactivity)
- Reusable component imported in root layout

**Example Visual**:

```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  Pre-Beta Notice: Data may be reset at any time...  │
└─────────────────────────────────────────────────────────┘
```

## Testing Updates

**E2E Tests** (`e2e/smoke/navigation.spec.ts`):

**Update existing authenticated test**:

- Verify Sidebar has: Dashboard, Issues, Machines, Report Issue, Admin (admin-only)
- Verify Sidebar does NOT have Settings or Sign Out
- Verify UserMenu has Settings and Sign Out
- Verify top Navigation does NOT have quick links when authenticated

**Add new test** for `/issues` page:

- Navigate to `/issues`
- Verify page loads with filter controls
- Verify issues display in GitHub-style rows
- Click issue row → verify navigation to issue detail page
- Apply filters → verify URL updates with query params

**Add new test** for pre-beta banner:

- Verify banner appears on landing page
- Verify banner appears on authenticated pages
- Verify banner text matches design

**Add new test** for collapsible sidebar:

- Click collapse toggle
- Verify sidebar width changes
- Verify icons remain visible
- Verify text labels hidden
- Verify localStorage updated
- Click expand toggle
- Verify sidebar restores full width

## Technical Decisions

**Why remove quick links from top Navigation?**

- Sidebar already provides navigation for authenticated users
- Reduces visual clutter in header
- UserMenu provides user-specific actions
- Cleaner separation of concerns

**Why GitHub-style rows instead of cards?**

- Higher information density
- Familiar pattern for issue tracking
- Better for scanning many issues
- Easier to implement filters

**Why no dismiss on pre-beta banner?**

- Critical warning that should always be visible
- Users need constant reminder during preview period
- Prevents accidental data loss expectations

**Why collapse to icons only?**

- Maximizes content space for users who want it
- Common pattern in modern applications
- Icons already present, minimal additional work
- localStorage persistence provides good UX

## Future Enhancements (Out of Scope)

- Advanced sorting on /issues page
- Search functionality for issues
- Bulk actions on issues
- Pagination for large issue lists
- Custom PinPoint logo for collapsed sidebar
- Issue #579: Update notification menu wording and formatting

## Success Criteria

- [ ] All navigation links point to existing routes
- [ ] No console errors on navigation
- [ ] `/issues` page loads with filters working
- [ ] Filters persist via query parameters
- [ ] Sidebar collapses/expands smoothly
- [ ] Sidebar state persists in localStorage
- [ ] Settings and Sign Out only in UserMenu (not Sidebar)
- [ ] Pre-beta banner visible on all pages
- [ ] All smoke tests pass
