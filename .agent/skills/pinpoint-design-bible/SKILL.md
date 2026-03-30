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

| When building...                      | Use                               |
| :------------------------------------ | :-------------------------------- |
| Page background                       | `bg-background` (#0f0f11)         |
| Full-width content section            | `bg-surface` (#0f0f11)            |
| Card, popover, elevated container     | `bg-card` (#18151b, fully opaque) |
| Header, sidebar, tab bar (nav chrome) | `bg-card/85 backdrop-blur-sm`     |
| Closed/archived/dimmed item           | `bg-surface-variant/30`           |

**Key distinction:** Navigation chrome gets the frosted glass treatment (opacity + blur). Content cards are always fully opaque `bg-card`.

## 3. Mobile Shell Contract

These values are fixed. Do not deviate.

| Element           | Value                                                                                                                                    |
| :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| Header height     | 52px, `sticky`, `z-20`                                                                                                                   |
| Bottom tab bar    | 56px min-height, `fixed`, `z-50`                                                                                                         |
| Tab bar safe      | `env(safe-area-inset-bottom)` padding                                                                                                    |
| Content bottom    | `pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0`                                                                                    |
| Scroll padding    | `scroll-pt-[52px] md:scroll-pt-0`                                                                                                        |
| Mobile/desktop    | `md:` (768px) is THE breakpoint. Only applies on phones (`pointer: coarse`).                                                             |
| Desktop min-width | `@media (pointer: fine)` enforces `min-width: 1088px` on `html`. Desktop never hits the mobile breakpoint — horizontal scroll instead.   |
| Sidebar collapse  | Sidebar auto-collapses at viewport < 1280px (1024px content + 256px open sidebar). Below 1088px (1024px + 64px collapsed), page scrolls. |

**If you add a new page:** it MUST include the content bottom padding or content will be hidden behind the tab bar on mobile.

## 4. Responsive Strategy

| Breakpoint | Role                  | Example                            |
| :--------- | :-------------------- | :--------------------------------- |
| `md:`      | Primary layout shift  | Single column to multi-column      |
| `sm:`      | Secondary tweaks only | Padding adjustments, minor spacing |
| `lg:`      | Optional enhancements | Extra grid column, wider sidebar   |

**Rules:**

- When hiding/showing for mobile vs desktop, use `md:hidden` / `hidden md:block`.
- NEVER use `lg:` as the primary layout shift -- `md:` is always the pivot.
- Mobile-first: write the mobile layout, then add `md:` overrides.
- **Desktop never goes mobile:** `globals.css` sets `min-width: 1088px` on `html` for `pointer: fine` devices. Desktop browsers always show sidebar + desktop header. Sidebar auto-collapses below 1280px viewport; below 1088px, horizontal scroll. Phones (`pointer: coarse`) are unaffected.

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

- **Mobile primary nav:** Bottom tab bar (Dashboard, Issues, Machines, Report).
- **Overflow items:** `Sheet` component (bottom drawer) triggered by "More" tab.
- **Active tab:** `text-primary`.
- **Inactive tab:** `text-muted-foreground hover:text-primary`.
- Tab active detection uses pathname matching with special cases (e.g., issue detail highlights the Issues tab).

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

| Component                             | Purpose                                          |
| :------------------------------------ | :----------------------------------------------- |
| `IssueBadgeGrid`                      | Status/severity/priority/frequency display       |
| `IssueBadge`                          | Individual status badge with color               |
| `IssueCard`                           | Issue summary card (normal/compact)              |
| `IssueRow`                            | Table row variant of issue display               |
| `SidebarActions`                      | Issue metadata editing (compact/full, rowLayout) |
| `SaveCancelButtons`                   | Form action buttons                              |
| `Card` / `CardHeader` / `CardContent` | shadcn/ui card                                   |
| `Sheet`                               | Bottom drawer (mobile "More" menu)               |
| `NotificationList`                    | Notification bell + dropdown                     |
| `UserMenu`                            | Avatar + dropdown menu                           |
| `FeedbackWidget`                      | Feedback button + form                           |
| `BackToIssuesLink`                    | Breadcrumb back navigation                       |
