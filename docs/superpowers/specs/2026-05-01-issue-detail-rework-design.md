# Issue Detail Page Rework — Design

**Date:** 2026-05-01
**Bead:** `PP-yxw.9` (parent epic `PP-yxw` — Design Bible & Consistency)
**Branch:** `feat/issue-detail-rework-PP-yxw.9`
**Status:** Draft for review

---

## 1. Summary

The current issue detail page (`src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx`) ships two structurally divergent layouts: a desktop sidebar (`IssueSidebar`) and a bespoke mobile metadata strip (hand-rolled `border-y py-2` chrome plus a separate `SidebarActions rowLayout` block). The two paths render the same fields differently, with separate breadcrumb implementations and a mobile-only `OwnerRequirementsCallout` placement.

**Goal:** replace the divergent metadata UI with a single inline component that adapts via container query, so desktop and mobile share one structure. Preserve everything else — the unified `IssueTimeline`, comment editing, image attachments, mention support, and all permission rules — unchanged.

This rework belongs to the broader Design Bible & Consistency epic (`PP-yxw`, 17/19 children complete) which has standardized the rest of the app on the design bible.

---

## 2. What's Changing (Deltas)

| #   | Delta                                                                                                                    | Files                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| D1  | Replace `IssueSidebar` (desktop) + bespoke mobile metadata strip with a single inline `IssueMetadata` component          | New: `src/components/issues/IssueMetadata.tsx`. Delete: `src/components/issues/IssueSidebar.tsx`. Modify: `page.tsx` |
| D2  | Container-query reflow: ≥40rem (640px) → 2-column grid, below → 1-column stack                                           | In `IssueMetadata.tsx`                                                                                               |
| D3  | Widen `PageHeader.title` from `string` to `string \| React.ReactNode` so `EditableIssueTitle` can be the title           | `src/components/layout/PageHeader.tsx`                                                                               |
| D4  | Drop the desktop+mobile breadcrumb divergence; replace with single eyebrow row above title                               | `page.tsx`                                                                                                           |
| D5  | Mobile-only sticky bottom comment composer (signed-in only)                                                              | New: `src/components/issues/StickyCommentComposer.tsx`                                                               |
| D6  | Move `OwnerRequirementsCallout` to a single canonical location (inside timeline, after initial report, no `@xl:` gating) | `src/components/issues/IssueTimeline.tsx`, `page.tsx`                                                                |
| D7  | Add new page archetype "Detail Page with Inline Metadata" to the design bible                                            | `.agent/skills/pinpoint-design-bible/SKILL.md` §5                                                                    |

---

## 3. What's NOT Changing (Kept-as-is)

These are explicit non-deltas. Any change to them is **out of scope** for this rework.

| Item                                                                                                           | Reason kept                                                             |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `IssueTimeline` structure (unified description + comments + system events stream)                              | Existing design choice is sound; renaming would only invite scope creep |
| Initial report card (primary border, "Initial report" tag, avatar, timestamp)                                  | Visual differentiation already works                                    |
| Comment edit/delete three-dot menu (permission-gated: own author / admin)                                      | Behavior and UX already correct                                         |
| Image attachments (issue + comments) via `ImageGallery` and `ImageUploadButton`                                | No changes                                                              |
| `RichTextEditor` with `@mention` support                                                                       | No changes                                                              |
| Empty state ("No comments yet" with `MessageSquare`)                                                           | Already correct                                                         |
| "Log in to comment" placeholder for unauthenticated viewers                                                    | Already correct                                                         |
| Vertical thread line at `@xl:` container width                                                                 | Already correct                                                         |
| Avatars + relative timestamp + `Tooltip` showing absolute time on each event                                   | Already correct                                                         |
| All 5 update forms (`UpdateIssue{Status,Priority,Severity,Frequency}Form`, `AssignIssueForm`)                  | Behavior unchanged; only their placement moves                          |
| `EditableIssueTitle` component itself (pencil-on-hover, inline edit, Enter/Escape, 100-char limit)             | No changes — placement moves into widened `PageHeader`                  |
| `WatchButton` component                                                                                        | No changes — used as a pill in the new metadata layout                  |
| `BackToIssuesLink`                                                                                             | No changes                                                              |
| All permission rules (`issues.update.reporting`, `issues.update.triage`, `issues.watch`, `comments.add`, etc.) | No changes; new components consume existing matrix                      |

