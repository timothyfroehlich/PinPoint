---
trigger: always_on
---

# PinPoint UI Non-Negotiables

**Last Updated**: March 8, 2026
**Version**: 1.0

## Purpose

Establishes visual and structural consistency across PinPoint's UI. These rules prevent component drift — where each developer invents their own card border style, section heading size, or empty state layout. Drift is invisible until you put two pages side by side.

**Enforcement:** Code review (see `pinpoint-reviewer` agent), `check-non-negotiables` command, and the live style guide at `/debug/` (dev only).

**Extends:** `docs/NON_NEGOTIABLES.md` rules CORE-UI-001..004.

---

## Quick Reference

| Pattern             | Rule        | Short Version                                                 |
| :------------------ | :---------- | :------------------------------------------------------------ |
| Colors              | CORE-UI-005 | `text-warning` not `text-amber-500`                           |
| Page container      | CORE-UI-006 | `max-w-6xl mx-auto py-10 space-y-6`                           |
| Section headings    | CORE-UI-007 | `<h2 className="text-xl font-semibold text-foreground mb-4">` |
| Card structure      | CORE-UI-008 | Always `Card > CardHeader > CardTitle > CardContent`          |
| Card variants       | CORE-UI-009 | Use the 5 canonical card styles                               |
| Empty states        | CORE-UI-010 | `py-12 text-center` + size-12 icon + text-lg message          |
| Buttons             | CORE-UI-011 | Shadcn variants only, no custom backgrounds                   |
| Destructive actions | CORE-UI-012 | `AlertDialog` required for irreversible actions               |
| Icons               | CORE-UI-013 | Lucide only, defined sizes                                    |
| Loading states      | CORE-UI-014 | `Skeleton` component, no spinners                             |
| Domain badges       | CORE-UI-015 | `IssueBadge` for status/severity/priority/frequency           |
| Glow effects        | CORE-UI-016 | Only on interactive surfaces, match semantic color            |

---

## Color System

**CORE-UI-005:** Use semantic CSS variable tokens — never raw Tailwind palette colors in app code.

- **Severity:** High
- **Why:** Raw palette colors (`text-amber-500`, `bg-purple-900`) bypass the design system. When the theme changes, palette colors don't update. CSS variable tokens (`text-warning`, `text-primary`) are themeable and self-documenting.
- **Do:** `text-warning`, `text-primary`, `text-muted-foreground`, `bg-card`, `bg-surface`, `text-success`, `text-destructive`
- **Don't:** `text-amber-500`, `text-purple-900`, `text-cyan-600`, `bg-green-800`, `text-red-500`
- **Exception:** `text-white` and `text-black` for absolute needs (e.g., on a colored button background)

**Available semantic tokens** (from `src/app/globals.css`):

```
Backgrounds:  bg-background, bg-card, bg-surface, bg-surface-variant, bg-muted, bg-accent
Foregrounds:  text-foreground, text-card-foreground, text-muted-foreground, text-on-surface-variant
Primary:      text-primary, bg-primary, text-on-primary, bg-primary-container, text-on-primary-container
Secondary:    text-secondary, bg-secondary, text-on-secondary, bg-secondary-container
Semantic:     text-success, bg-success, bg-success-container, text-on-success-container
              text-warning, bg-warning, bg-warning-container, text-on-warning-container
              text-error / text-destructive, bg-error-container, text-on-error-container
Status:       text-status-new, text-status-in-progress, text-status-unplayable
Borders:      border-border, border-outline, border-outline-variant
```

```tsx
// ❌ FORBIDDEN — bypasses design system
<h2 className="text-amber-500">Severity Variations</h2>
<span className="bg-purple-800 text-white">Badge</span>

// ✅ CORRECT — semantic tokens
<h2 className="text-warning">Severity Variations</h2>
<span className="bg-secondary text-on-secondary">Badge</span>
```

**Reference:** See `/debug/colors` for a live visual of all tokens.

---

## Page Layout

