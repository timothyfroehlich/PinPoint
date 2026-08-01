# Page Archetypes (§5)

The archetype catalog: pick the closest one when building a new page.

## 5. Page Archetypes

When building a new page, pick the closest archetype and follow its pattern.

### Dashboard

`max-w-6xl` -- Stats in `grid-cols-1 md:grid-cols-3`, lists in `md:grid-cols-2`.

### List Page (issues, machines)

`max-w-7xl` -- Filters + card grid `md:grid-cols-2 lg:grid-cols-3`.

### Detail Page with Sidebar (machine detail)

`grid md:grid-cols-[minmax(0,1fr)_320px]` -- Sidebar `hidden md:block`, collapses to inline strips on mobile.
**Note:** Issue detail migrated off this archetype (see "Detail Page with Inline Metadata" below). Machine and Location detail still use this pattern.

### Detail Page with Inline Metadata (issue detail)

`max-w-3xl` (PageContainer `size="narrow"`) single-column main flow. Metadata uses `IssueMetadata` (container query reflows 1-col → 2-col at `@xl:`). Mobile sticky comment composer opens a `Sheet`. Reading-content-shaped pages prefer `narrow` over `standard` — issue detail is text + form rows, not a dashboard.
**Note:** Replaces "Detail Page with Sidebar" for issue detail; eliminates desktop/mobile divergence. Use for new detail pages; migrate existing sidebar pages opportunistically.

### Tabbed Detail Page (machine detail, multi-tab)

`PageContainer size="standard"` wrapping a persistent header zone + URL-driven tab strip + tab content. Each tab is a real route, not client state — deep-linkable and back-button-friendly. Reference implementation: `src/app/(app)/m/[initials]/` (`layout.tsx` renders header + `MachineTabStrip`; sibling `page.tsx` and `{slug}/page.tsx` files render per-tab content).

- **Persistent header**: identity-only — `[initials chip] [game name (truncates)]`. No status badge, no presence badge, no owner display, no primary action button. Not sticky on scroll. The rationale: identity stays in one place across tab navigation; everything else (status, owner, actions) moves into the tab content where it belongs to that tab's context.
- **Per-tab status badge**: open-issue count + machine-status color render as a small colored pill appended to the relevant tab label (e.g., `Service [3]` in amber for `needs_service`). Hidden when count is 0. This single element carries both the urgency (color, from status) and the scale (number, from open-issue count) — replaces the persistent header's status display.
- **Tab strip**: horizontal `flex` row inside `overflow-x-auto`. Active tab uses `border-b-2 border-primary text-primary`. A right-edge fade gradient (`pointer-events-none absolute bg-gradient-to-l from-background`) is rendered **only when the strip can scroll further right** — tracked via a `scroll` listener + `ResizeObserver` so the fade hides cleanly when all tabs already fit or when the user has scrolled to the end.
- **Mobile**: same strip — scrolls horizontally when tabs don't fit. Client-side `scrollIntoView({ inline: 'center' })` on mount centers the active tab on deep-link.
- **Desktop** (≥ md): typically fits all tabs in one row with no scroll; fade stays hidden.
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