---

## 4. Page Archetype

### 4.1 Current archetype (deprecated for issue detail)

**"Detail Page with Sidebar"** (design-bible §5):

```
grid md:grid-cols-[minmax(0,1fr)_320px]
Sidebar `hidden md:block`, collapses to inline strips on mobile.
```

This archetype is the source of the desktop/mobile divergence problem. It optimizes for desktop horizontal space at the cost of forcing a different mobile rendering path.

### 4.2 New archetype

**"Detail Page with Inline Metadata"** — to be added to design-bible §5:

```
<PageContainer size="standard">       (max-w-6xl)
  <BackToIssuesLink />
  <Eyebrow />                          (issue ID + machine + game owner, single row)
  <PageHeader title={...}>             (widened — accepts ReactNode)
  <Subtitle />                         (reporter + date + watching count + watch toggle)
  <IssueMetadata />                    (NEW — labeled rows with container query)
  <OwnerRequirementsCallout />         (when applicable; conditional, single location)
  <IssueTimeline />                    (unchanged — description + activity + comments)
  <AddCommentForm />                   (md+ inline; mobile uses sticky composer)
</PageContainer>
<StickyCommentComposer />              (mobile only, md:hidden, signed-in only)
```

Single column on desktop and mobile. No sidebar. Metadata flows in the main column above content. The container-query reflow inside `IssueMetadata` adapts to the available width — works in any layout context.

### 4.3 Other detail pages (not in this rework)

`Machine` and `Location` detail pages still use "Detail Page with Sidebar." This rework introduces the new archetype but doesn't migrate other pages. Migration of those pages is a separate, future bead — they can opt in once this archetype proves out.

---

## 5. Component Specifications

### 5.1 `IssueMetadata` (new)

**Location:** `src/components/issues/IssueMetadata.tsx`

**Purpose:** Render the 5 editable issue fields (Status, Priority, Severity, Frequency, Assignee) as labeled rows that reflow from 1-column to 2-column based on container width.

**Props:**

```ts
interface IssueMetadataProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string }[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}
```

**Structure:**

- Outer wrapper: `container-type: inline-size` (sets up container query context)
- Inner grid: `<div>` with `display: grid`, `grid-template-columns: 1fr` by default
- 5 child rows, each: `<div>` with `grid-template-columns: 90px 1fr`, label on left, control on right
- Below 40rem container width: stack of 5 rows
- Above 40rem container width: 2-column grid, last row (Assignee) spans both columns

**Rendering:**

| Row | Label                               | Control                               | Permission gate           |
| --- | ----------------------------------- | ------------------------------------- | ------------------------- |
| 1   | `Status`                            | `UpdateIssueStatusForm` (existing)    | `issues.update.reporting` |
| 2   | `Priority`                          | `UpdateIssuePriorityForm` (existing)  | `issues.update.triage`    |
| 3   | `Severity`                          | `UpdateIssueSeverityForm` (existing)  | `issues.update.reporting` |
| 4   | `Frequency`                         | `UpdateIssueFrequencyForm` (existing) | `issues.update.reporting` |
| 5   | `Assignee` (spans 2 cols at ≥40rem) | `AssignIssueForm` (existing)          | `issues.update.triage`    |

When the user lacks permission for a given field, the form component renders the value as a static pill (no chevron, no popover). The matrix-driven gating already lives in each `Update*Form` component — `IssueMetadata` doesn't re-implement it.

**Visual/structural rules:**

