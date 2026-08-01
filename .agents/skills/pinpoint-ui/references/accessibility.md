# Accessibility Patterns & Motion

What PinPoint adds on top of Radix's built-in a11y, plus the `motion-reduce:` rule.

## Accessibility Patterns

The shadcn primitives (and the Radix layer underneath) already handle a lot of a11y — focus trap, `aria-modal`, focus return, descendant labeling. These rules cover what PinPoint must add on top.

### Skip-to-main link (CORE-A11Y-001)

The skip link and its target are split across two files — `src/app/layout.tsx` renders the anchor, `src/components/layout/MainLayout.tsx` owns the `<main>` it points at. Copy from those; don't reconstruct from memory.

The decision worth carrying: **both halves are load-bearing.** An anchor pointing at a `<main>` that isn't focusable moves the scroll position but not focus, which is the failure mode that reads as "we have a skip link" while doing nothing for the keyboard user. If you introduce a new layout shell, port the pair, not just the anchor.

### `inert` on background regions when a modal opens (CORE-A11Y-006)

**This rule is intent, not current behavior — and that is deliberate.** Nothing in `src/` sets `inert`; the rule is adopted and tracked as PP-kqbk.8 (`docs/NON_NEGOTIABLES.md`, CORE-A11Y-006) but not yet implemented. You cannot learn that from the code, because "not there yet" and "decided against" look identical in an empty search. So: don't file the absence as a bug, and don't write your own partial version — implement it once, on the background container, when the bead comes up.

The gap it closes: Radix applies `aria-hidden` + pointer-events to the rest of the DOM when a modal opens, which covers AT and mouse but leaves a small focus-leak window. `inert` removes a subtree from tab order, click handling, and the AT tree in one declarative step. It layers on top of Radix — one attribute on the background container, not a replacement for Radix's focus management.

### Real `<button>` — never `<div role="button">` (CORE-A11Y-004)

`<button>` is fully restylable, so the usual excuse for `<div role="button">` doesn't hold here. A hand-rolled div-button almost always misses the Space key, focus return, or an accessible name. When you meet a styled `<div>` that behaves like a button, converting it is in scope for whatever change you're already making.

### Tooltip ≠ `title` attribute (CORE-A11Y-005)

`title` doesn't fire on touch and is inconsistently surfaced by screen readers. For supplemental hover/focus info, use shadcn `<Tooltip>` (it wires `aria-describedby`) and add an `aria-label` on the trigger when the visible label is missing.

For **disabled controls** that need a "why disabled" explanation, the tooltip-on-touch problem is a class-A blocker (mobile users see nothing). Either surface the reason as visible text near the control, bake it into the button's accessible name, or enable the control and validate on click.

### Data tables (CORE-A11Y-003)

`src/components/issues/IssueList.tsx` is the reference implementation for a sortable table — `<th scope="col">`, `aria-sort` tracking the live sort state, an accessible name on the table, and a real `<button>` in the header cell. Copy its semantics into every new sortable table rather than re-deriving them.

### ARIA labels on icon-only triggers

Icon-only buttons need an `aria-label`, and the decorative icon inside gets `aria-hidden="true"` so AT reads the label rather than the glyph.

The judgement call worth stating: **on an editable cell, name the field, not just its current value.** `aria-label="Open"` tells a screen-reader user what the value is; `aria-label="Status: Open — change status"` tells them what the control does and which field it belongs to. A trigger whose accessible name is only its value is indistinguishable from a label.

### Label-to-control association (especially Radix `<Select>`)

`<Label htmlFor="x">` must target the actual interactive element. Radix `<SelectTrigger>` is the `<button>` underneath, so the `id` goes **on the trigger**, not on the wrapping `<Select>`. Putting it on `<Select>` produces a label that points at nothing and an unlabelled control — with no error, no lint failure, and a visually identical render.

### Live regions for async feedback

shadcn `<Alert>` already carries `role="alert"`. Sonner toasts fire in `role="status"`. For async failures inside a row (optimistic update reverted), surface an inline `role="alert"` near the affected element — toast alone is fine for success, but failure needs a more durable announcement.

## Animation & Motion (CORE-A11Y-002)

Every `animate-*` and non-essential `transition-*` utility pairs with its `motion-reduce:` counterpart — `motion-reduce:animate-none` for animations, `motion-reduce:transition-none` for transitions. The test for "non-essential" is whether the motion carries information: a spinner's rotation doesn't (the static icon still says "loading"), a skeleton's pulse doesn't, a height transition doesn't — keep the structural change, drop the movement.

**Essential motion may opt out**, and that exemption is narrow: a sheet sliding in from the side is the thing that tells the user where the surface came from, so removing it removes meaning rather than discomfort. When you take the exemption, leave a one-line comment saying so — otherwise the next reviewer reads it as a missed `motion-reduce:` and "fixes" it.
