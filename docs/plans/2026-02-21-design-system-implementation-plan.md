# Design System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement code-first design system, desktop consistency improvements, mobile views, and E2E tests — all through incremental, reviewable PRs.

**Architecture:** Code-first pattern discovery (components are the spec). Phase-gated orchestration with parallel agents per phase. Each PR is either a component PR (reviewable in isolation) or a page PR (composes reviewed components).

**Tech Stack:** Next.js, shadcn/ui, Tailwind CSS v4, Radix UI, Playwright, Vitest

---

## PR Strategy

```
Component PRs (review components in isolation):
  PR 1: pinpoint-ui skill update + stale doc cleanup
  PR 2: JSDoc on key domain components + CSS token audit
  PR 3: Desktop - "Me" quick-select in AssigneePicker
  PR 4: Desktop - "My machines" filter in MachineFilters
  PR 5: Desktop - Status group label "New" → "Open"
  PR 6: Mobile - Shared mobile layout/nav components
  PR 7: Mobile - Mobile filter bar component

Page PRs (compose reviewed components):
  PR 8: Mobile - Issues list page
  PR 9: Mobile - Issue detail page
  PR 10: Mobile - Report form page
  PR 11: Mobile - Machines list page

Test PRs:
  PR 12: E2E - Desktop new features
  PR 13: E2E - Mobile test strategy + mobile E2E suite

Side:
  PR 14: Documentation consolidation (independent, whenever)
```

**Review gates:** PRs 1-2 merge before 3-5 start. PRs 3-5 merge before 6-7. PRs 6-7 merge before 8-11. PRs 8-11 merge before 12-13.

**How to review components before building pages:** Component PRs include unit tests that exercise the component in isolation. For visual review, the PR description includes screenshots or a test route (e.g., `/dev/components` behind `NODE_ENV=development`). Page PRs then import the already-reviewed components.

---

## Phase 1: Component Prep (PRs 1-2)

### Task 1.1: Update pinpoint-ui Skill (PR 1)

**Files:**
- Modify: `.agent/skills/pinpoint-ui/SKILL.md`
- Delete: `docs/ui-patterns/styling-principles.md`
- Delete: `docs/ui-patterns/components.md`
- Delete: `docs/ui-patterns/typography.md`
- Delete: `docs/ui-patterns/multi-select.md`

**Step 1: Read the current pinpoint-ui skill**

```bash
cat .agent/skills/pinpoint-ui/SKILL.md
```

Understand the current structure. The skill currently points agents to `docs/UI_GUIDE.md` and `docs/ui-patterns/*.md`.

**Step 2: Replace the "Detailed Documentation" section with a Key Files registry**

Remove the section that says "Read these files for comprehensive UI guidance" and replace it with a structured registry of canonical source files. The new section should list:

| Pattern | Canonical File | What to Learn |
|:--------|:---------------|:--------------|
| Status system | `src/lib/issues/status.ts` | STATUS_CONFIG, STATUS_GROUPS, OPEN_STATUSES, getter functions, color/icon system |
| Issue filters | `src/components/issues/IssueFilters.tsx` | Smart badge grouping, filter composition, inline badge pattern, debounced search |
| Status selection | `src/components/issues/fields/StatusSelect.tsx` | Grouped select with icons, tooltip descriptions, separator pattern |
| Assignee picker | `src/components/issues/AssigneePicker.tsx` | Listbox pattern, search filtering, "Unassigned" special value, accessibility |
| Machine filters | `src/components/machines/MachineFilters.tsx` | Inline filter bar, MultiSelect composition, sort dropdown, user label formatting |
| Multi-select | `src/components/ui/multi-select.tsx` | Grouped/flat modes, selected-items-first sorting, indeterminate group headers |
| Owner select | `src/components/machines/OwnerSelect.tsx` | User display format (name + count + invited status) |
| CSS tokens | `src/app/globals.css` | Material Design 3 color system, custom breakpoints, glow utilities |

Also add a "Color System" subsection documenting the status color groups:
- New group: cool colors (cyan-500, teal-500)
- In Progress group: vibrant colors (fuchsia-500, purple-600, pink-500, purple-500)
- Closed group: muted colors (green-500, zinc-500, slate-500, neutral-600)