**CORE-UI-006:** All authenticated page content uses the standard page container.

- **Severity:** High
- **Why:** Consistent max-width and vertical rhythm across every page. Prevents each page from having different content widths.
- **Do:**
  ```tsx
  // Standard page container
  <div className="max-w-6xl mx-auto py-10 space-y-6">{/* page sections */}</div>
  ```
- **Don't:** `max-w-4xl`, `max-w-screen-xl`, `px-4 py-8`, custom padding variations
- **Inner section spacing:** Use `space-y-4` for tight groups, `space-y-6` for page-level sections
- **Grid gaps:** Use `gap-4` for dense grids (issue cards), `gap-6` for section grids (stat cards, machine cards)

---

## Section Headings

**CORE-UI-007:** Use a consistent section heading pattern within pages.

- **Severity:** High
- **Why:** The `@layer base` styles for `<h2>` are `text-3xl font-semibold` — appropriate for rich text/MDX content but too large for section headings within an app page. The established pattern uses an explicit size override.

**Pattern for app page section headings:**

```tsx
// ✅ CORRECT — established section heading pattern
<h2 className="text-xl font-semibold text-foreground mb-4">Section Title</h2>
```

**Hierarchy:**

- `h1` — Page title (rare in app; the layout provides navigation context)
- `h2 className="text-xl font-semibold text-foreground mb-4"` — Major page sections (e.g., "Quick Stats", "Recent Issues")
- `h3 className="text-base font-semibold text-foreground"` — Sub-sections within a section
- The `@layer base` heading styles apply to MDX/rich-text pages only (help docs, terms, privacy)

```tsx
// ❌ WRONG — forgetting the override, produces a massive heading
<h2>Quick Stats</h2>

// ❌ WRONG — using a non-semantic element for a heading
<p className="text-xl font-semibold mb-4">Quick Stats</p>

// ✅ CORRECT
<h2 className="text-xl font-semibold text-foreground mb-4">Quick Stats</h2>
```

---

## Card Patterns

**CORE-UI-008:** Always use the shadcn/ui Card composition. Never raw bordered divs.

- **Severity:** High
- **Why:** Raw `<div className="border rounded-lg bg-card p-4">` creates inconsistent padding, border radius, and background. The Card component encapsulates these decisions.
- **Do:** `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>...</CardContent></Card>`
- **Don't:** `<div className="border rounded-lg bg-card">`, adding `p-X` directly to `<Card>` (padding is in CardContent/CardHeader)

---

**CORE-UI-009:** Use the 5 canonical card visual variants. Do not invent new border/glow combinations.

- **Severity:** High
- **Why:** Visual identity comes from consistent card styles. Ad-hoc combinations produce a cluttered look.

**The 5 card variants:**

```tsx
// 1. Neutral (default info card)
<Card className="border-border bg-card">

// 2. Primary action (interactive, navigable)
<Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">

// 3. Success (fixed, completed, healthy state)
<Card className="border-success/30 bg-success/10 glow-success cursor-pointer h-full">

// 4. Warning (attention needed)
<Card className="border-warning/30 bg-warning/10 glow-warning">

// 5. Destructive (critical issue, error state)
<Card className="border-destructive/30 bg-destructive/10 glow-destructive">
```

**Stat card pattern** (number + label):

```tsx
<Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        Open Issues
      </CardTitle>
      <AlertTriangle className="size-4 text-muted-foreground" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold text-foreground">{count}</div>
  </CardContent>
</Card>
```

**Reference:** See `/debug/cards` for live examples of all variants.

---

## Empty States

**CORE-UI-010:** Every list/table/grid must have a standard empty state. No blank screens.

- **Severity:** Required
- **Why:** A blank page with no content is confusing. The empty state tells the user why there's nothing here and what they can do.

**Required structure:**

