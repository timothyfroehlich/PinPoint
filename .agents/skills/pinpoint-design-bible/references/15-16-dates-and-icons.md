# Date Formatting & Icons (§15–§16)

The date-formatting vocabulary and the lucide-react icon sizing rules.

## 15. Date Formatting Vocabulary

> **Status — implemented.** Three canonical helpers live in [`src/lib/dates.ts`](../../../../src/lib/dates.ts). Use them; never call `formatDistanceToNow` or `toLocaleDateString` directly from a component.

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
