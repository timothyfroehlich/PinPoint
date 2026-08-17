---
paths:
  - "src/components/**"
  - "src/app/**"
  - "src/hooks/**"
  - "**/*.css"
---

# Building or changing UI

Full statements, severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

- **Server Components default** (CORE-ARCH-001): `"use client"` only for
  interaction leaves.
- **Two-layer responsive** (CORE-RESP-001..004): viewport breakpoints (`md:`,
  `lg:`) for page structure; container queries (`@lg:`, `@xl:`) for component
  internals. No `useMediaQuery` / `window.innerWidth` — use CSS. Sanctioned
  exceptions (behavior swaps CSS can't express): `use-table-responsive-columns`
  (PP-rs9), `use-is-mobile` (PP-43q3 — row-edit sheet + confirm-delete).
- **Baseline Widely available is the UI floor** (CORE-UI-005, CORE-UI-006):
  reach for `<dialog>`, container queries, `:has()`, `:user-invalid`, `inert`,
  `aspect-ratio`, etc. directly — no polyfills, no feature detection. Look up
  modern patterns via the `modern-web-guidance` plugin
  (`npx -y modern-web-guidance@latest search "<query>"` then
  `retrieve "<id>"`); each guide tags its Baseline status, and that live lookup
  is the only trustworthy source for a tier — never a date written down here.
  Newly-available features (Popover API, View Transitions, anchor positioning,
  scroll-driven animations) require a per-feature opt-in documented in
  `pinpoint-design-bible` §19; `fetchpriority` and `text-wrap: balance` are the
  two that already have one.
- **Form correctness** (CORE-FORM-001..006): right `type` (`email`/`tel`/`url`/
  `password`), correct `autocomplete` token (`current-password` /
  `new-password` / `off` on confirm), `:user-invalid` styling on the shared
  Input, `aria-invalid` synced on blur, visible required-field indicators,
  `enterkeyhint` on sequential mobile fields.
- **Accessibility floor** (CORE-A11Y-001..006): skip-to-main link,
  `motion-reduce:` paired with animations, `<th scope="col">` + `aria-sort` +
  accessible name on data tables, real `<button>` (never
  `<div role="button">`), `title` is not a tooltip, `inert` on background
  regions when a modal opens.
- **Telegraphic status copy** (CORE-UI-007): status lines, error reasons, and
  state labels are a bold 2–4 word label + at most one supporting line — no
  prose sentences, no articles/copulas, neutral voice. Full register:
  `pinpoint-design-bible` §25. Confirm-dialog bodies are exempt.

These are the broadest globs in this directory — roughly two-thirds of the
source tree — and that is deliberate rather than sloppy: they still exclude
`src/lib`, `src/server`, `src/services`, `scripts/`, and `drizzle/`, so a
backend or migration session never loads them. They do **not** exclude tests:
96 `*.test.ts(x)` files live under `src/components/` and `src/app/`, so editing
a component test loads this file alongside `testing.md`. That is the right
answer for a component test and simply a little noise for the rest. Design-system depth (page archetypes,
spacing, severity vocabulary) lives in `pinpoint-design-bible`, not here.
