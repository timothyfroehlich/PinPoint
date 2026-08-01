# Typography, Borders & Transitions (§9–§11)

The type scale, border/divider treatments, and the two canonical transition durations.

## 9. Typography Scale

| Element                  | Classes                                                                  |
| :----------------------- | :----------------------------------------------------------------------- |
| Page title (desktop)     | `text-3xl font-bold`                                                     |
| Page title (detail page) | `text-3xl font-bold`                                                     |
| Section heading          | `text-xl font-semibold`                                                  |
| Card title (normal)      | `text-base`                                                              |
| Card title (compact)     | `text-sm`                                                                |
| Metadata / labels        | `text-xs text-muted-foreground`                                          |
| Issue IDs                | `font-mono` (e.g., AFM-3)                                                |
| Machine name in cards    | `text-xs font-medium underline decoration-primary/30 underline-offset-2` |

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

Two canonical durations standardize animated feedback in **application code** — this is a design choice, recorded nowhere in the codebase, so it lives here:

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

**Rule:** In application code, never introduce a duration other than 150 or 300 unless the canonical two genuinely don't fit. If you find an edge case, add a row to this table first, document the use case, then use it consistently across similar elements.

**Scope: this rule governs code we write, not the vendored shadcn primitives.** `dialog.tsx`, `alert-dialog.tsx` and `sheet.tsx` ship upstream enter/exit durations of their own, including an asymmetric open/close pair on Sheet — so essentially every modal in the app inherits a value that isn't 150 or 300. That is **accepted**, not a backlog item: rewriting vendored primitives to satisfy a house rule costs us the ability to re-sync them from upstream, for a difference nobody perceives. Two consequences: don't "fix" those files, and don't cite them as precedent for a fourth duration in your own component.

**Motion sensitivity:** Every `animate-*` and non-essential `transition-*` utility pairs with `motion-reduce:animate-none` / `motion-reduce:transition-none` (CORE-A11Y-002). Loading spinners use `animate-spin motion-reduce:animate-none` — the static icon still communicates "loading." Essential motion (e.g., a Sheet sliding into view — the slide is what conveys "this came from the side") can omit the variant; document the choice in a one-line comment so reviewers know it was deliberate.