- Touch target: minimum 44pt row height (`min-h-[44px]` via padding) per Apple HIG / Material Design
- Label: `text-xs uppercase tracking-wide text-muted-foreground font-bold`
- Border around the metadata container: `border border-outline-variant rounded-lg`
- Internal row separators: `border-b border-outline-variant/40`, last row no border
- 2-col mode: vertical separator between left/right columns: `border-l border-outline-variant/40` on every other child
- Background: `bg-card` (per design-bible §2 surface hierarchy — content-bearing surface)
- All transitions: `transition-colors duration-150` (per design-bible §11)
- Color usage: each pill consumes its existing `*_CONFIG[value].styles` — no new color mapping
- Container query selectors: `@container (min-width: 40rem)` (Tailwind v4: `@md:` if `@container` parent declared, but use raw CSS to be explicit about the threshold)

**What this replaces:**

- `IssueSidebar.tsx` (entire file deleted; its contents — `SidebarActions` full + `WatchButton` full + watchers count + reporter row + created date row — are absorbed into `IssueMetadata` plus the page subtitle row)
- The `<div className="flex items-center gap-2 border-y py-2">` mobile metadata strip in `page.tsx`
- The `<div data-testid="issue-badge-strip">` mobile badge strip rendering `SidebarActions` with `compact`, `exclude="assignee"`, `rowLayout` props
- The `md:grid-cols-[minmax(0,1fr)_320px]` grid wrapper

`SidebarActions` itself is **not deleted** in this PR — it's still consumed by `IssueMetadata` as a row-orchestrator (or the rendering can move into `IssueMetadata` directly; see §10.1). Its `compact`, `rowLayout`, `only`, `exclude` props become unused and can be removed in a phase-2 cleanup.

### 5.2 `PageHeader` widening (D3)

**Location:** `src/components/layout/PageHeader.tsx`

**Change:**

```ts
// Before
interface PageHeaderProps {
  title: string;
  titleAdornment?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

// After
interface PageHeaderProps {
  title: string | React.ReactNode;
  titleAdornment?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}
```

**Render rule:**

- If `typeof title === "string"`: render as today — `<h1 className="text-balance text-3xl font-bold tracking-tight">{title}</h1>`
- If `title` is `ReactNode`: render the node directly. Caller is responsible for the `<h1>` element and matching typography (or accepting a different visual treatment).

**Why this approach over a separate component:**

- Backward compatible — every existing call site passes a string, TypeScript narrows correctly, no migration needed
- Single header primitive — no proliferation of `EditableHeader` / `StaticHeader` / etc.
- The "consumer brings their own h1 with matching styles" rule is the same convention React's `children` slot uses everywhere

**Issue detail usage:**

```tsx
<PageHeader
  title={
    <EditableIssueTitle
      issueId={issue.id}
      title={issue.title}
      canEdit={userCanEditTitle}
      className="text-balance text-3xl font-bold tracking-tight"
    />
  }
/>
```

`EditableIssueTitle` already passes `className` through to its `<h1>` — no changes needed there.

### 5.3 `StickyCommentComposer` (D5)

**Location:** `src/components/issues/StickyCommentComposer.tsx`

**Purpose:** Mobile-only persistent comment-entry affordance. Tapping it opens the existing `AddCommentForm` inside a `Sheet`, eliminating the "scroll to bottom of timeline to comment" friction.

**Visibility rules:**

- Rendered: `md:hidden` (mobile only — desktop uses inline composer in `IssueTimeline`)
- Shown when: user is authenticated (`accessLevel !== "unauthenticated"`)
- Hidden when: user is unauthenticated → no sticky bar, the existing inline "Log in to comment" placeholder in `IssueTimeline` carries the message

**Layout:**

- `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`
- `z-index`: `z-30` (above main content, below `BottomTabBar` at `z-50` — composer sits above tab bar? See §5.3.1)
- Bottom padding: `pb-[env(safe-area-inset-bottom)]`
- Background: `bg-card/95 backdrop-blur-sm` (frosted glass — matches navigation chrome per design-bible §2)
- Border-top: `border-t border-outline-variant`

**Visual:**