**Step 3: Delete stale docs**

```bash
rm docs/ui-patterns/styling-principles.md
rm docs/ui-patterns/components.md
rm docs/ui-patterns/typography.md
rm docs/ui-patterns/multi-select.md
```

Verify no other files reference these paths:

```bash
rg "docs/ui-patterns" --type md
```

Update any references found (likely in `SKILL.md` itself and possibly `docs/UI_GUIDE.md`).

**Step 4: Run preflight**

```bash
pnpm run check
```

**Step 5: Commit and create PR**

```bash
git checkout -b feat/design-system-skill-update
git add -A
git commit -m "feat(ui): update pinpoint-ui skill with code-first key files registry

Replace stale docs/ui-patterns/ with direct pointers to canonical
source files. Agents now discover patterns by reading components."
git push -u origin feat/design-system-skill-update
gh pr create --title "Update pinpoint-ui skill with key files registry" --body "..."
```

---

### Task 1.2: JSDoc Key Components + CSS Token Audit (PR 2)

**Files:**
- Modify: `src/components/issues/IssueFilters.tsx`
- Modify: `src/components/issues/fields/StatusSelect.tsx`
- Modify: `src/components/issues/AssigneePicker.tsx`
- Modify: `src/components/machines/MachineFilters.tsx`
- Modify: `src/components/ui/multi-select.tsx`
- Modify: `src/components/machines/OwnerSelect.tsx`

**Step 1: Add JSDoc to IssueFilters.tsx**

Add a component-level JSDoc block before the `IssueFilters` function. It should describe:
- Purpose: Main filter bar for issues list, combining search + multi-select dropdowns
- Key pattern: Smart badge grouping — status badges collapse to group names ("Open", "In Progress") when all statuses in a group are selected
- Composition: Uses `MultiSelect` for all dropdown filters, `DateRangePicker` for date ranges
- State: Managed via `useSearchFilters` hook, synced to URL params

Do NOT add JSDoc to every internal function — just the exported component and any non-obvious helper (like the badge generation logic).

**Step 2: Add JSDoc to the remaining 5 components**

Same pattern — one component-level JSDoc block per file describing:
- What the component does
- What pattern it demonstrates
- Key props and their purpose

For `multi-select.tsx`, document the dual mode (flat vs grouped) and the selected-items-first sorting behavior.

For `AssigneePicker.tsx`, document the "Unassigned" special value pattern and the listbox accessibility approach.

For `MachineFilters.tsx`, document the inline badge pattern and user label formatting.

For `StatusSelect.tsx`, document the three-group separator pattern and tooltip descriptions.

For `OwnerSelect.tsx`, document the user display format: "Name (count) (Invited)".

**Step 3: Audit CSS tokens**

Read `src/app/globals.css` and `src/lib/issues/status.ts`. Verify that STATUS_CONFIG colors use Tailwind token names (e.g., `cyan-500`) rather than hardcoded hex values. If any hex values are found in STATUS_CONFIG, replace them with Tailwind references.

Check that `globals.css` `@theme` block includes all colors used by STATUS_CONFIG. Note: STATUS_CONFIG uses Tailwind utility classes (like `bg-cyan-500/20 text-cyan-400`), not CSS variables — this is correct for Tailwind v4. Just verify consistency.

**Step 4: Run preflight and commit**

```bash
pnpm run check
git checkout -b feat/component-jsdoc-tokens
git add -A
git commit -m "docs(components): add JSDoc to key domain components + verify CSS tokens"
git push -u origin feat/component-jsdoc-tokens
gh pr create --title "Add JSDoc to key domain components" --body "..."
```

---

## Phase 2: Desktop Improvements (PRs 3-5)

**Prerequisite:** PRs 1-2 merged.

### Task 2.1: "Me" Quick-Select in AssigneePicker (PR 3)

**Files:**
- Modify: `src/components/issues/AssigneePicker.tsx`
- Modify: `src/components/issues/AssigneePicker.test.tsx`
- Modify: `src/components/issues/IssueFilters.tsx` (pass current user)

**Step 1: Write failing tests**

Add tests to `AssigneePicker.test.tsx`:

