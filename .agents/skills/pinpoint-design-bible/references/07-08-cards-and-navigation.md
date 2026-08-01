# Cards, Lists & Navigation (§7–§8)

Card/list surface rules and the AppHeader / HelpMenu / BottomTabBar navigation contract.

## 7. Card & List Patterns

- Cards are full-width tappable links on mobile, grid layout on desktop.
- **Open items:** `bg-card` + `hover:glow-primary` + `border-outline-variant hover:border-primary/50`. (Earlier drafts called for `bg-surface` here, but the cards are content surfaces, not full-width sections — see §2 Surface Hierarchy.)
- **Closed items:** `bg-surface-variant/30`, no glow.
- `IssueCard` has `normal` and `compact` variants -- use `compact` for secondary/nested lists.
- `IssueBadgeGrid` has `variant="normal"` (grid layout) and `variant="strip"` (inline flex).

## 8. Navigation Patterns

### AppHeader (always rendered, two-tier responsive)

- **Wide desktop (>= lg):** Logo, APC logo, nav links (Dashboard, Machines, Issues — icon+text), spacer, Report Issue button (secondary variant, icon+text), HelpMenu, NotificationList, UserMenu.
- **Tablet (md–lg):** Logo, nav links (Dashboard, Machines, Issues — icon-only), spacer, Report button (secondary variant, icon + "Report" label), HelpMenu, NotificationList, UserMenu. APC logo hidden.
- **Mobile (< md):** Logo, spacer, NotificationList, UserMenu. Nav links and Report Issue use `hidden md:flex`.
- **Unauthenticated:** NotificationList + UserMenu replaced by Sign In / Sign Up buttons.
- **Admin link:** Inside UserMenu dropdown (role-gated, not a top-level nav item).
- **Icon-only pattern:** Nav text uses `hidden lg:inline` on `<span>`. Icons always visible with `title` for tooltip/a11y.

### HelpMenu (desktop only, in AppHeader)

- Trigger: `HelpCircle` icon button with badge dot when unread changelog entries exist.
- Items: Feedback (Sentry widget), What's New (`/whats-new`), Help (`/help`), About (`/about`).

### BottomTabBar (mobile only, `md:hidden`)

- **Primary tabs:** Dashboard, Machines, Issues, Report Issue. Order matches the desktop `AppHeader` because `BottomTabBar` spreads the same `NAV_ITEMS` array.
- **More tab:** Opens `Sheet` (bottom drawer) with Feedback, What's New, Help, About, Admin (role-gated).

### Shared rules

- **Active state:** `text-primary`.
- **Inactive state:** `text-muted-foreground hover:text-primary`.
- Active detection uses `isNavItemActive()` from `nav-utils.ts` with pathname matching and special cases (e.g., issue detail highlights the Issues tab).

### Testing Responsive Behavior

- **Overflow assertions:** `assertNoHorizontalOverflow(page)` in `e2e/support/actions.ts` checks `document.scrollWidth <= document.clientWidth`. Every new page must be added to `e2e/smoke/responsive-overflow.spec.ts`.
- **Container query testing:** Playwright can force a container width: `await page.evaluate(() => { document.querySelector('[data-testid="content-wrapper"]')!.style.width = '576px'; })` — triggers `@xl:` breakpoints independently of viewport.
- **Chrome DevTools:** Container query overlays available in Elements panel → "container" badge on `@container` elements.