```tsx
// ✅ CORRECT — standard empty state
<Card className="border-border bg-card">
  <CardContent className="py-12 text-center">
    <SomeIcon className="mx-auto mb-4 size-12 text-muted-foreground" />
    <p className="text-lg text-muted-foreground">No issues yet</p>
    {/* Optional CTA */}
    <Button variant="outline" className="mt-4" asChild>
      <Link href="/issues/new">Report an issue</Link>
    </Button>
  </CardContent>
</Card>
```

**Rules:**

- Icon: `size-12`, `text-muted-foreground`, `mx-auto mb-4`
- Message: `text-lg text-muted-foreground`
- Card padding: `py-12 text-center` on `CardContent`
- Optional CTA button below the message

**Don't:**

```tsx
// ❌ No empty state at all
{issues.length > 0 && issues.map(...)}

// ❌ Custom ad-hoc empty state
<div className="text-center py-8">
  <p className="text-gray-400 text-sm">Nothing here</p>
</div>
```

**Reference:** See `/debug/states` for the live pattern.

---

## Button Usage

**CORE-UI-011:** Only use the defined shadcn/ui Button variants. No custom button styles.

- **Severity:** High
- **Why:** Every bespoke button style is a decision that bypasses the design system. Consistent button variants create a predictable visual hierarchy.

**Variants:**

| Variant       | Use case                                         |
| :------------ | :----------------------------------------------- |
| `default`     | Primary action (submit, confirm, create)         |
| `destructive` | Irreversible delete/remove actions               |
| `outline`     | Secondary action alongside a default button      |
| `secondary`   | Low-emphasis action                              |
| `ghost`       | Tertiary/icon-adjacent action, table row actions |
| `link`        | Inline navigation that reads like text           |

**Sizes:**

| Size      | Use case                                    |
| :-------- | :------------------------------------------ |
| (default) | Most UI actions                             |
| `sm`      | Compact actions in lists, toolbars          |
| `lg`      | Hero CTAs, prominent onboarding actions     |
| `icon`    | Icon-only buttons (always add `aria-label`) |

```tsx
// ❌ FORBIDDEN — custom button styling
<button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
  Save
</button>

// ✅ CORRECT — shadcn/ui variant
<Button>Save</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" size="icon" aria-label="Delete issue">
  <Trash2 className="size-4" />
</Button>
```

---

## Destructive Action Confirmation

**CORE-UI-012:** Irreversible actions require `AlertDialog` confirmation. Never on a single click.

- **Severity:** Critical
- **Why:** A misclick should not delete data. `AlertDialog` forces conscious confirmation.

```tsx
// ❌ FORBIDDEN — single click delete
<Button variant="destructive" onClick={deleteIssue}>Delete Issue</Button>

// ✅ CORRECT — AlertDialog confirmation
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Issue</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Issue?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={deleteIssue}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- **Exception:** Actions with immediate "undo" capability (rare) do not need a dialog.

---

## Icons

**CORE-UI-013:** Always import icons from `lucide-react`. One icon library only.

- **Severity:** High
- **Why:** Mixing icon libraries creates visual inconsistency (different stroke widths, styles, sizes) and increases bundle size.

**Size standards:**

| Size             | Context                                      |
| :--------------- | :------------------------------------------- |
| `size-4` (16px)  | Inline with text, inside buttons, table rows |
| `size-5` (20px)  | Standalone action icons, sidebar nav         |
| `size-12` (48px) | Empty state illustrations                    |

```tsx
// ❌ FORBIDDEN — wrong library
import { FaTrash } from "react-icons/fa";
import TrashIcon from "@heroicons/react/trash";

// ❌ WRONG size — arbitrary pixel values
<Trash2 className="w-[18px] h-[18px]" />