```typescript
describe("quick-select", () => {
  it('shows "Me" as first option when currentUserId provided', () => {
    // Render with currentUserId="user-1", users=[{id: "user-1", name: "Tim"}, ...]
    // Open picker
    // Assert first option text is "Me"
    // Assert second option text is "Unassigned"
    // Assert divider between Unassigned and user list
  });

  it("does not show Me when currentUserId is null", () => {
    // Render without currentUserId
    // Open picker
    // Assert first option is "Unassigned"
  });

  it("selecting Me calls onAssign with current user ID", () => {
    // Render with currentUserId="user-1"
    // Click "Me" option
    // Assert onAssign called with "user-1"
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/components/issues/AssigneePicker.test.tsx
```

Expected: FAIL — `currentUserId` prop doesn't exist yet.

**Step 3: Add currentUserId prop to AssigneePicker**

Update the interface:

```typescript
interface AssigneePickerProps {
  assignedToId: string | null;
  currentUserId?: string | null;  // NEW
  users: PickerUser[];
  isPending: boolean;
  onAssign: (userId: string | null) => void;
  disabled?: boolean;
  disabledReason?: string | null;
}
```

In the render, before the "Unassigned" option:

```typescript
{currentUserId && (
  <>
    <button
      role="option"
      aria-selected={assignedToId === currentUserId}
      onClick={() => { onAssign(currentUserId); setIsOpen(false); }}
      className="font-medium text-primary ..."
    >
      <User className="mr-2 h-4 w-4" />
      Me
      {assignedToId === currentUserId && <Check className="ml-auto h-4 w-4" />}
    </button>
  </>
)}
```

Add a divider after "Unassigned" (before the user list), to visually separate quick-selects from the full list.

**Step 4: Thread currentUserId through IssueFilters**

`IssueFilters.tsx` renders `AssigneePicker` — it needs to pass the current user ID. Check how the current user is available (likely via a prop from the page or a hook). Add `currentUserId` prop to `IssueFiltersProps` if needed, or get it from the users array if the current user is identifiable.

**Step 5: Run tests and verify pass**

```bash
pnpm vitest run src/components/issues/AssigneePicker.test.tsx
pnpm run check
```

**Step 6: Commit and create PR**

```bash
git checkout -b feat/assignee-me-quick-select
git add -A
git commit -m "feat(filters): add 'Me' quick-select to AssigneePicker

Adds currentUserId prop. When provided, shows 'Me' as first option
above Unassigned with a divider before the full user list."
git push -u origin feat/assignee-me-quick-select
gh pr create --title "Add 'Me' quick-select to AssigneePicker" --body "..."
```

---

### Task 2.2: "My Machines" Quick Filter (PR 4)

**Files:**
- Modify: `src/components/issues/IssueFilters.tsx`
- Modify: `src/components/machines/MachineFilters.tsx`
- Modify or create: Relevant test files

**Step 1: Write failing tests**

Test the "My machines" toggle behavior:

```typescript
describe("my machines quick-select", () => {
  it('shows "My machines" as first option in machine MultiSelect', () => {
    // Render IssueFilters with currentUserId and machines with ownerId
    // Open machine dropdown
    // Assert first item is "My machines" with user icon
  });

  it("toggling My machines selects all machines owned by current user", () => {
    // Render with 6 machines, 2 owned by current user
    // Click "My machines"
    // Assert filter updated with the 2 owned machine initials
  });

  it("toggling My machines off deselects only owned machines", () => {
    // Render with owned machines selected + 1 other
    // Click "My machines" again
    // Assert owned machines deselected, other remains
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/components/issues/IssueFilters.test.tsx
```

**Step 3: Implement "My machines" toggle in IssueFilters**

The machine MultiSelect currently receives flat options. Add a "My machines" action item at the top. This requires extending the machine options list:

```typescript
const userMachineInitials = useMemo(
  () => machines
    .filter((m) => m.ownerId === currentUserId)
    .map((m) => m.value),
  [machines, currentUserId],
);

// Build machine options with "My machines" at top
// This may require adding an "action" option type to MultiSelect
// or using the grouped mode with a special first group
```

Review the `MultiSelect` component to determine the best approach. It supports `groups` with headers — consider adding "My machines" as a clickable group header for user-owned machines, followed by a divider, then all machines.

