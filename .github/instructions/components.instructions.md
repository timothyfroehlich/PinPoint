---
applyTo: "src/components/**/*.tsx,src/app/**/*.tsx"
---

# React components (Server-first, responsive, accessible)

## Server vs client (CORE-ARCH-001, CORE-SEC-006)

- Flag `"use client"` on a component with no interactivity — no event handlers, no browser APIs, no `useState`/`useEffect`. Push `"use client"` down to the smallest interactive leaf.
- Flag a client component that receives a whole ORM row / domain object (a full issue, machine, or `user_profiles` row) as a prop. Pass only the fields it renders — the RSC payload ships to the browser in page source.

## Progressive enhancement (CORE-ARCH-002)

- Forms mutate via `<form action={serverAction}>`, not `onSubmit` + `fetch`. The core submit must work with JS disabled. Flag inline `onClick` handlers that perform a mutation a form action should own.

## Two-layer responsive (CORE-RESP-001..004)

- **Page structure** uses viewport breakpoints (`md:`, `lg:`). **Component internals** use container queries (`@lg:`, `@xl:`). Flag mixing the two for the same layout decision.
- `sm:` is for padding/spacing only. Flag `sm:flex-row`, `sm:grid-cols-2`, `hidden sm:block`, etc.
- Flag JS viewport detection: `window.innerWidth`, `useMediaQuery`, `matchMedia`. Use CSS. (Sanctioned hook exceptions: `use-table-responsive-columns`, `use-is-mobile` — don't flag those two.)

## Forms correctness (CORE-FORM-001..006)

- Flag the wrong `type` on an input (`email`/`tel`/`url`/`password` where applicable).
- Flag missing/incorrect `autocomplete`: `current-password` for login, `new-password` for signup/reset, `off` on a confirm-password field.
- Confirm `:user-invalid` styling and `aria-invalid` (synced on blur) on the shared Input, a visible required-field indicator, and `enterkeyhint` on sequential mobile fields.

## Accessibility floor (CORE-A11Y-001..006)

- Flag `<div role="button">` / clickable non-buttons — use a real `<button>`.
- Flag an animation with no `motion-reduce:` variant.
- Data tables need `<th scope="col">`, `aria-sort`, and an accessible name.
- `title` is not a tooltip. When a modal opens, background regions get `inert`.

## UI stack

- shadcn/ui + Tailwind v4. Flag any Material UI (`@mui/*`) import. Baseline-Widely-available CSS (`<dialog>`, container queries, `:has()`, `inert`, `aspect-ratio`) is the floor — no polyfills or feature detection.