// ✅ CORRECT
import { Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
<Trash2 className="size-4" />  // inline
<AlertTriangle className="size-5" />  // standalone
<CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />  // empty state
```

**Accessibility:** Icon-only elements need `aria-label` or a visually hidden text label:

```tsx
// ❌ Screen readers get nothing
<Button variant="ghost" size="icon">
  <Trash2 className="size-4" />
</Button>

// ✅ Accessible
<Button variant="ghost" size="icon" aria-label="Delete issue">
  <Trash2 className="size-4" />
</Button>
```

---

## Loading States

**CORE-UI-014:** Use `Skeleton` for loading placeholders. No custom spinners or text-only loading indicators.

- **Severity:** Required
- **Why:** Skeleton loaders preserve layout stability (no CLS) and are more informative than a spinner. They tell the user what shape the content will be.

```tsx
import { Skeleton } from "~/components/ui/skeleton";

// ✅ CORRECT — skeleton matches content shape
function IssueRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-5 w-20 rounded-full" /> {/* badge */}
      <Skeleton className="h-4 w-48" /> {/* title */}
      <Skeleton className="h-4 w-24 ml-auto" /> {/* date */}
    </div>
  );
}

// ❌ WRONG — spinner tells user nothing about content shape
function Loading() {
  return (
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  );
}

// ❌ WRONG — text-only loading
function Loading() {
  return <p className="text-muted-foreground">Loading...</p>;
}
```

---

## Domain Badges

**CORE-UI-015:** Use `IssueBadge` for all status, severity, priority, and frequency values.

- **Severity:** High
- **Why:** `IssueBadge` is the single source of truth for domain value colors, labels, and fixed widths. Ad-hoc chips diverge over time.

```tsx
import { IssueBadge } from "~/components/issues/IssueBadge";

// ✅ CORRECT
<IssueBadge type="status" value={issue.status} />
<IssueBadge type="severity" value={issue.severity} />
<IssueBadge type="priority" value={issue.priority} />
<IssueBadge type="frequency" value={issue.frequency} />

// ❌ FORBIDDEN — ad-hoc colored span
<span className="bg-red-600 text-white px-2 py-1 rounded text-xs">
  Unplayable
</span>

// ❌ FORBIDDEN — inline color logic
<Badge className={issue.status === "new" ? "bg-green-500" : "bg-gray-500"}>
  {issue.status}
</Badge>
```

For non-domain badges (e.g., user roles, boolean flags), use shadcn `<Badge>` with the appropriate `variant` prop.

---

## Glow Effects

**CORE-UI-016:** Glow effects must match the semantic meaning of the surface they're on.

- **Severity:** Required
- **Why:** Glows draw the eye. If every card glows, nothing stands out. Semantic mapping (primary=action, success=healthy, destructive=danger) creates a visual language.

**Canonical glow usage:**

| Utility            | When to use                                                         |
| :----------------- | :------------------------------------------------------------------ |
| `glow-primary`     | Primary interactive surfaces (stat cards, machine cards, main CTAs) |
| `glow-success`     | Success/healthy/fixed states                                        |
| `glow-warning`     | Warning/attention-needed states                                     |
| `glow-destructive` | Error/critical/danger states                                        |
| `glow-secondary`   | Secondary accents (use sparingly — 1-2 elements per page max)       |

```tsx
// ❌ WRONG — glow on a decorative non-interactive element
<div className="border-border bg-card glow-primary p-4">
  Some static text
</div>

// ❌ WRONG — glow color doesn't match semantic meaning
<Card className="border-destructive/30 bg-destructive/10 glow-primary"> {/* should be glow-destructive */}