**Step 4: Apply same pattern to MachineFilters if appropriate**

`MachineFilters.tsx` has an Owner MultiSelect but not a "My machines" toggle on the machine list itself. Determine if this pattern applies there too (it uses a different filter structure — the owner dropdown, not a machine dropdown).

**Step 5: Run tests and preflight**

```bash
pnpm vitest run src/components/issues/IssueFilters.test.tsx
pnpm run check
```

**Step 6: Commit and create PR**

```bash
git checkout -b feat/my-machines-quick-filter
# ... commit and PR
```

---

### Task 2.3: Status Group Label "New" → "Open" (PR 5)

**Files:**
- Modify: `src/lib/issues/status.ts`
- Modify: `src/components/issues/fields/StatusSelect.tsx`
- Modify: `src/components/issues/IssueFilters.tsx`
- Modify: Relevant test files

**Step 1: Write failing test**

```typescript
// In status.test.ts or IssueFilters.test.tsx
it('status group display label should be "Open" not "New"', () => {
  // Assert the group label used in StatusSelect/IssueFilters is "Open"
  // for the STATUS_GROUPS.new group
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/lib/issues/status.test.ts
```

**Step 3: Update the display label**

The key distinction: `STATUS_GROUPS.new` is the **internal key** (keep it — it maps to the database values). The **display label** in `StatusSelect.tsx` and `IssueFilters.tsx` needs to change from "New" to "Open".

In `status.ts`, consider adding a `STATUS_GROUP_LABELS` constant:

```typescript
export const STATUS_GROUP_LABELS: Record<keyof typeof STATUS_GROUPS, string> = {
  new: "Open",           // Display label — users see "Open", not "New"
  in_progress: "In Progress",
  closed: "Closed",
};
```

Then update `StatusSelect.tsx` and `IssueFilters.tsx` to use `STATUS_GROUP_LABELS` instead of hardcoded strings.

Search for any other hardcoded "New" labels that should be "Open":

```bash
rg '"New"' src/components/issues/ --type tsx
```

**Step 4: Run tests and preflight**

```bash
pnpm vitest run
pnpm run check
```

**Step 5: Commit and create PR**

```bash
git checkout -b feat/status-group-open-label
# ... commit and PR
```

---

## Phase 3: Mobile Implementation (PRs 6-11)

**Prerequisite:** PRs 3-5 merged. Desktop components are finalized and can be used as pattern reference.

### Task 3.1: Mobile Layout/Nav Components (PR 6)

**Before starting:** Load the `pinpoint-ui` skill. Read the HTML mockups:
- `docs/inspiration/mobile-redesign/mockup-issues-list.html`
- `docs/inspiration/mobile-redesign/mockup-machines-list.html`

Also read the `.pen` file via `mcp__pencil__batch_get` for the mobile layout structure.

**Files:**
- Create: `src/components/layout/MobileNav.tsx` (or similar — check if mobile nav already exists in `Sidebar.tsx`)
- Create: `src/components/layout/MobilePageShell.tsx` (if needed)
- Test: Unit tests for new components

**Step 1: Audit existing mobile layout**

Check how `MainLayout.tsx` and `Sidebar.tsx` handle mobile currently. The E2E helpers already reference a "mobile menu trigger" — understand what exists.

```bash
rg "mobile" src/components/layout/ --type tsx -l
```

**Step 2: Extract mobile navigation pattern from mockups**

Read the mockup HTML to understand:
- Bottom navigation vs hamburger menu
- Page transitions
- Header structure on mobile

**Step 3: Implement mobile nav component**

Build the component following patterns from the desktop `Sidebar.tsx`. Use the same route structure. Ensure it integrates with the existing `openSidebarIfMobile()` E2E helper.

**Step 4: Write unit tests**

Test: renders correct nav items, active state, responsive behavior.

**Step 5: Commit and create PR with screenshots**

PR description should include mobile screenshots showing the nav component in isolation.

---

### Task 3.2: Mobile Filter Bar Component (PR 7)

**Before starting:** Load `pinpoint-ui` skill. Read `IssueFilters.tsx` (the desktop version) and the mobile mockup filter pattern from `docs/design-consistency/03-patterns.md` (Chip Dropdown section).

