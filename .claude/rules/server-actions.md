---
paths:
  - "**/actions.ts"
  - "**/*-action.ts"
  - "**/*-actions.ts"
  - "src/server/actions/**"
---

# Writing or changing a Server Action

Full statements, severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

- **Honest failure** (CORE-ARCH-012): a control that cannot perform its action
  must not report that it did. Let it visibly do nothing or surface a real
  error — never a success toast for input that could not have been collected.
  There is no no-JS requirement; mutations still route through Server Actions
  (CORE-ARCH-005, CORE-ARCH-007). **A form containing a Radix Select must
  dispatch `useActionState` directly rather than carry `action={...}`** —
  React 19's post-action reset replays the Select's mount-time value, on
  failure as well as success (PP-0fvr, PP-1ajq; `pinpoint-ui` skill →
  **Server Action Forms**).

CORE-ARCH-008 (permissions via the matrix) and CORE-ARCH-011 (no side effects
inside `db.transaction`) apply to actions too, but they are **not** here —
both are called from far outside any action file, so they live in `always.md`.

## Why these globs are filenames

A Server Action module is marked by a `"use server"` directive, and a glob
cannot read one. Actions are also deliberately scattered — a route-local
action colocates with its route under `src/app/**`, and only genuinely
cross-cutting ones live in `src/server/actions/` — so there is no single
directory to point at either.

The filename globs above are therefore the seam, and
`pinpoint/server-action-file-naming` in `eslint.config.mjs` is what keeps them
honest: it fails the build on a module-level `"use server"` file named off the
pattern. Without that rule a new action named `foo.ts` would drop out of these
rules and nothing would fail — the rules would just quietly stop loading.
Change the globs here and you must change that rule too.