// ✅ CORRECT
<Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer">
<Card className="border-success/30 bg-success/10 glow-success">
<Card className="border-destructive/30 bg-destructive/10 glow-destructive">
```

---

## Forbidden UI Patterns

**Never do these:**

- `text-amber-500`, `text-purple-500`, `text-cyan-500`, `bg-green-600`, etc. — use semantic tokens
- Raw `<div className="border rounded-lg bg-card">` — use the Card component
- Inventing new card border/glow combinations — use the 5 canonical variants
- `<h2>` without an explicit font-size override in app pages — always add `text-xl font-semibold`
- Single-click destructive actions — always use `AlertDialog`
- Custom spinner implementations — use `Skeleton`
- Ad-hoc colored spans for issue status/severity/priority/frequency — use `IssueBadge`
- Icons from heroicons, react-icons, or any library other than `lucide-react`
- `style={{ ... }}` (unless for truly dynamic coordinates like drag-and-drop positions)
- `glow-primary` on static decorative elements
- Different glow color than the card's border/background semantic color

---

## Mobile-First Responsive Design

**CORE-UI-017:** All layouts start single-column and expand at breakpoints. No desktop-only pages.

- **Severity:** High
- **Why:** The BottomTabBar and MobileHeader handle navigation on mobile — page content doesn't need to handle this. But page grids and layouts must be mobile-first so they work correctly without the sidebar.

**Standard breakpoints** (Tailwind default + custom):

| Prefix            | Width   | Use                                          |
| :---------------- | :------ | :------------------------------------------- |
| (none)            | 0+      | Mobile default                               |
| `sm:`             | 640px+  | Larger phones (rare)                         |
| `md:`             | 768px+  | Tablet / small desktop. 2-column layouts.    |
| `lg:`             | 1024px+ | Desktop. 3-column, sidebar visible.          |
| `xl:`             | 1280px+ | Large desktop (rarely needed with max-w-6xl) |
| `table-assignee:` | 950px+  | Custom: show Assignee column in issue table  |
| `table-modified:` | 1100px+ | Custom: show Modified column in issue table  |

**Mobile vs Desktop differences the page must handle:**

| Element       | Mobile                                      | Desktop                      |
| :------------ | :------------------------------------------ | :--------------------------- |
| Navigation    | BottomTabBar + MobileHeader                 | Left sidebar (MainLayout)    |
| Grid columns  | `grid-cols-1`                               | expand via `md:` / `lg:`     |
| Table columns | hidden (`hidden table-assignee:table-cell`) | visible at custom breakpoint |
| Side panels   | stacked or hidden (`hidden lg:block`)       | `w-64` fixed panel           |
| Text          | may truncate (`truncate`, `line-clamp-2`)   | full display                 |

```tsx
// ✅ Mobile-first grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// ✅ Desktop-only sidebar panel
<div className="hidden lg:block w-64">

// ✅ Custom table breakpoints
<th className="hidden table-assignee:table-cell">Assignee</th>

// ✅ Truncate on mobile, full on desktop
<p className="truncate md:whitespace-normal">{machineName}</p>

// ❌ WRONG — no mobile consideration
<div className="grid grid-cols-3 gap-6">

// ❌ WRONG — adding horizontal padding to page container
<div className="max-w-6xl mx-auto px-4 py-10"> {/* MainLayout already adds this */}
```

**Reference:** See `/debug/layout` for the live responsive pattern showcase.

---

## Style Guide Reference

The live style guide at `/debug/` (dev-only) shows all patterns rendered in the actual app:

| Route               | Shows                                          |
| :------------------ | :--------------------------------------------- |
| `/debug/`           | Hub with links to all sections                 |
| `/debug/colors`     | All CSS variable tokens as color swatches      |
| `/debug/typography` | Heading hierarchy, text styles, code           |
| `/debug/components` | Button variants/sizes, inputs, selects, alerts |
| `/debug/cards`      | All 5 card variants + stat/empty patterns      |
| `/debug/states`     | Empty state, skeleton loading, error state     |
| `/debug/badges`     | IssueBadge for all domain values               |

**Use the style guide when:**

- Reviewing a PR — check that new UI matches the live reference
- Building a new page — copy the patterns directly
- Auditing drift — compare pages to the reference

---

## Cross-References

- Base UI rules (CORE-UI-001..004): `docs/NON_NEGOTIABLES.md`
- Live style guide: `src/app/(app)/debug/`
- Color tokens: `src/app/globals.css`
- Status/badge system: `src/lib/issues/status.ts`
- shadcn components: `src/components/ui/`
- Domain components: `src/components/issues/`, `src/components/machines/`
- UI skill (agent patterns): `.agent/skills/pinpoint-ui/SKILL.md`