```
┌───────────────────────────────────────────────────┐
│  [   Add a comment…                          ↑]  │  ← collapsed pill input
└───────────────────────────────────────────────────┘
```

Full-width single-line pill input + send icon. The input is a _button_ visually — tapping it opens the Sheet. The user doesn't type into the sticky bar itself.

**On tap:**

Opens a `<Sheet side="bottom">` containing the existing `AddCommentForm`. Sheet auto-dismisses on submission success. ESC or back gesture closes it.

This pattern (sticky bar opens Sheet) reuses the design-bible's existing modal/Sheet vocabulary — no new interaction primitive.

#### 5.3.1 Stacking with `BottomTabBar`

`BottomTabBar` is `fixed`, `z-50`, 56px min-height. The sticky composer must coexist with it. Two options:

**Option A — Composer above tab bar:**

```
[ tabs: dashboard | issues | machines | report | more ]   ← BottomTabBar (fixed, z-50, 56px)
[ Add a comment…                                       ↑] ← StickyCommentComposer (fixed, z-30, ~52px)
```

Composer sits _above_ the tab bar (`bottom: 56px`). Tab bar stays accessible at all times. **Recommended.**

**Option B — Composer replaces tab bar on this route:**

Hide `BottomTabBar` on issue detail pages. Composer occupies the bottom. Loses navigation accessibility. **Rejected** — issue detail isn't a focused-flow modal where global nav should disappear.

**Option C — Composer is part of a "More" gesture:**

Tap on inline composer in timeline → scrolls into view + focuses. No sticky bar. **Rejected** — defeats the purpose of the rework, which is to eliminate scroll friction.

**Decision:** Option A. Sticky composer renders at `bottom: calc(56px + env(safe-area-inset-bottom))` to clear the tab bar.

Content bottom padding for issue detail page must be increased to clear _both_ the tab bar AND the sticky composer:

```
pb-[calc(56px+52px+env(safe-area-inset-bottom))] md:pb-0
```

(56px tab bar + 52px composer = 108px total; document this as the new value for issue detail in design-bible §3 Shell Contract or as a per-route override.)

### 5.4 `OwnerRequirementsCallout` placement (D6)

**Current:** Dual placement

- Mobile: rendered in page chrome inside the metadata block (`page.tsx` line 267-272)
- Desktop `@xl:`: rendered inside `IssueTimeline` after the initial report event (`IssueTimeline.tsx` line 473-479, with `hidden @xl:ml-20 @xl:block`)

**New:** Single canonical location — **inside `IssueTimeline`, after the initial report event, no `@xl:` gating.**

- Removes the dual rendering
- Visible at all viewports
- Reads naturally as part of the conversation flow ("Here's the issue. The owner has these requirements. Now here's what happened next.")
- Keeps it close to its semantic anchor (the issue itself)

**Implementation:**

- `IssueTimeline.tsx`: remove the `hidden @xl:ml-20 @xl:block` wrapper around `<OwnerRequirementsCallout>` — just render it inline after the initial report
- `page.tsx`: remove the mobile-only `<OwnerRequirementsCallout>` block

### 5.5 Eyebrow + Subtitle rows (D4)

**Current:** Two separate breadcrumb implementations (`hidden md:flex` desktop + `flex md:hidden` mobile) plus a watch-button strip and a mobile metadata strip — none of which share structure.

**New:** Two single rows that work at every viewport:

**Eyebrow row (above PageHeader):**

```
← Back to Issues       (BackToIssuesLink)
PIN-101 · Iron Maiden · Game Owner: Tim F.       (eyebrow)
```

- `BackToIssuesLink` on its own row (already correct)
- Below it: `<div>` with flex-wrap, gap-2, containing:
  - Issue ID badge (`<span>` styled as a monospace pill)
  - Separator dot
  - Machine link (`<Link>` to `/m/${initials}`)
  - Conditional: separator + "Game Owner:" label + game owner link (when `ownerName` is truthy and machine has owner)

