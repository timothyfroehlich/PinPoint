---
paths:
  - "**/actions.ts"
  - "**/*-action.ts"
  - "**/*-actions.ts"
  - "src/server/actions/**"
  - "src/lib/permissions/**"
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
- **Permissions go through the matrix** (CORE-ARCH-008): all checks via
  `checkPermission()` from `~/lib/permissions/helpers`. The help page
  auto-generates from the matrix — keep enforcement and matrix in sync.
- **No side effects inside DB transactions** (CORE-ARCH-011):
  external/non-transactional effects (HTTP, email, Discord, blob, Vault RPC)
  never run inside `db.transaction` — fetch inputs before it, deliver effects
  after commit (`after()` + `planNotification`/`dispatchNotification`). A
  runtime tripwire throws `SideEffectInTransactionError` if violated. (The
  Doodle Bug, PP-2053.)

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

`src/lib/permissions/**` is in the list because CORE-ARCH-008 is as relevant
when editing the matrix as when calling it.
