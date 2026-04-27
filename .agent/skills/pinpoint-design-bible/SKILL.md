---
name: pinpoint-design-bible
description: Design system rules, page archetypes, spacing rhythm, surface hierarchy, responsive strategy. Use when building any new UI, page, or component to ensure visual consistency.
---

# PinPoint Design Bible

## When to Use This Skill

Use this skill when:

- Building a new page or view
- Creating or modifying a component
- Making layout or spacing decisions
- Choosing colors, surfaces, or border treatments
- Working on responsive behavior
- Someone asks about the design system, visual style, or UI patterns

## 1. Visual Identity

PinPoint uses a **dark neon aesthetic** -- deep charcoal backgrounds with neon green and teal accents.

| Token              | Value     | Usage                               |
| :----------------- | :-------- | :---------------------------------- |
| Primary            | `#4ade80` | Actions, active states, CTAs, links |
| Secondary          | `#2dd4bf` | Accents, decorative highlights      |
| Background         | `#0f0f11` | Page background                     |
| Surface            | `#0f0f11` | Content areas, full-width sections  |
| Card               | `#18151b` | Elevated containers                 |
| Surface-variant/30 | --        | Dimmed/closed items                 |

**Purple is not in the palette.** It was removed in favor of teal so the
primary and secondary read as one green-family pairing rather than two
competing brands. Do not reintroduce a purple/magenta/fuchsia secondary, or
raw `purple-*` / `fuchsia-*` / `magenta-*` classes, in new code. The one
exception is the legacy raw-Tailwind purple used for a handful of entries in
`STATUS_CONFIG` and `PRIORITY_CONFIG` (both in
[`src/lib/issues/status.ts`](../../../src/lib/issues/status.ts)) -- those are
tracked for conversion to semantic tokens and should be migrated
opportunistically, not extended.

**Rules:**

- **All color references in component code must use semantic tokens.** Never write raw Tailwind palette classes (`text-purple-400`, `bg-amber-500/20`, `border-fuchsia-500`) or hardcoded hex (`#d946ef`, `bg-[#abcdef]`) anywhere under `src/app/**`, `src/components/**`, or any `.tsx` / `.ts` file that renders or styles UI. Use `text-primary`, `bg-destructive`, `text-muted-foreground`, `border-success/40`, etc.
- **`dark:` utility classes are forbidden.** PinPoint is dark-only; `dark:` classes are dead code. Remove them when you touch a file that still contains them.
- **Design-layer config is the only exception.** The four color tables in [`src/lib/issues/status.ts`](../../../src/lib/issues/status.ts) (`STATUS_CONFIG`, `SEVERITY_CONFIG`, `PRIORITY_CONFIG`, `FREQUENCY_CONFIG`) and the equivalent mapping in `src/lib/machines/presence.ts` may use raw Tailwind palette classes — because the raw palette _is_ the design decision being expressed. Component code consumes the resulting class strings via `STATUS_CONFIG[status].styles`; never replicate those class strings at call sites.
- Status colors come from `STATUS_CONFIG` / `SEVERITY_CONFIG` / `PRIORITY_CONFIG` / `FREQUENCY_CONFIG` -- never freestyle status colors in components.
- Glow effects (`glow-primary`, `glow-secondary`) are for interactive hover states only, never static decoration. Apply `hover:glow-primary` to navigable card surfaces: machine cards (list and dashboard panels), issue cards, and interactive stat cards. Apply `hover:glow-success` to "recently fixed" machine cards where the success color already conveys status semantically. Do not apply any glow to form controls, buttons, modals, destructive actions, nav links, input fields, or dropdown triggers.
- Frosted glass (bg-card with opacity + `backdrop-blur-sm`) is reserved for navigation chrome.
- **Never rely on color alone to convey semantics.** Destructive, warning, success, and status cues must ship with an accessible text label — either visible, or via `aria-label` / `sr-only`. Decorative icons that accompany the color cue should be marked `aria-hidden="true"` so screen readers receive the label, not the icon. Under deuteranopia / protanopia (combined ~8% of men), destructive-red and warning-amber collapse to similar mustard shades and are not distinguishable by hue. Concretely: `<Alert variant="destructive">` and `<Alert variant="warning">` include a leading `AlertOctagon` / `AlertTriangle` (or equivalent) as `aria-hidden` decoration plus body text that names the condition; destructive buttons carry a verb label like "Delete" (with any icon `aria-hidden`); status / severity / priority badges expose `.label` alongside their icon.