**Files:**
- Create: `src/components/mobile/MobileFilterBar.tsx` (or appropriate path)
- Create: `src/components/ui/chip-dropdown.tsx` (if the mobile filter uses chips instead of MultiSelect)
- Test: Unit tests

**Step 1: Decide on chip vs MultiSelect for mobile**

Read the mockup. The mobile filter uses a "chip dropdown" pattern (compact chips that open dropdown on tap). Determine if this is different enough from `MultiSelect` to warrant a new component, or if `MultiSelect` can be styled differently on mobile.

**Step 2: Build the mobile filter component**

It should:
- Use the same `STATUS_GROUPS`, `STATUS_CONFIG` from `status.ts`
- Support the same smart badge grouping logic as desktop `IssueFilters.tsx`
- Implement quick-select toggles (Open/In Progress/Closed) at the top
- Use the assignee quick-select pattern (Me → Unassigned → divider → users)

**Step 3: Write unit tests**

Test: status group toggles, badge label logic, filter state management.

**Step 4: Commit and create PR**

PR includes screenshots of the filter bar in mobile viewport. This is reviewable in isolation before it's integrated into any page.

---

### Tasks 3.3-3.6: Mobile Page PRs (PRs 8-11)

Each mobile page gets its own PR. Each PR:
1. Creates or modifies the page route
2. Composes already-reviewed components (MobileNav, MobileFilterBar, etc.)
3. Includes unit tests for page-specific logic
4. PR description includes mobile screenshots

**PR 8: Mobile Issues List Page**
- Route: The existing issues list page, responsive for mobile
- Composes: MobileFilterBar, MobileNav, issue card components
- Reference: `mockup-issues-list.html`

**PR 9: Mobile Issue Detail Page**
- Route: Existing issue detail page, responsive for mobile
- Composes: StatusSelect, AssigneePicker, timeline components
- Reference: `mockup-issue-detail.html`

**PR 10: Mobile Report Form Page**
- Route: Existing report form, responsive for mobile
- Reference: `mockup-report-form.html`

**PR 11: Mobile Machines List Page**
- Route: Existing machines list, responsive for mobile
- Composes: MachineFilters (mobile variant), MobileNav
- Reference: `mockup-machines-list.html`

Each of these tasks follows the same pattern:
1. Read the mockup HTML for the target page
2. Read the current desktop page implementation
3. Write failing tests for mobile-specific behavior
4. Implement responsive changes (or new mobile routes)
5. Run check, commit, PR with screenshots

---

## Phase 4: E2E Tests (PRs 12-13)

**Prerequisite:** PRs 8-11 merged.

### Task 4.1: Desktop E2E for New Features (PR 12)

**Files:**
- Create: `e2e/desktop-quick-select.spec.ts` (or add to existing filter specs)

**Tests to write:**
- "Me" quick-select in AssigneePicker: click "Me", verify filter applied
- "My machines" toggle: click, verify owned machines selected
- Status group "Open" label: verify visible in status dropdown
- Quick-select ordering: verify Me → Unassigned → divider → alphabetical

**Step 1: Read existing E2E patterns**

```bash
cat e2e/machines-filtering.spec.ts
cat e2e/support/actions.ts
```

Follow the established patterns for login, navigation, and filter interaction.

**Step 2: Write the tests using the existing helpers**

Use `loginAs()`, `openSidebarIfMobile()`, `selectOption()` patterns.

**Step 3: Run against desktop projects**

```bash
pnpm exec playwright test e2e/desktop-quick-select.spec.ts --project="Desktop Chrome"
```

**Step 4: Commit and PR**

---

### Task 4.2: Mobile E2E Strategy + Suite (PR 13)

**Files:**
- Modify: `.agent/skills/pinpoint-e2e/SKILL.md` (add mobile testing strategy)
- Create: `e2e/mobile-issues.spec.ts`
- Create: `e2e/mobile-filters.spec.ts`

**Step 1: Add mobile testing strategy to pinpoint-e2e skill**