**Subtitle row (below PageHeader):**

```
Reported by Tim F. (Owner) · Apr 25 · 2 watching · [+ Watch]
```

- Single row, flex-wrap
- Reporter name (with optional `Owner` flag if reporter is machine owner)
- Created date (`formatDate(issue.createdAt)`)
- Watchers count
- `WatchButton` rendered in pill mode (replaces the old standalone button + count combo — see §5.6)

Email-privacy rule (NON_NEGOTIABLES.md #12): reporter shows name only, never email.

### 5.6 `WatchButton` as a pill

Existing `WatchButton` component has two modes today: full (`Watch Issue` / `Unwatch Issue`) and `iconOnly`. In the new design, both inline locations use the **full mode** — but visually styled to match the subtitle's pill rhythm.

No component changes required. The existing `className` override slot accepts pill styling. Subtitle render:

```tsx
<WatchButton
  issueId={issue.id}
  initialIsWatching={isWatching}
  className="rounded-full px-3 py-0.5 text-xs" // pill override
/>
```

(Exact classes TBD during implementation; the point is no new component.)

---

## 6. Responsive Behavior

### 6.1 Layer 1: viewport breakpoints (page structure)

| Breakpoint     | What changes                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `md:` (≥768px) | Inline composer in timeline visible; `StickyCommentComposer` hidden                                                     |
| Below `md:`    | Inline composer hidden (timeline ends with last event or empty state); `StickyCommentComposer` visible (signed-in only) |

The metadata grid, timeline, description rendering — none of these are gated by viewport breakpoints in the new design. Everything is single-column main flow.

### 6.2 Layer 2: container queries (component internals)

| Component                  | Query                           | Below threshold                                                       | Above threshold                    |
| -------------------------- | ------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `IssueMetadata`            | `@container (min-width: 40rem)` | 1-column stack                                                        | 2-column grid, Assignee spans both |
| `IssueTimeline` (existing) | `@xl:` (~576px)                 | Vertical thread line hidden, avatars hidden, comment cards full-width | Thread line shown, avatars shown   |

`IssueMetadata` uses raw container queries (`@container` in CSS) rather than Tailwind v4's `@md:` shorthand because the threshold (40rem) is not a Tailwind default — being explicit avoids confusion.

The 40rem threshold is **tunable** during implementation. Acceptable range: 32rem (more aggressive 2-col, kicks in on tablets) to 48rem (more conservative).

### 6.3 No viewport JS

No `window.innerWidth`, `useMediaQuery`, or `matchMedia`. All responsive behavior is CSS (per AGENTS.md rule #16).

---

## 7. Permissions Rendering

The matrix-driven permissions already live in each component. This design preserves them:

| Field       | Permission                | Renders as                                                                                               |
| ----------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Title       | `issues.update.reporting` | Editable (pencil-on-hover) when granted; static `<h1>` when denied                                       |
| Status      | `issues.update.reporting` | Popover when granted; static pill when denied                                                            |
| Severity    | `issues.update.reporting` | Popover when granted; static pill when denied                                                            |
| Frequency   | `issues.update.reporting` | Popover when granted; static pill when denied                                                            |
| Priority    | `issues.update.triage`    | Popover when granted; static pill when denied                                                            |
| Assignee    | `issues.update.triage`    | Popover when granted; static pill when denied                                                            |
| Watch       | `issues.watch`            | Pill toggle when granted; hidden when denied (unauthenticated)                                           |
| Add comment | `comments.add`            | Composer (sticky on mobile, inline on desktop) when granted; "Log in to comment" placeholder when denied |

Anonymous viewers see all 5 metadata pills as static (no chevrons, no hover, no popover). The `IssueMetadata` component reads the `accessLevel` and `ownershipContext` props and passes them through to each `Update*Form` — those forms already gate themselves correctly.

The case worth calling out explicitly: a guest editing their **own** issue can edit Status/Severity/Frequency (matrix says `guest: "own"` for `issues.update.reporting`) but **not** Priority or Assignee (matrix says `guest: false` for `issues.update.triage`). The metadata grid then renders rows 1, 3, 4 as editable and rows 2, 5 as static. Mixed state — must be visually correct.

---

## 8. Color & Token Usage

Per design-bible §1 (color rules):

- All component code uses semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-outline-variant`, `text-primary`, `text-destructive`, etc.)
- Pill colors come from the existing `STATUS_CONFIG` / `PRIORITY_CONFIG` / `SEVERITY_CONFIG` / `FREQUENCY_CONFIG` tables in `src/lib/issues/status.ts` — never freestyle status colors
- Each pill renders with `STATUS_CONFIG[value].styles` (or equivalent for the field family) — same source of truth as the existing badges
- No raw Tailwind palette classes in `IssueMetadata`, `StickyCommentComposer`, or any new component

Per design-bible §1 accessibility rule: every pill exposes a visible text label (the value) plus the row label as context. Color reinforces, never substitutes. Color-blind users (~8% of men with deuteranopia/protanopia) read the field via the row label and the value text; the colored pill is decorative reinforcement.

---

## 9. Accessibility

- **Pill `aria-label`:** Each editable pill has `aria-label="<Field>: <Value>, click to change"` (e.g., `"Severity: Major, click to change"`)
- **Static pills:** `aria-label="<Field>: <Value>"` — no "click to change" suffix
- **Chevron icon:** `aria-hidden="true"` (decorative)
- **Row label:** Plain text in a `<span>` — screen readers read it as part of the row before the pill
- **Sticky composer input:** `aria-label="Add a comment"` (the input is functionally a button that opens the Sheet)
- **Sheet content:** Existing `<DialogTitle>` / `<DialogDescription>` from `Sheet` ensures screen readers announce the modal correctly
- **Focus trap:** Sheet handles this natively (Radix UI primitive)
- **ESC / back gesture:** Closes the Sheet — built into `Sheet` primitive
- **Reduced motion:** Pill hover effects respect `prefers-reduced-motion: reduce` (handled by Tailwind v4's transition utilities)

---

## 10. Migration Plan

### 10.1 File-level changes

| File                                                  | Action                   | Notes                                                                                                                            |
| ----------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/issues/IssueMetadata.tsx`             | **CREATE**               | New component (~150 lines)                                                                                                       |
| `src/components/issues/StickyCommentComposer.tsx`     | **CREATE**               | New component (~80 lines)                                                                                                        |
| `src/components/issues/IssueSidebar.tsx`              | **DELETE**               | Functionality moves into `IssueMetadata` + page subtitle row                                                                     |
| `src/components/layout/PageHeader.tsx`                | **MODIFY**               | Widen `title` prop (3-line change)                                                                                               |
| `src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx` | **MODIFY**               | Remove dual breadcrumbs, mobile metadata strip, sidebar grid; add eyebrow + subtitle + `IssueMetadata` + `StickyCommentComposer` |
| `src/components/issues/IssueTimeline.tsx`             | **MODIFY**               | Remove `@xl:` gating on `OwnerRequirementsCallout` (~3-line change)                                                              |
| `src/components/issues/SidebarActions.tsx`            | **NO CHANGE** in this PR | `compact`, `rowLayout`, `only`, `exclude` props become unused. Cleanup is phase-2 (not required to land this rework)             |
| `.agent/skills/pinpoint-design-bible/SKILL.md`        | **MODIFY**               | Add "Detail Page with Inline Metadata" archetype to §5; document the container-query 40rem threshold                             |
| `e2e/smoke/responsive-overflow.spec.ts`               | **VERIFY**               | Issue detail page is already in this spec; no changes expected, but must still pass                                              |

### 10.2 Slicing

Recommended PR slicing (smaller PRs are easier to review):

**Slice 1: PageHeader widening** (D3)

- Just the 3-line type change + render conditional. Standalone PR.
- Self-contained, no other consumers touched.
- Validates the typing change ahead of the bigger refactor.

**Slice 2: Issue detail rework** (D1, D2, D4, D5, D6, D7)

- Everything else, in one PR.
- Includes the new `IssueMetadata` + `StickyCommentComposer` components, page restructuring, callout move, archetype doc update.
- E2E smoke + integration tests update simultaneously.

This slicing keeps Slice 1's blast radius tiny (typing widening) and gives Slice 2 a clean dependency.

### 10.3 Test impact

| Test                                                                | Expected impact                                                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `e2e/smoke/responsive-overflow.spec.ts`                             | Must pass at all 3 viewports (mobile 375px, desktop 1024px, etc.)                                                          |
| `e2e/full/issues-crud.spec.ts`                                      | Update selectors that target `[data-testid="issue-sidebar"]`, mobile-only metadata strip, etc. — those data-testids change |
| `src/test/integration/issue-detail-permissions.test.ts`             | Re-verify rendering: new pill states for guest/member/admin/anonymous                                                      |
| `src/test/unit/components/issues/issue-detail-permissions.test.tsx` | Replace `IssueSidebar` rendering tests with `IssueMetadata` rendering tests                                                |
| New: `IssueMetadata` unit tests                                     | Required — render in 1-col vs 2-col container widths, permissions matrix coverage                                          |
| New: `StickyCommentComposer` unit + E2E tests                       | Required — visibility rules, sheet open/close, signed-in vs out                                                            |

E2E coverage: the responsive-overflow spec already covers issue detail. Add a focused E2E that asserts:

- Mobile signed-in: sticky composer visible, tap opens sheet
- Mobile signed-out: no sticky composer, "Log in to comment" placeholder visible
- Desktop: no sticky composer; inline composer in timeline

---

## 11. Open Questions / Explicit Deferrals

| #   | Question                                                               | Decision / Owner                                                                                                                            |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Does sticky composer expand inline on focus, or open a Sheet?          | **Sheet (recommended).** Reuses design-bible's modal vocabulary; cleaner than building inline expansion. Confirm during implementation.     |
| Q2  | Container-query threshold (40rem vs 32rem vs 48rem)?                   | **40rem default.** Tunable during implementation if 2-col feels cramped at tablet sizes.                                                    |
| Q3  | Should `SidebarActions` be deleted in this PR, or left for phase 2?    | **Phase 2.** Avoid scope creep; its props become unused but the file still works.                                                           |
| Q4  | What about the `initial` field returned by `resolveIssueReporter`?     | The Reporter avatar in `IssueTimeline`'s initial report card already uses it. New subtitle row uses the name only (text). No change needed. |
| Q5  | Add an issue-level three-dot menu (Edit issue, Delete issue, Archive)? | **Out of scope.** No such affordance exists today; introducing one is a separate feature, not part of this rework.                          |

---

## 12. Out of Scope (Explicit)

- **Edit / Delete / Archive issue (issue-level actions)** — no such affordance today; not introduced here
- **Mention notifications** — already work via `RichTextEditor mentionsEnabled={true}`; no changes
- **Image attachment behavior** — `ImageGallery`, `ImageUploadButton`, `BLOB_CONFIG.LIMITS.COMMENT_MAX` all unchanged
- **Permission matrix changes** — no new permissions, no role rebalancing
- **Other detail page archetypes** (machine, location) — they keep "Detail Page with Sidebar" until separately migrated
- **`SidebarActions` cleanup** (deleting unused `compact`/`rowLayout`/`only`/`exclude` props) — phase 2
- **Status workflow changes** — the 11 statuses, their groupings, descriptions, and transitions are unchanged
- **Comment threading / nested replies** — flat comment list preserved
- **Real-time updates / live comments** — not in scope; existing server-action revalidation pattern preserved

---

## 13. Acceptance Criteria

This rework is complete when:

1. **Visual** — desktop and mobile render the same metadata structure (5 labeled rows, with desktop ≥40rem container reflowing to 2-column)
2. **Behavior** — all 5 editable fields editable with the same popovers as today; all 5 permission gates respected; title editing affordance preserved
3. **No regressions** — `IssueTimeline` (initial report, comments, system events, image attachments, edit/delete menu, empty state, login-to-comment) renders identically
4. **Sticky composer** — appears on mobile when signed in; opens Sheet on tap; submits via existing `AddCommentForm`
5. **OwnerRequirementsCallout** — single render location (after initial report in timeline), visible at all viewports
6. **Tests** — `pnpm run preflight` clean. New `IssueMetadata` and `StickyCommentComposer` tests added. Existing E2E + integration tests updated for new structure.
7. **Design bible** — §5 includes new "Detail Page with Inline Metadata" archetype
8. **`PageHeader`** — accepts `string | ReactNode` for title; existing call sites unchanged

---

## 13b. Post-implementation deltas (PR #1270)

Three decisions in this spec diverged from the shipped implementation. Treat the
shipped code as the source of truth — these notes exist so future readers don't
re-implement against the original spec values.

| Spec value                                                                                     | Shipped value                                 | Why it changed                                                                                                                                                                                                                     |
| :--------------------------------------------------------------------------------------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IssueMetadata` 1-col → 2-col reflow at `@container (min-width: 40rem)` (≈640px), raw CSS      | `@xl:grid-cols-2` Tailwind variant (≈576px)   | Tailwind v4's `@xl:` shorthand is idiomatic in this codebase. The 64px-narrower threshold reflows on more devices (large phones in landscape, small tablets) at minimal cost.                                                      |
| `OwnerRequirementsCallout` rendered inside `IssueTimeline` after the initial report event (D6) | Rendered at page level, above `IssueMetadata` | Design review during implementation: the ownership requirements describe the _machine_, not a timeline event. Hoisting it above the metadata grid makes it visible immediately on page load (no scroll), which matches its intent. |
| `<PageContainer size="standard">` (max-w-6xl)                                                  | `<PageContainer size="narrow">` (max-w-3xl)   | Design review during implementation: at 1024px+ the metadata grid + timeline read better at 768px max-width. The wider container left a lot of empty space on the right. Issue detail is reading-content-shaped, not table-shaped. |

The first two acceptance criteria below should be read with these deltas in
mind: ≥40rem becomes ≥36rem, and "after initial report in timeline" becomes
"above IssueMetadata at page level."

## 14. Brainstorming Provenance

This design emerged from a brainstorming session whose mockups are preserved at [`docs/superpowers/mockups/2026-05-01-issue-detail-rework/`](../mockups/2026-05-01-issue-detail-rework/). See that directory's `README.md` for the full decision arc; the short version:

- `issue-detail-competitive.html` — competitor research (GitHub, Linear, Asana, today's PinPoint)
- `mobile-metadata-strategy.html` — strategy choice (A/B/C/D); user picked C (Linear-style pill strip)
- `header-status-placement.html` — top-left vs hero status; user picked hero (later normalized into the row)
- `pill-organization.html` — flat row vs grouped vs two-tier; user picked α (reduce + reorganize)
- `authentic-issue-detail.html` — first version with real schema fields (caught machine-not-editable, no-locations, missing severity/frequency)
- `labeled-directions.html` — D1 (horizontal labeled pills) vs D2 (vertical labeled rows); user picked D2; sticky composer mobile-only signed-in only confirmed
- `d2-final.html` — final form with container-query 2-column desktop / 1-column mobile and Assignee row spanning both columns

The brainstorming gates: principles → mockups → user picks → design doc. All four gates passed. Use the preserved mockups for visual verification during implementation; use this doc for what to build.

---

## 15. Next Steps

1. **User reviews this doc** (now)
2. **Address feedback** if any
3. **Invoke `superpowers:writing-plans` skill** to convert design → implementation plan
4. **Slice 1: PageHeader widening** (small PR, fast turnaround)
5. **Slice 2: Issue detail rework** (the substantive PR)
6. **Update `pinpoint-design-bible` SKILL.md** with new archetype (can land with Slice 2)
