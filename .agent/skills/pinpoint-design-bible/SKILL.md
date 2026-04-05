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

PinPoint uses a **dark neon aesthetic** -- deep charcoal backgrounds with neon green and electric purple accents.

| Token              | Value     | Usage                                    |
| :----------------- | :-------- | :--------------------------------------- |
| Primary            | `#4ade80` | Actions, active states, CTAs, links      |
| Secondary          | `#d946ef` | Accents, decorative highlights           |
| Background         | `#0f0f11` | Page background                          |
| Surface            | `#0f0f11` | Content areas, full-width sections       |
| Card               | `#18151b` | Elevated containers (subtle purple tint) |
| Surface-variant/30 | --        | Dimmed/closed items                      |

**Rules:**

- When you need a color, use a CSS variable (`text-primary`, `bg-card`) -- never hardcode hex.
- Status colors come from `STATUS_CONFIG` -- never freestyle status colors.
- Glow effects (`glow-primary`, `glow-secondary`) are for interactive hover states only, never static decoration.
- Frosted glass (bg-card with opacity + `backdrop-blur-sm`) is reserved for navigation chrome.

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
- **Open items:** `bg-surface` + `hover:glow-primary` + `border-outline-variant hover:border-primary/50`.
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

## 10. Border & Divider Rules

| Context            | Treatment                              |
| :----------------- | :------------------------------------- |
| Navigation chrome  | `border-primary/50`                    |
| Content cards      | `border-outline-variant`               |
| Form sections      | `Separator` component                  |
| Page header bottom | `border-b border-outline-variant pb-6` |

## 11. Transition Standards

| Change type          | Use                                                        |
| :------------------- | :--------------------------------------------------------- |
| Hover color change   | `transition-colors` (default 150ms)                        |
| Layout / size change | `transition-all duration-300 ease-in-out`                  |
| Expand / collapse    | `transition-[grid-template-rows] duration-200 ease-in-out` |

**Rule:** Do not use `transition-all` for simple color-only changes -- it is unnecessary and hurts performance.

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