Document:
- **What to test on mobile vs desktop:** Mobile tests focus on touch interactions, viewport-specific layouts, mobile navigation, responsive breakpoints. Desktop tests focus on hover states, keyboard navigation, wide-screen layouts.
- **Viewport breakpoints:** Pixel 5 (393x851), iPhone 13 Mini (375x812)
- **Mobile-specific patterns:** `openSidebarIfMobile()`, `scrollIntoViewIfNeeded()`, `force: true` clicks for Radix dropdowns
- **Touch interaction patterns:** Tap (click), swipe (if applicable), long-press (if applicable)

**Step 2: Write mobile E2E tests**

Focus on:
- Mobile filter bar opens/closes correctly
- Chip dropdowns work on tap
- Issue list scrolls and loads correctly
- Navigation between pages via mobile nav
- Quick-select toggles work on mobile

**Step 3: Run against mobile projects**

```bash
pnpm exec playwright test e2e/mobile-issues.spec.ts --project="Mobile Chrome"
```

**Step 4: Commit and PR**

---

## Side Task: Documentation Consolidation (PR 14)

**Independent — can be done at any time.**

Create a beads issue for this. Scope:
- Audit `docs/` for stale content beyond UI patterns
- Consider merging `docs/UI_GUIDE.md` content into `pinpoint-ui` skill
- Check if `docs/design-consistency/` should be archived after implementation
- Apply code-first philosophy to non-UI pattern docs (server actions, data fetching)
- Check `.agent/skills/` for any skills pointing to stale docs

This is exploratory work — no specific code changes required until the audit is complete.

---

## Orchestrator Workflow

The orchestrator (lead Claude agent) follows this sequence:

```
1. Create beads epic "Design System Implementation"
2. Create sub-issues for each PR (beads-xxx through beads-xxx)
3. Set dependencies: PR 1-2 block 3-5, PRs 3-5 block 6-7, etc.

For each phase:
  a. Create worktrees: ./pinpoint-wt.py create <branch> for each parallel task
  b. Dispatch teammates with task contracts including:
     - Absolute worktree path
     - "Load pinpoint-ui skill first"
     - "Run pnpm run check before completing"
     - PR title and description template
  c. Monitor: teammates push PRs, Copilot reviews
  d. Report to user: "Phase N complete. PRs ready for review: [links]"
  e. Wait for user approval before starting next phase
  f. Clean up worktrees: ./pinpoint-wt.py remove <branch>
```

**Parallel work within phases:**
- Phase 1: Tasks 1.1 and 1.2 can run in parallel (2 agents)
- Phase 2: Tasks 2.1, 2.2, and 2.3 can run in parallel (3 agents)
- Phase 3: Tasks 3.1 and 3.2 (component PRs) in parallel, then 3.3-3.6 (page PRs) in parallel after review
- Phase 4: Tasks 4.1 and 4.2 in parallel (2 agents)

**Max concurrent agents:** 3 (limited by worktree ports: Secondary 3100, Review 3200, AntiGravity 3300, plus ephemeral)

---

## Dependency Graph

```
PR 1 (skill update) ──┐
                       ├── PR 3 (Me quick-select) ──┐
PR 2 (JSDoc/tokens) ──┤                              │
                       ├── PR 4 (My machines) ────────┤
                       │                              │
                       └── PR 5 (Open label) ─────────┤
                                                      │
                              ┌── PR 6 (Mobile nav) ──┤
                              │                        │
                              └── PR 7 (Filter bar) ───┤
                                                       │
                       ┌── PR 8 (Issues list page) ────┤
                       ├── PR 9 (Issue detail page) ───┤
                       ├── PR 10 (Report form page) ───┤
                       └── PR 11 (Machines list page) ─┤
                                                       │
                              ┌── PR 12 (Desktop E2E) ─┘
                              └── PR 13 (Mobile E2E) ──┘
```

---

## Success Criteria

1. Each PR is < 500 lines changed (excluding test files)
2. Each PR passes `pnpm run preflight` independently
3. Each component PR is reviewable in isolation (includes tests + screenshots)
4. Any agent loading `pinpoint-ui` skill can discover all UI patterns
5. Desktop matches `docs/design-consistency/` spec at 100%
6. Mobile views match HTML mockups
7. E2E coverage for all new features on desktop + mobile viewports
