# Cards, Lists & Navigation (§7–§8)

Card/list surface rules and the AppHeader / HelpMenu / BottomTabBar navigation contract.

## 7. Card & List Patterns

- Cards are full-width tappable links on mobile, grid layout on desktop.
- **Open items:** `bg-card` + `hover:glow-primary` + `border-outline-variant hover:border-primary/50`. `bg-card` and not `bg-surface`: a card is a _content surface_, not a full-width section, and §2 assigns those different levels. An earlier draft of this rule said `bg-surface`, which is why some existing cards still read that way — **the rule is `bg-card`, and a `bg-surface` card you find in the tree is residue from the old rule, not a counter-example to follow.**
- **Closed items:** `bg-surface-variant/30`, no glow. The glow is an interactivity affordance; a closed item is still navigable but shouldn't advertise itself.
- Card and badge variants (`compact`, `strip`, …) are declared on the components themselves — use `compact` for secondary/nested lists.

## 8. Navigation Patterns

**Where the nav actually is:** `src/components/layout/nav-config.ts` holds the one `NAV_ITEMS` array; `AppHeader.tsx` and `BottomTabBar.tsx` both read it. Those three files are the answer to "what's in the nav, and where does each thing appear" — this section deliberately does not keep a second copy of the item list, the breakpoint tiers, or the "More" menu contents, because that copy went stale twice.

What is recorded here is the reasoning you can't recover by reading them:

- **One shared array, filtered per surface.** Both navs read `NAV_ITEMS`; the bottom bar filters rather than maintaining its own list, so tab order tracks the desktop header for free and a new destination can't be added to one nav and forgotten in the other. When you add a destination, add it to `nav-config.ts` and decide only whether it's dense enough to earn a bottom-tab slot — that flag is the whole decision surface.
- **Breakpoint tiers are fitted, not derived.** Each piece of header chrome appears at the breakpoint where the row stops overflowing, which depends on how many siblings compete for it. `AppHeader.tsx` carries an inline comment recording the constraint behind its nav-label tier; that comment exists because a lower, more "obvious" breakpoint was tried and overflowed. Do not adjust a tier to match a spec — measure.
- **The mobile "More" surface is a `Drawer`, not a `Sheet`.** `~/components/ui/drawer` wraps **vaul**, chosen for swipe-to-close and momentum on touch; `~/components/ui/sheet` is a different component on Radix Dialog. The names invite the mistake and the two are not interchangeable.
- **Admin is inside a menu, never a top-level nav item** — in the UserMenu dropdown on desktop and the "More" drawer on mobile, role-gated in both. Admin destinations don't get promoted to primary navigation for the small minority who can see them.
- **Unauthenticated:** NotificationList + UserMenu are replaced by Sign In / Sign Up.
- **Icon-only nav links still need names.** When the text label is hidden by breakpoint the link would otherwise have no accessible name, so each carries an `aria-label` and the visible label is `aria-hidden` to stop the name doubling up when it _is_ showing.

### HelpMenu (desktop only, in AppHeader)

Icon trigger with a badge dot when unread changelog entries exist. Its items are the secondary/informational destinations — the same set the mobile "More" drawer carries. Keep the two in sync when you add one.

### Shared rules

- **Active state:** `text-primary`.
- **Inactive state:** `text-muted-foreground hover:text-primary`.
- Active detection uses `isNavItemActive()` from `nav-utils.ts` with pathname matching and special cases (e.g., issue detail highlights the Issues tab).

### Testing Responsive Behavior

- **Overflow assertions:** `assertNoHorizontalOverflow(page)` lives in `e2e/support/actions.ts`; §4 records what it actually asserts, and why the `scrollWidth` half of it can never fail under the app shell. Every new page must be added to `e2e/smoke/responsive-overflow.spec.ts`.
- **Container query testing:** Playwright can force a container width: `await page.evaluate(() => { document.querySelector('[data-testid="content-wrapper"]')!.style.width = '576px'; })` — triggers `@xl:` breakpoints independently of viewport.
- **Chrome DevTools:** Container query overlays available in Elements panel → "container" badge on `@container` elements.
