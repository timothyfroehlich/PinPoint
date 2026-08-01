# Date Formatting & Icons (§15–§16)

The date-formatting vocabulary and the lucide-react icon sizing rules.

## 15. Date Formatting Vocabulary

**Dates are a closed vocabulary owned by [`src/lib/dates.ts`](../../../../src/lib/dates.ts).** Read that file for the helpers it currently exports and what each one renders — it is short, and it has grown since this section was first written, which is exactly why the list isn't duplicated here.

The rules, which the file can't tell you:

- **Never call `formatDistanceToNow` or `toLocaleDateString` directly from a component.** Every rendered date goes through the vocabulary.
- **If no helper fits, add one to `dates.ts` — don't inline a variant at the call site.** The vocabulary is meant to grow; what it must not do is fragment.
- **Null-guard at the call site.** The helpers take a real date; deciding what an absent date looks like — hidden, `"—"`, `"never"` — is a per-context choice, and pushing a default into the helper makes every caller inherit someone else's copy.

**Why a vocabulary at all:** consistency (the same instant reads the same everywhere), locale safety (`toLocaleDateString()` renders differently per locale, which silently breaks visual regression tests), and refactor leverage (switching date library, or adding absolute-date tooltips on hover, is one file).

One trap worth knowing: a _local_ `formatDate` also exists in the CSV export path, deliberately machine-readable rather than human-readable. Same name, different contract — don't assume an imported `formatDate` is this vocabulary's.

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
