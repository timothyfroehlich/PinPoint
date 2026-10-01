# Page Archetypes (§5)

The archetype catalog: pick the closest one when building a new page.

## 5. Page Archetypes

When building a new page, pick the closest archetype and follow its pattern.

### Dashboard

`max-w-6xl` -- Stats in `grid-cols-1 md:grid-cols-3`, lists in `md:grid-cols-2`.

### List Page (issues, machines)

`max-w-7xl` -- Filters + card grid `md:grid-cols-2 lg:grid-cols-3`.

### Detail Page with Sidebar (machine detail)

`grid md:grid-cols-[minmax(0,1fr)_320px]` -- Sidebar `hidden md:block`, collapses to inline strips on mobile. Machine and Location detail use this pattern.

### Issue Detail (two panes on desktop, section tabs on mobile)

Spec: `docs/feature-specs/issue-detail.md`. `PageContainer size="wide"` capped at `max-w-[1120px]`; from `md:` a `grid-cols-[minmax(0,1fr)_320px]` pair of panes. The main pane holds the header (Issue ID chip + machine link, the full wrapped title, a read-only status/severity/priority summary line), the initial report as plain text, the owner's requirements callout, and Activity with the inline comment box. The right column holds Details — field rows (tappable rows that open a picker) and context rows — then Other issues as compact `IssueCard`s.

- **Mobile**: one column; under the header, three section tabs — Issue, Details, Other issues — and a floating Comment button above the tab bar that opens the composer in a `Sheet`. Edit title and Move share a ⋯ menu beside the title; desktop shows the pencil and a labeled Move button instead.
- **Section tabs are in-page state, not routes** — a deliberate exception to the Tabbed Detail rule below. Every arrival opens on Issue (where comment and event links point), and the panes are one rendered tree that CSS shows as tabs below `md:` and as columns above it, so nothing is mounted twice. Built in `IssueSectionTabs` (`role="tablist"`, arrow-key navigation), not shadcn `<Tabs>`.
- **Field pickers**: a bottom sheet of 44px two-column tiles on phones, an anchored menu on desktop (`useIsMobile`, the sanctioned interaction-behavior exception).

### Tabbed Detail Page (machine detail, multi-tab)

`PageContainer size="standard"` wrapping a persistent header zone + URL-driven tab strip + tab content. Each tab is a real route, not client state — deep-linkable and back-button-friendly. The one exception is issue detail's mobile section tabs (above). Reference implementation: `src/app/(app)/m/[initials]/` (`layout.tsx` renders header + `MachineTabStrip`; sibling `page.tsx` and `{slug}/page.tsx` files render per-tab content).

- **Persistent header**: identity-only — `[initials chip] [game name (truncates)]`. No status badge, no presence badge, no owner display, no primary action button. Not sticky on scroll. The rationale: identity stays in one place across tab navigation; everything else (status, owner, actions) moves into the tab content where it belongs to that tab's context.
- **Per-tab status badge**: open-issue count + machine-status color render as a small colored pill appended to the relevant tab label (e.g., `Service [3]` in amber for `needs_service`). Hidden when count is 0. This single element carries both the urgency (color, from status) and the scale (number, from open-issue count) — replaces the persistent header's status display.
- **Tab strip**: adaptive `flex` row with a real `…` menu — never horizontal tab scrolling or a fade. Active tab uses `border-b-2 border-primary text-primary`. Measure component-local tab, badge, container, and trigger geometry with `ResizeObserver`; when all tabs do not fit, reserve the trigger, retain the active route, and move omitted routes into the menu in source order as real `<Link>` anchors. This is behavior/semantic state CSS cannot express, so it is the sanctioned component-geometry exception to CORE-RESP-002; do not use viewport detection.
- **Constrained widths**: the `…` trigger always stays fully visible and clickable. If even the active label cannot fit beside it, let the active label elide beneath the trigger, give the trigger active visual treatment plus an accessible current-section name, and include the active route in the menu.
- **Desktop and mobile**: render every tab directly whenever measured content fits; otherwise use the same overflow-menu behavior at any width. Do not use hard-coded breakpoints, `scrollIntoView()`, `overflow-x-auto`, or a right-edge fade for this navigation.
- **Data sharing**: layout + tab content share a `cache()`-wrapped query (e.g., `getMachineForLayout` in `_data.ts`) — both call the same function within one request and the second call returns the cached result. Layout calls `notFound()` for missing entities so children can assume existence.
- **No shadcn `<Tabs>`**: that primitive is state-driven (client-only). URL-driven tabs are a navigation strip, not a tabs widget — build with `<Link>` + `usePathname()`.

### Form Page (report, create machine)

`max-w-2xl` -- Form inside a card, back button + title in header.

**Tabbed variant — the report page (`/report`, PP-idrb).** "Report an Issue" is one `PageContainer size="wide"` page with a **boxed**, URL-driven tab bar (Single issue / Multiple) hosted in `report/layout.tsx`. Unlike the underline Tabbed Detail archetype above, these tabs are boxed (segmented look: `rounded-lg border bg-muted p-1`; active tab `bg-card shadow-sm`) with icons (`AlertCircle` / `ListPlus`), default Single. A `"use client"` `ReportDraftProvider` in the layout holds one shared draft so **entry #1** syncs between the detailed Single form and the grid's first row and survives the tab switch (layouts don't remount across sibling-route nav). The one lock (spec `docs/superpowers/specs/2026-07-16-tabbed-report-page-design.md` §5): 2+ grid rows with content disable the Single tab (`aria-disabled`, tapping reveals a one-line reason). Still route-driven — `<Link>` + `usePathname()`, no shadcn `<Tabs>`.

### Settings Page

`max-w-3xl` -- Vertical sections separated by `Separator` components.

### Admin Table

`max-w-6xl` -- Full-width `Table` with fixed column widths.

### Auth Page

`max-w-md` -- Centered card, no MainLayout wrapper.

### Content Page (about, privacy, changelog)

`max-w-3xl` -- Prose content inside a card.

### Help Hub

`max-w-3xl` -- Card grid `sm:grid-cols-2`.
