# Mobile Issue Detail Layout

## Context

The issue detail page needs a mobile-first layout. A previous attempt on branch `design/mobile-issue-detail` mixed in unrelated concerns (PageShell removal, permissions refactor) and left the mobile-specific code with 8 TypeScript errors, inconsistent form APIs, and a Dialog-posing-as-drawer. This plan starts fresh from `origin/main`, which already has the granular permissions matrix (PR #1077).

## Design Decisions (confirmed with user)

- **No back link** on mobile. Desktop keeps it.
- **ID pill + Game name** prominent, on the same row.
- **Title** smaller on mobile (`text-xl`), heavier weight.
- **Assignee row** directly under title (tap-to-modify).
- **Four badge grid** under assignee (Status, Priority, Severity, Frequency). Badges fill the space. Tap opens bottom **Drawer** (not dropdown, not Dialog).
- **No collapsible details panel**. Metadata lives inline.
- **No "Activity" header**.
- **No separate Images panel**. Images only appear inline in timeline entries.
- **No timeline markers/line on mobile**. Horizontal space is precious.
- **Comment input full-width** on mobile.
- **Reporter + Created** shown prominently in the first timeline entry (e.g., "Tim reported . 2 days ago"), not duplicated elsewhere on mobile.
- **Field display order**: Status, Priority, Severity, Frequency (document as standard).
- **Owner requirements callout** above fold on mobile, in timeline on desktop.

## Branch Setup

```bash
git fetch origin main
git checkout -b design/mobile-issue-detail-v2 origin/main
```

## Implementation Steps

### Step 1: Install shadcn Drawer component

```bash
pnpm exec shadcn@latest add drawer
```

This installs `vaul` and creates `src/components/ui/drawer.tsx`.

### Step 2: Create `MetadataDrawer<T>` component

**New file**: `src/components/issues/fields/MetadataDrawer.tsx`

A generic bottom-drawer for selecting issue metadata on mobile.

```
MetadataDrawer<T extends string>
  title: string
  options: { value: T; label: string; description?: string; icon?: ElementType; iconColor?: string }[]
  currentValue: T
  onSelect: (value: T) => void
  trigger: React.ReactNode
  disabled?: boolean
```

Uses `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerClose` from `~/components/ui/drawer`. Visual structure:

- Drag handle bar at top
- "Select {title}" header (small, uppercase, muted)
- Option list with icon circles, labels, optional descriptions, checkmark on selected
- Cancel button at bottom

### Step 3: Add `compact` prop to all four update forms

**Files** (all in `src/app/(app)/m/[initials]/i/[issueNumber]/`):

- `update-issue-status-form.tsx`
- `update-issue-priority-form.tsx`
- `update-issue-severity-form.tsx`
- `update-issue-frequency-form.tsx`

For each form:

1. Add `compact?: boolean` to the props interface
2. When `compact` is true, render `<MetadataDrawer>` with an `<IssueBadge>` as trigger
3. When `compact` is false (default), render the original `*Select` component
4. No CSS dual-render pattern. One or the other, decided by prop.

Config data for MetadataDrawer options:

- Status: `STATUS_CONFIG` + `STATUS_GROUPS` from `~/lib/issues/status`
- Priority: `PRIORITY_CONFIG` — values: low, medium, high, critical
- Severity: `SEVERITY_CONFIG` — values: cosmetic, minor, major, unplayable
- Frequency: `FREQUENCY_CONFIG` — values: constant, frequent, intermittent, rare

### Step 4: Add `iconOnly` and `className` props to WatchButton

**File**: `src/components/issues/WatchButton.tsx`

- Add `iconOnly?: boolean` — renders as compact icon button (no label text)
- Add `className?: string` — pass-through styling
- Use `size={iconOnly ? "icon-sm" : "sm"}` on the Button
- Add `aria-label` for accessibility when iconOnly

### Step 5: Add `className` prop to EditableIssueTitle

**File**: `src/app/(app)/m/[initials]/i/[issueNumber]/editable-issue-title.tsx`

- Add `className?: string` to props
- Apply via `cn()` to all three render paths (read-only, editing, editable)
- Allows page.tsx to pass `text-xl font-extrabold tracking-tight md:text-3xl`

### Step 6: Extend SidebarActions for mobile layouts

**File**: `src/components/issues/SidebarActions.tsx`

New props:

- `compact?: boolean` — tighter spacing, passes `compact` to forms
- `only?: "assignee" | "status" | "severity" | "priority" | "frequency"` — render single section
- `exclude?: "assignee" | "status" | "severity" | "priority" | "frequency"` — skip a section
- `rowLayout?: boolean` — horizontal 2-column grid instead of vertical rows

Label styling conditional on `compact`:

- `compact` = `text-[10px] uppercase tracking-wider text-muted-foreground font-bold`
- default = `text-sm text-muted-foreground` (original desktop style, unchanged)

Section render order: Assignee, Status, Priority, Severity, Frequency.

### Step 7: Make IssueTimeline responsive

**File**: `src/components/issues/IssueTimeline.tsx`

Changes:

- Left marker column: `hidden md:flex` (hide avatars + dots on mobile)
- Vertical timeline line: `hidden md:block`
- Spacing: `space-y-4 md:space-y-6`
- Content area: add `min-w-0` for text truncation
- Owner requirements callout in timeline: `hidden md:block md:ml-20`
- Comment form: move outside timeline div for full-width on mobile, hide avatar column on mobile
- Comment form padding: `p-4 sm:p-6`
- Empty state: `md:ml-20` (only indent on desktop)
- First timeline entry (issue report): ensure reporter name and relative timestamp are clearly visible — this is where mobile users see "who reported" and "when"

### Step 8: Make AddCommentForm responsive

**File**: `src/components/issues/AddCommentForm.tsx`

- Button + image upload: stack vertically on mobile, horizontal on desktop
- Change to `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`
- Image upload container: `min-w-0 sm:max-w-[200px]`

### Step 9: Rewrite page.tsx mobile layout

**File**: `src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx`

Structure (mobile):

```
<div max-w-7xl mx-auto>
  <div py-4 sm:py-10 space-y-4 sm:space-y-8>

    <!-- MOBILE: ID pill + Game name (md:hidden) -->
    <div flex items-center gap-2>
      <span pill>{issueId}</span>
      <Link to machine>{machine.name}</Link>
    </div>

    <!-- DESKTOP: Back link (hidden md:block) -->
    <!-- DESKTOP: ID + machine + owner (hidden md:flex) -->

    <!-- Title (responsive size via className prop) -->
    <EditableIssueTitle className="text-xl font-extrabold md:text-3xl" />

    <!-- MOBILE: Assignee + Watch row (md:hidden) -->
    <div border-y>
      <SidebarActions only="assignee" compact />
      <WatchButton iconOnly /> + watch count
    </div>

    <!-- MOBILE: Badge grid (md:hidden) -->
    <SidebarActions exclude="assignee" compact rowLayout />

    <!-- MOBILE: Owner requirements (md:hidden, if present) -->

    <!-- Two-column grid (desktop) -->
    <div grid md:grid-cols-[1fr_320px]>
      <section>
        <!-- NO "Activity" header -->
        <!-- NO separate Images panel -->
        <IssueTimeline ... />
      </section>
      <div hidden md:block>
        <IssueSidebar ... />
      </div>
    </div>
  </div>
</div>
```

Key removals vs origin/main:

- Remove `PageShell` import and wrapper (use plain div)
- Remove `BackToIssuesLink` import
- Remove `IssueBadgeGrid` from header (replaced by SidebarActions with rowLayout)
- Remove `ImageGallery` section (images only in timeline)
- Remove "Activity" `<h2>` header
- Add `SidebarActions` and `WatchButton` imports
- Add `OwnerRequirementsCallout` import for mobile placement

### Step 10: Fix IssueSidebar grid syntax

**File**: `src/components/issues/IssueSidebar.tsx`

Change `grid-cols-[110px,1fr]` to `grid-cols-[110px_1fr]` (Tailwind v4 syntax).

### Step 11: Update E2E tests

**Files**:

- `e2e/smoke/issue-detail-permissions.spec.ts` — update selectors for new mobile layout
- `e2e/smoke/issues-crud.spec.ts` — update selectors
- `e2e/support/actions.ts` — add helpers for mobile detail interactions

Key changes:

- Back link is now `md:hidden`/`hidden md:block` — tests may need viewport awareness
- Badge grid replaced by SidebarActions with data-testid attributes
- New data-testid attributes: `mobile-nav-row`, `machine-link`, `issue-badge-strip`, `issue-timeline`, `issue-comment-form`

### Step 12: Golden seed data (GDZ-02)

**File**: `supabase/seed-users.mjs`

Create/update a test issue on the Godzilla machine with:

- Short, descriptive title (e.g., "Visual Test: All States Issue")
- Owner requirements on the Godzilla machine
- Image on the initial report
- Timeline sequence: Initial Report (with image) -> System Update -> Comment -> Comment -> System Update -> System Update -> Comment

### Step 13: Document field display order

**File**: `.agent/skills/pinpoint-ui/SKILL.md`

Add under Quick Reference:

```
### Issue Field Display Order
The canonical display order for issue metadata fields is:
1. Status
2. Priority
3. Severity
4. Frequency

When assignee is present (edit contexts), it comes first.
```

## Files Modified (summary)

| #   | File                                              | Action                                           |
| --- | ------------------------------------------------- | ------------------------------------------------ |
| 1   | `src/components/ui/drawer.tsx`                    | NEW (shadcn install)                             |
| 2   | `src/components/issues/fields/MetadataDrawer.tsx` | NEW                                              |
| 3   | `update-issue-status-form.tsx`                    | Edit: add `compact` prop                         |
| 4   | `update-issue-priority-form.tsx`                  | Edit: add `compact` prop                         |
| 5   | `update-issue-severity-form.tsx`                  | Edit: add `compact` prop                         |
| 6   | `update-issue-frequency-form.tsx`                 | Edit: add `compact` prop                         |
| 7   | `WatchButton.tsx`                                 | Edit: add `iconOnly`, `className`                |
| 8   | `editable-issue-title.tsx`                        | Edit: add `className`                            |
| 9   | `SidebarActions.tsx`                              | Edit: add `compact`/`only`/`exclude`/`rowLayout` |
| 10  | `IssueTimeline.tsx`                               | Edit: responsive hiding, spacing, comment form   |
| 11  | `AddCommentForm.tsx`                              | Edit: responsive stacking                        |
| 12  | `page.tsx` (issue detail)                         | Edit: full mobile layout rewrite                 |
| 13  | `IssueSidebar.tsx`                                | Edit: grid syntax fix                            |
| 14  | `supabase/seed-users.mjs`                         | Edit: golden seed data                           |
| 15  | `.agent/skills/pinpoint-ui/SKILL.md`              | Edit: document field order                       |
| 16  | E2E test files (3-4 files)                        | Edit: updated selectors                          |

## Verification

1. `pnpm tsc --noEmit` — 0 errors
2. `pnpm run preflight` — passes (types, lint, format, unit tests, build, integration)
3. Manual mobile check (390x844 viewport):
   - ID pill + game name visible, no back link
   - Title smaller than desktop
   - Assignee row with watch count and icon-only watch button
   - Four badges fill width, tapping opens bottom Drawer with swipe-to-dismiss
   - No "Activity" header, no Images panel
   - Timeline has no left markers/line
   - Comment input spans full width
   - First timeline entry shows reporter name + relative time prominently
4. Manual desktop check (1280+ viewport):
   - Back link visible
   - Original sidebar layout unchanged (labels are `text-sm`, not uppercase)
   - Timeline has left markers and vertical line
5. E2E smoke tests pass
