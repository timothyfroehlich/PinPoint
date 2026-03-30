# Desktop Layout Stability: Custom Variant + Container Queries

## Context

PinPoint uses `md:` (768px) viewport breakpoints to toggle between mobile shell (tab bar + mobile header) and desktop shell (sidebar + desktop header). When a desktop browser window is shrunk below 768px, the entire UI flips to the mobile layout. Tim wants to eliminate this — desktop browsers should always show the desktop shell regardless of window width.

**Previous attempt failed** because `min-width` on `html` does not affect CSS viewport media queries. `@media (min-width: 768px)` always checks the browser window width, not the element's computed width. The mobile shell still appeared at narrow widths.

**The fix**: Replace `md:` with a `@custom-variant desktop` based on `@media (pointer: fine)` for all mobile/desktop shell toggles. Desktop browsers (mouse/trackpad) always match `pointer: fine`, so the desktop shell always shows regardless of window width. Phones (`pointer: coarse`) still get the mobile shell.

Content-level layout adjustments (grids, flex direction, padding) use **container queries** (`@container` / `@xl:` / `@lg:`) so components respond to their actual container width, not the viewport.

## Step 1: Define `desktop:` custom variant

**File**: `src/app/globals.css`

Add after the `@import "tailwindcss"` line:

```css
@custom-variant desktop {
  @media (pointer: fine) {
    @slot;
  }
}
```

Keep the existing `@media (pointer: fine) { html { min-width: 1088px } }` rule — it creates a horizontal scroll floor at very narrow desktop windows.

Keep the existing `@media (pointer: coarse) { html, body { overflow-x: hidden; max-width: 100vw } }` rule.

## Step 2: Convert shell components to `desktop:` variant

**These 5 files control the app shell — replace `md:` with `desktop:` on mode-switch classes only.**

### `src/components/layout/MainLayout.tsx`

- Line 138: `hidden md:block h-full` → `hidden desktop:block h-full` (sidebar)
- Line 150: `scroll-pt-[52px] md:scroll-pt-0` → `scroll-pt-[52px] desktop:scroll-pt-0` (scroll padding)
- Line 163: `hidden md:flex h-16 ...` → `hidden desktop:flex h-16 ...` (desktop header)
- Line 196: `md:pb-0` → `desktop:pb-0` (remove tab bar bottom padding)

### `src/components/layout/MobileHeader.tsx`

- Line 37: `md:hidden flex h-[52px] ...` → `desktop:hidden flex h-[52px] ...`

### `src/components/layout/BottomTabBar.tsx`

- Line 82: `md:hidden fixed ...` → `desktop:hidden fixed ...`

## Step 3: Convert page-level mode switches to `desktop:`

**Issue detail page** (`src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx`):

- Line 167: `hidden md:block` → `hidden desktop:block` (back link)
- Line 174: `md:hidden` → `desktop:hidden` (mobile nav row)
- Line 190: `hidden ... md:flex` → `hidden ... desktop:flex` (desktop breadcrumbs)
- Line 223: `md:text-3xl` → `desktop:text-3xl` (title size)
- Line 227: `md:hidden` → `desktop:hidden` (mobile metadata)
- Line 276: `md:grid-cols-[minmax(0,1fr)_320px]` → `desktop:grid-cols-[minmax(0,1fr)_320px]` (two-column layout)
- Line 280: `hidden md:block` → `hidden desktop:block` (Activity heading)
- Line 297: `hidden md:block` → `hidden desktop:block` (desktop sidebar panel)

**ImageUploadButton** (`src/components/images/ImageUploadButton.tsx`):

- Line 107: `md:hidden` → `desktop:hidden` ("Take Photo" camera button — only on phones)

**Other pages with mode switches** — grep for remaining `md:hidden`/`hidden md:block` patterns in page files and convert. The grep results show these are concentrated in the issue detail page; other pages primarily use `md:` for layout grids (which become container queries, not desktop: variants).

## Step 4: Container queries for content layout (partially done)

**Already converted** in the issue detail pilot:

- `@container` on MainLayout content wrapper (line 196)
- `@container` on issue detail content section (line 277)
- IssueTimeline: avatar column `@xl:flex`, spacing `@xl:gap-4`/`@xl:space-y-6`, padding `@lg:p-6`/`@lg:pl-6`, connector line `@xl:block`, margins `@xl:ml-20`
- AddCommentForm: `@xl:flex-row`/`@xl:items-center`/`@xl:justify-between`/`@xl:gap-4`, `@xl:max-w-[200px]`
- ImageGallery: `@lg:grid-cols-3 @2xl:grid-cols-4`
- EditableIssueTitle: `@3xl:text-4xl`/`@3xl:text-3xl` fallbacks

**Still needs conversion** (can be done in this step or deferred to separate commits):

- Dashboard page: `md:grid-cols-3` / `md:grid-cols-2` grids → container queries
- Machines list: `md:grid-cols-2 lg:grid-cols-3` grid → container queries
- Machine detail: `sm:flex-row` headers → container queries
- MachineFilters: `md:flex-row` / `sm:w-48` / `sm:flex` → container queries
- IssueFilters: `md:grid-cols-3 lg:grid-cols-6` → container queries
- Issues page: `sm:flex-row` header → container queries
- IssueCard: `sm:flex-row` → container queries
- IssueBadgeGrid: `sm:grid-cols-2` → container queries
- Report form: `lg:grid-cols-12` → container queries
- Settings forms: grid layouts → container queries
- Help page: card grid → container queries

## Step 5: Update design bible

**File**: `.agent/skills/pinpoint-design-bible/SKILL.md`

Update sections 3 and 4:

- Document the `desktop:` variant — use for mobile/desktop mode switches
- Document container queries — use for content layout adjustments inside containers
- Keep `md:` documented as the mobile-only breakpoint (still used on phones via viewport)
- Document the three-layer responsive strategy: `desktop:` for shell, `@container` for content layout, viewport `sm:`/`md:`/`lg:` only inside `@media (pointer: coarse)` contexts

## Step 6: Update sidebar auto-collapse thresholds

The sidebar auto-collapse logic in `Sidebar.tsx` (already implemented) uses `window.innerWidth < 1280` to force collapse. This stays as-is — it's JavaScript, not CSS, so it correctly reads the viewport width.

## Verification

1. `pnpm run check` — all 750 tests must pass
2. Manual testing on desktop:
   - Shrink window to ~800px → sidebar auto-collapses, desktop shell stays, NO mobile shell
   - Shrink to ~600px → horizontal scrollbar appears, desktop shell stays
   - Issue detail page: resize and verify NO reflow of timeline, comment form, image gallery
3. Manual testing on phone (or Chrome DevTools device mode with touch emulation):
   - Mobile shell appears (tab bar, mobile header)
   - No sidebar, responsive content layout works
4. `pnpm run preflight` before commit

## Files Modified

- `src/app/globals.css` — `@custom-variant desktop` definition
- `src/components/layout/MainLayout.tsx` — shell toggles → `desktop:`
- `src/components/layout/MobileHeader.tsx` — `desktop:hidden`
- `src/components/layout/BottomTabBar.tsx` — `desktop:hidden`
- `src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx` — mode switches → `desktop:`
- `src/components/images/ImageUploadButton.tsx` — camera button `desktop:hidden`
- `.agent/skills/pinpoint-design-bible/SKILL.md` — documentation
- `src/components/layout/Sidebar.test.tsx` — may need test updates
- Dashboard, machines, issues pages — container query conversions (Step 4)