## 2. Surface Hierarchy

Pick the surface level based on the element's role:

| When building...                         | Use                               |
| :--------------------------------------- | :-------------------------------- |
| Page background                          | `bg-background` (#0f0f11)         |
| Full-width content section               | `bg-surface` (#0f0f11)            |
| Card, popover, elevated container        | `bg-card` (#18151b, fully opaque) |
| Header, app header, tab bar (nav chrome) | `bg-card/85 backdrop-blur-sm`     |
| Closed/archived/dimmed item              | `bg-surface-variant/30`           |

**Key distinction:** Navigation chrome gets the frosted glass treatment (opacity + blur). Content cards are always fully opaque `bg-card`.

## 3. Shell Contract

These values are fixed. Do not deviate.

| Element        | Value                                                         |
| :------------- | :------------------------------------------------------------ |
| App header     | 56px (`h-14`), `sticky`, `z-20`, frosted glass                |
| Bottom tab bar | 56px min-height, `fixed`, `z-50`, `md:hidden`                 |
| Tab bar safe   | `env(safe-area-inset-bottom)` padding                         |
| Content bottom | `pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0`         |
| Scroll padding | `scroll-pt-14 md:scroll-pt-14`                                |
| Mobile/desktop | `md:` (768px) is THE breakpoint (standard viewport, no hacks) |

**If you add a new page:** it MUST include the content bottom padding or content will be hidden behind the tab bar on mobile.

## 4. Responsive Strategy

PinPoint uses a **two-layer responsive framework**. Each layer has a distinct job. Never use both layers to solve the same layout problem.

### Layer 1 — Viewport Breakpoints (page structure)

Use viewport breakpoints when the decision depends on the browser window size — showing or hiding entire sections, switching page-level grid columns, top-level padding.

| Breakpoint | Viewport | Role                 | Example                                       |
| :--------- | :------- | :------------------- | :-------------------------------------------- |
| `md:`      | 768px    | Primary layout pivot | Single column → multi-column, show nav icons  |
| `lg:`      | 1024px   | Element enrichment   | Icon-only nav → icon+text, APC logo appears   |
| `sm:`      | 640px    | Padding/spacing only | `sm:px-8`, `sm:gap-4` — no structural changes |

**`sm:` is padding only.** Never use `sm:grid-cols-2`, `sm:flex-row`, or `hidden sm:block`.

### Layer 2 — Container Queries (component internals)

Use container queries when the decision depends on the component's available width — not the viewport. A component inside the issue detail content column has less space than the same component full-width, regardless of screen size.

**These are NOT viewport sizes.** They are the width of the nearest `@container` ancestor.

| Query   | Container width | Typical use                                     |
| :------ | :-------------- | :---------------------------------------------- |
| `@lg:`  | 512px           | First internal layout shift (e.g., stack → row) |
| `@xl:`  | 576px           | Expanded row layout, additional columns         |
| `@2xl:` | 672px           | Further enrichment, multi-column grids          |
| `@3xl:` | 768px           | Full-featured component layout                  |

### Decision Tree

```
"Show/hide entire section?" → Viewport (md: / lg:)
"Component internal layout?" → Container query (@lg: / @xl:) if variable-width parent, else viewport
```

### z-index Hierarchy

| Element        | Value |
| :------------- | :---- |
| App header     | z-20  |
| Bottom tab bar | z-50  |
| Modals (Radix) | z-50+ |

### Rules

- Mobile-first: write the mobile layout, then add `md:` / `@lg:` overrides.
- `md:` shows/hides sections and sets page structure. `lg:` enriches elements (icon → icon+text).
- AppHeader uses a **two-tier** pattern: nav items appear at `md:` (icon-only), text labels expand at `lg:`. See Section 8.
- **No JavaScript viewport detection.** No `window.innerWidth`, `useMediaQuery`, or `matchMedia` — use CSS. These cause hydration mismatches and duplicate CSS's job.
- **`@container` propagation:** Adding `@container` to a parent changes how all descendant container queries resolve. Audit children before adding it to an existing element.
- **Overflow testing:** Every page must pass `assertNoHorizontalOverflow()` in its smoke test — `document.scrollWidth <= document.clientWidth` at both mobile (375px) and desktop (1024px) viewports. Add new pages to `e2e/smoke/responsive-overflow.spec.ts`.
- **Documented exception:** `use-table-responsive-columns` for IssueList (PP-rs9) uses a JS hook — this is the sole approved exception.

## 5. Page Archetypes

When building a new page, pick the closest archetype and follow its pattern.

### Dashboard

`max-w-6xl` -- Stats in `grid-cols-1 md:grid-cols-3`, lists in `md:grid-cols-2`.

### List Page (issues, machines)

`max-w-7xl` -- Filters + card grid `md:grid-cols-2 lg:grid-cols-3`.

### Detail Page with Sidebar (issue detail)

`grid md:grid-cols-[minmax(0,1fr)_320px]` -- Sidebar `hidden md:block`, collapses to inline strips on mobile.

### Detail Page with Internal Grid (machine detail)

`max-w-6xl` -- Single card body uses `lg:grid-cols-2` internally.

### Form Page (report, create machine)

`max-w-2xl` -- Form inside a card, back button + title in header.

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

## 6. Spacing Rhythm

### Page-Level Vertical Padding

| Context                   | Value           |
| :------------------------ | :-------------- |
| Standard pages            | `py-10`         |
| Settings / forms          | `py-6`          |
| Detail pages (mobile-adj) | `py-4 sm:py-10` |

### Horizontal Padding

MainLayout provides `px-4 sm:px-8 lg:px-10`. Pages use `max-w-* mx-auto` only -- do NOT add their own `px-*`.

### Section & Content Gaps

| Context                | Value       |
| :--------------------- | :---------- |
| Standard section gaps  | `space-y-6` |
| Major detail sections  | `space-y-8` |
| Card grids             | `gap-6`     |
| Main + sidebar layouts | `gap-8`     |

### Card Padding

Use shadcn defaults: `CardHeader` (px-6 pt-6 pb-3), `CardContent` (px-6 pb-6). Override only with a documented reason. Compact cards use `p-3`.

## 7. Card & List Patterns

- Cards are full-width tappable links on mobile, grid layout on desktop.
- **Open items:** `bg-card` + `hover:glow-primary` + `border-outline-variant hover:border-primary/50`. (Earlier drafts called for `bg-surface` here, but the cards are content surfaces, not full-width sections — see §2 Surface Hierarchy.)
- **Closed items:** `bg-surface-variant/30`, no glow.
- `IssueCard` has `normal` and `compact` variants -- use `compact` for secondary/nested lists.
- `IssueBadgeGrid` has `variant="normal"` (grid layout) and `variant="strip"` (inline flex).

## 8. Navigation Patterns

### AppHeader (always rendered, two-tier responsive)

- **Wide desktop (>= lg):** Logo, APC logo, nav links (icon+text), spacer, Report Issue (icon+text), HelpMenu, NotificationList, UserMenu.
- **Tablet (md–lg):** Logo, nav links (icon-only), spacer, Report Issue (icon-only), HelpMenu, NotificationList, UserMenu. APC logo hidden.
- **Mobile (< md):** Logo, spacer, NotificationList, UserMenu. Nav links and Report Issue use `hidden md:flex`.
- **Unauthenticated:** NotificationList + UserMenu replaced by Sign In / Sign Up buttons.
- **Admin link:** Inside UserMenu dropdown (role-gated, not a top-level nav item).
- **Icon-only pattern:** Nav text uses `hidden lg:inline` on `<span>`. Icons always visible with `title` for tooltip/a11y.

### HelpMenu (desktop only, in AppHeader)

- Trigger: `HelpCircle` icon button with badge dot when unread changelog entries exist.
- Items: Feedback (Sentry widget), What's New (`/whats-new`), Help (`/help`), About (`/about`).

### BottomTabBar (mobile only, `md:hidden`)

- **Primary tabs:** Dashboard, Issues, Machines, Report Issue.
- **More tab:** Opens `Sheet` (bottom drawer) with Feedback, What's New, Help, About, Admin (role-gated).

### Shared rules

- **Active state:** `text-primary`.
- **Inactive state:** `text-muted-foreground hover:text-primary`.
- Active detection uses `isNavItemActive()` from `nav-utils.ts` with pathname matching and special cases (e.g., issue detail highlights the Issues tab).

### Testing Responsive Behavior

- **Overflow assertions:** `assertNoHorizontalOverflow(page)` in `e2e/support/actions.ts` checks `document.scrollWidth <= document.clientWidth`. Every new page must be added to `e2e/smoke/responsive-overflow.spec.ts`.
- **Container query testing:** Playwright can force a container width: `await page.evaluate(() => { document.querySelector('[data-testid="content-wrapper"]')!.style.width = '576px'; })` — triggers `@xl:` breakpoints independently of viewport.
- **Chrome DevTools:** Container query overlays available in Elements panel → "container" badge on `@container` elements.

## 9. Typography Scale

| Element                    | Classes                                                                  |
| :------------------------- | :----------------------------------------------------------------------- |
| Page title (desktop)       | `text-3xl font-bold`                                                     |
| Page title (mobile detail) | `text-xl font-extrabold`                                                 |
| Section heading            | `text-xl font-semibold`                                                  |
| Card title (normal)        | `text-base`                                                              |
| Card title (compact)       | `text-sm`                                                                |
| Metadata / labels          | `text-xs text-muted-foreground`                                          |
| Issue IDs                  | `font-mono` (e.g., AFM-3)                                                |
| Machine name in cards      | `text-xs font-medium underline decoration-primary/30 underline-offset-2` |

**Text wrapping (text-balance / text-pretty):**

- `text-balance` on headings that may wrap onto multiple lines (page titles, card titles, dialog titles, hero copy, section headings).
- `text-pretty` on multi-line body copy that may wrap (card descriptions, alert/dialog descriptions, PageHeader subtitles, auth intro copy, feature descriptions).
- Skip both for short definitely-single-line labels, table cells, badge/chip labels, and legends.

The shared primitives (`CardTitle`/`CardDescription`, `AlertTitle`/`AlertDescription`, `DialogTitle`/`DialogDescription`, `AlertDialogTitle`/`AlertDialogDescription`, `EmptyState`, `PageHeader`) bake these in by default — call sites rarely need to add them manually.

## 10. Border & Divider Rules

| Context            | Treatment                              |
| :----------------- | :------------------------------------- |
| Navigation chrome  | `border-primary/50`                    |
| Content cards      | `border-outline-variant`               |
| Form sections      | `Separator` component                  |
| Page header bottom | `border-b border-outline-variant pb-6` |

## 11. Transition Durations

Two canonical durations standardize all animated feedback:

| Intent                                | Duration | Class          | Typical use                                 |
| ------------------------------------- | -------- | -------------- | ------------------------------------------- |
| Hover feedback, color shifts          | 150ms    | `duration-150` | Button hover, text color, icon state        |
| Layout changes, structural animations | 300ms    | `duration-300` | Panel slides, accordion expand, drawer open |

**Property selection:** Prefer specific transitions over `transition-all` — list the properties that actually animate. This improves performance and clarity.

- `transition-colors duration-150` for button hovers, link colors, icon fills
- `transition-opacity duration-150` for opacity-only reveals (badges, icons)
- `transition-transform duration-150` for small rotations (chevrons, badges)
- When a single element animates multiple properties (e.g. colors + a focus ring's box-shadow, or colors + a pressed-state transform), use the bracket syntax: `transition-[color,background-color,border-color,box-shadow] duration-150`
- For layout shifts (drawers, accordions, height/width transitions), prefer the specific property list with `duration-300`: `transition-[height,width] duration-300`, `transition-[grid-template-rows] duration-300`, etc. Reserve `transition-all duration-300` for cases where the set of animating properties genuinely isn't enumerable.

**Rule:** Never introduce a duration other than 150 or 300 unless the canonical two genuinely don't fit. If you find an edge case, add a new row to this table first, document the use case, then use it consistently across similar elements.

## 12. Component Inventory

Before building something new, check if one of these already exists:

| Component                             | Purpose                                                                                         |
| :------------------------------------ | :---------------------------------------------------------------------------------------------- |
| `AppHeader`                           | Two-tier responsive header. Icon-only nav at `md:`, icon+text at `lg:`. APC logo at `lg:` only. |
| `HelpMenu`                            | Dropdown with Feedback, What's New, Help, About. Badge dot for unread changelog.                |
| `BottomTabBar`                        | Mobile tab bar (`md:hidden`). Dashboard, Issues, Machines, Report, More.                        |
| `IssueBadgeGrid`                      | Status/severity/priority/frequency display                                                      |
| `IssueBadge`                          | Individual status badge with color                                                              |
| `IssueCard`                           | Issue summary card (normal/compact)                                                             |
| `IssueRow`                            | Table row variant of issue display                                                              |
| `SidebarActions`                      | Issue metadata editing (compact/full, rowLayout)                                                |
| `SaveCancelButtons`                   | Form action buttons                                                                             |
| `Card` / `CardHeader` / `CardContent` | shadcn/ui card                                                                                  |
| `Sheet`                               | Bottom drawer (mobile "More" menu)                                                              |
| `NotificationList`                    | Notification bell + dropdown                                                                    |
| `UserMenu`                            | Avatar + dropdown menu (includes Admin link for admin role)                                     |
| `BackToIssuesLink`                    | Breadcrumb back navigation                                                                      |
| `EmptyState`                          | Icon + title + optional body + optional action. `variant="card"` (default) or `variant="bare"`. |
| `Alert` (shadcn)                      | Inline message. `variant="destructive"` for errors. Never hand-roll `<div role="alert">`.       |
| `Skeleton` (shadcn)                   | Loading placeholder. Shape it like the content that will arrive.                                |

## 13. Cross-Cutting UI States

Every page will eventually need one of these three states: empty, loading, error. Each has a canonical pattern. Reach for the pattern first; don't invent a variant.

### Empty State

> **Status — planned component, not yet implemented.** `<EmptyState>` **will live** at `~/components/ui/empty-state`; the file doesn't exist today. Extraction is tracked as **PP-yxw.5** (Wave 2a of the consistency pass). This section specifies the contract that PR will build to. Until the component lands, existing inline empty states stay where they are; new code should wait for the component rather than hand-rolling another inline variant.

Once the component is in place: use `<EmptyState>` whenever a list, collection, or section has zero items to display.

| Prop          | Purpose                                                              |
| :------------ | :------------------------------------------------------------------- |
| `icon`        | A `lucide-react` icon. Rendered at `size-12` in a muted circle.      |
| `title`       | Short heading (e.g., "No machines yet", "No issues found").          |
| `description` | Optional body text. Explain what would populate this section.        |
| `action`      | Optional CTA — typically a `<Button>` or `<Link>` styled as such.    |
| `variant`     | `"card"` (default, wraps in `<Card>`) or `"bare"` (plain container). |

**When to use each variant:**

- `variant="card"` — the empty state IS the content of the section. Dashboard widgets, standalone "no results" pages.
- `variant="bare"` — the empty state is rendered inside a list that's already wrapped in a `Card` or container. No double-border effect.

**Rules:**

- Never hand-roll an empty state with a raw `<div>` + icon + heading. Always use `<EmptyState>`.
- Icon should be a single lucide icon — not a composition or custom SVG.
- Keep the title under 40 characters. If you need more, use `description`.
- Provide an `action` only if the user can do something productive from here (e.g., "Report the first issue"). Don't provide dead-end CTAs.
- For filtered-result empty states ("no matches for your filter"), the action should be "Clear filters" or similar.

### Loading State

Prefer `<Skeleton>` rectangles shaped like the content that will appear. Skeletons reduce layout shift and communicate progress better than spinners.

| Situation                                    | Use                                                         |
| :------------------------------------------- | :---------------------------------------------------------- |
| Async data not yet available (lists, tables) | `<Skeleton>` rectangles matching the shape of incoming rows |
| In-flight form submission                    | `<Button loading>` — handles spinner + disabled state       |
| Long-running background work                 | Toast with an inline spinner / progress indicator           |
| Optimistic UI (actions with predictable end) | Update immediately, revert on error                         |

**Rules:**

- **No custom spinners outside Button.** Don't import `<Loader2>` or similar directly into components. If you need one, use Button's `loading` prop.
- **Skeletons match shape, not count.** Render 3-5 skeleton rows at most; real data decides the true count.
- **No `loading.tsx` files unless a route takes >500ms to stream initial HTML.** Most pages render fast enough that a skeleton-shaped flicker is worse than the brief "empty for a moment" state.
- **In-place updates stay silent.** A button that toggles a flag doesn't need a skeleton — just update the UI.

### Error State

Three tiers based on scope. Pick the narrowest one that fits.

| Scope                           | Pattern                                                                |
| :------------------------------ | :--------------------------------------------------------------------- |
| Form-level (submission failed)  | `<Alert variant="destructive"><AlertDescription>` at top of form       |
| Field-level (one field invalid) | `<FormMessage>` (react-hook-form) or inline `text-sm text-destructive` |
| Inline list edit (cell update)  | `toast.error("Failed to update X")`                                    |
| Entire route crashed            | `error.tsx` boundary (already implemented)                             |
| Route not found                 | `not-found.tsx` boundary (already implemented)                         |

**Rules:**

- **Never hand-roll `<div role="alert" className="rounded-md border border-red-900/50...">`.** Use `<Alert variant="destructive">` — it already exists in `~/components/ui/alert`.
- **Form-level errors should be announced at the top of the form**, not buried near the submit button. Screen reader users need the error to appear above the inputs.
- **Provide a recovery path.** "Try again" button, a link to contact support, or instructions on what to fix.
- **Don't use toast for form-level errors.** Toasts dismiss themselves and are easy to miss. Use them only for transient async events.

## 14. Feedback Decision Tree

When something happens in response to user action, where should they see feedback?

| What happened                                     | Where to show feedback                                                                              |
| :------------------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| Form submit success → redirect                    | Server Action does the write, then `redirect(...)`; if needed, show success on the destination page |
| Form submit success → stay on page (settings)     | Return success state from the Server Action; `<SaveCancelButtons>` green flash (3s "Saved!")        |
| Form submit error                                 | `<Alert variant="destructive">` at top + `<FormMessage>` under fields                               |
| Field validation error (Zod)                      | Inline `<FormMessage>`                                                                              |
| Inline list edit (status change, priority change) | `toast` for both success and error                                                                  |
| Optimistic action (toggle, bookmark)              | Immediate UI update; `toast.error()` on failure                                                     |
| Long-running background work (uploads)            | Toast with progress indicator                                                                       |
| Short in-place work (counter increment)           | Immediate UI update, no notification                                                                |

**Why server-side redirect instead of `toast.success() + router.push()`?** The project's progressive-enhancement rule (AGENTS.md #5) requires forms to work without JavaScript. `<form action={serverAction}>` + server-side `redirect(...)` works with JS off; a `toast.success()` + `router.push()` pattern only fires after hydration. If a success toast is genuinely needed on the destination page, persist a one-time success state (e.g., via a search param or short-lived cookie read in the destination route) and render it there.

**Rule of thumb:** If the user initiated it and waited → feedback. If it was instant or invisible → no feedback.

**Why not toast for everything?** Toasts are ephemeral and noisy. Use them for transient events (row updated, file uploaded). Use inline alerts for persistent state (form has errors, save failed, retry needed).

**Why `<SaveCancelButtons>` has its own success flash instead of a toast?** Settings pages don't redirect, so a toast would disappear while the user is still looking at the form. A button that briefly turns green keeps the feedback anchored to the action.

## 15. Date Formatting Vocabulary

> **Status — implemented.** Three canonical helpers live in `src/lib/dates.ts`. Use the helpers below. Never call `formatDistanceToNow` or `toLocaleDateString` directly from a component.

| Helper                 | Output                         | When to use                                                  |
| :--------------------- | :----------------------------- | :----------------------------------------------------------- |
| `formatRelative(date)` | `"3 days ago"`, `"in 2 hours"` | Activity timestamps — comments, issue updates, notifications |
| `formatDate(date)`     | `"Apr 17, 2026"`               | Absolute dates in detail views, created-at fields            |
| `formatDateTime(date)` | `"Apr 17, 2026, 9:30 PM"`      | Admin audit logs, precise timestamps, debug info             |

All three accept `Date | string | number`. For `null` / `undefined` dates, null-guard at the call site and choose a context-appropriate placeholder (e.g., hiding the element, rendering `"—"`, or using a semantic placeholder like `"never"`).

**Why a vocabulary instead of raw calls?**

- **Consistency.** "2 days ago" and "Apr 17" look the same everywhere.
- **Locale safety.** `toLocaleDateString()` renders differently per locale, which breaks visual regression tests.
- **Refactor leverage.** If we ever switch from `date-fns` to `Temporal` or add tooltips showing absolute dates on hover, we change one file.

**Don't:** build custom formatting helpers per feature. If `formatRelative` / `formatDate` / `formatDateTime` don't cover a case, expand the vocabulary rather than inlining a new variant.

## 16. Icon Library

`lucide-react` is the only icon library for new work. Do not introduce new inline SVGs, and do not import icons from other libraries. Some existing inline `<svg>` usage is legacy (signup confirmation state, AssigneePicker chevron, NotificationList dismiss icon); when you touch those areas, prefer migrating them to `lucide-react` opportunistically where doing so does not change behavior.

### Sizing

| Class           | Usage                                                                 |
| :-------------- | :-------------------------------------------------------------------- |
| `size-4` (1rem) | Default inline, buttons, nav links, table cells                       |
| `size-5`        | Heading emphasis (CardTitle/DialogTitle with leading icon)            |
| `size-6`        | Callouts, prominent indicators                                        |
| `size-8`        | Section decorative                                                    |
| `size-10`+      | EmptyState icons (rendered at `size-12` in a muted circle), hero uses |

**Critical rule:** Use `size-*`, never `h-* w-*`. The `size-*` utility is Tailwind v4 canon; `h-4 w-4` is legacy and creates two classes where one would do.

**Buttons auto-size icons.** `<Button>` has `[&_svg:not([class*='size-'])]:size-4` built in, so you don't need to specify `size-4` on an icon child. Only add an explicit size if you're overriding.

**Color:** Icons inherit from parent text color. Add `text-*` to the parent or the icon itself; don't use `fill=` or `stroke=` overrides.

**Accessibility:** Icon-only buttons must have `aria-label` or a visible `<span className="sr-only">`. Nav icons that are part of a labeled nav item (`<Link>` with text that may be hidden at some breakpoints) should have `title` as a tooltip fallback.

## 17. Modal Archetypes

Two canonical modal patterns. Use shadcn primitives directly; don't extract a composite unless duplication exceeds rule-of-three.

### FormDialog pattern (create/edit in a modal)

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button variant="outline">Edit</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Edit machine</DialogTitle>
      <DialogDescription>Update the name and location.</DialogDescription>
    </DialogHeader>
    <form action={updateMachine} className="space-y-4">
      <!-- fields -->
      <DialogFooter>
        <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### ConfirmDialog pattern (destructive confirmations)

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete machine?</AlertDialogTitle>
      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={deleteMachine}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Sizing

| Size    | Class                 | Use case                                    |
| :------ | :-------------------- | :------------------------------------------ |
| Default | (no override)         | Short confirmation prompts                  |
| Medium  | `sm:max-w-lg`         | Most forms (2-6 fields)                     |
| Large   | `sm:max-w-xl` / `2xl` | Forms with rich content (editors, previews) |

### Footer layout

`DialogFooter` uses `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`. Write the buttons in source order as `[Cancel, Save]` (or `[Cancel, Delete]` for AlertDialog). That renders:

- **Mobile** (`flex-col-reverse`): primary action (Save/Delete) on top, Cancel below. The reversal intentionally puts the primary action above the fold / closer to the focus point for small-screen readers.
- **Desktop** (`sm:flex-row sm:justify-end`): horizontal row on the bottom-right, Cancel left, primary action rightmost — matching the standard "primary action anchors the right edge" convention.

Do not reorder the buttons to try to "fix" the mobile stack — the reversal is by design.

### Rules

- Never build a custom `Modal` or `Drawer` component — Dialog / AlertDialog / Sheet cover every case.
- Never put a `<form>` inside a `DropdownMenuItem` — Radix closes the dropdown before the form submits. Use `onSelect={() => serverAction()}` instead.
- Never wrap a Server Action in an inline async function: `action={async () => await serverAction()}` breaks progressive enhancement. Pass the Server Action directly: `action={serverAction}`.
- For destructive confirmations, use `AlertDialog` — it has semantics (`role="alertdialog"`) that screen readers announce more urgently.

## 18. Token Canonical Form

`globals.css` defines two parallel token vocabularies. The MD-era tokens predate Tailwind v4's semantic token naming and are kept in CSS for backward compatibility, but new code must use the canonical Tailwind semantic tokens.

| MD-era (deprecated in code) | Canonical Tailwind semantic |
| :-------------------------- | :-------------------------- |
| `text-on-surface`           | `text-foreground`           |
| `text-on-surface-variant`   | `text-muted-foreground`     |
| `bg-error-container`        | `bg-destructive/10`         |
| `text-on-error-container`   | `text-destructive`          |

**Rules:**

- **New code uses the canonical tokens.** No exceptions.
- **When editing a file that uses deprecated tokens, migrate them as part of the change.** Opportunistic cleanup — don't go out of your way, but don't leave deprecated tokens next to your edits.
- **CSS variable definitions stay.** The deprecated tokens are still defined in `globals.css`; existing code keeps working during migration. Eventually the MD-era tokens will be removed, but not in a single sweep.
- **Exception: `bg-surface-variant/30`.** The dimmed/closed item surface (Section 2) has no Tailwind-semantic equivalent and is intentional design. Keep it.

### Quick cheatsheet

| Need                        | Use                     |
| :-------------------------- | :---------------------- |
| Body text                   | `text-foreground`       |
| Secondary / helper text     | `text-muted-foreground` |
| Primary accent (links/CTAs) | `text-primary`          |
| Error text                  | `text-destructive`      |
| Primary CTA background      | `bg-primary`            |
| Subtle background           | `bg-muted`              |
| Destructive CTA background  | `bg-destructive`        |
| Destructive container bg    | `bg-destructive/10`     |
| Card background             | `bg-card`               |
| Dimmed/closed item          | `bg-surface-variant/30` |
