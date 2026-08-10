# Rules with no narrower home

These six carry no `paths:` and load at launch, because no glob would narrow
them honestly. Full statements, severity, and do/don't:
`docs/NON_NEGOTIABLES.md`.

The first four apply to every file in the repo:

- **Type safety** (CORE-TS-007): ts-strictest. No `any`, no `!`, no unsafe
  `as`.
- **Path aliases** (CORE-TS-008): always `~/` (e.g. `~/lib/utils`).
- **Rule of Three** (CORE-ARCH-010): DRY up after the third duplication, not
  before.
- **Email privacy** (CORE-SEC-007): user emails only in admin views and the
  user's own settings page. Everywhere else: names, "Anonymous", or roles.

`any` and `~/` are partly gated by ESLint; the `as`-cast third of CORE-TS-007
is not checkable by any tool and is why it is stated here (`pinpoint-typescript`
skill has the casework). CORE-SEC-007 is scoped to display surfaces — it says
nothing about logs, where the backstop is the `redact` list in
`src/lib/logger.ts`.

The other two follow a **call**, not a directory:

- **Permissions go through the matrix** (CORE-ARCH-008): all checks via
  `checkPermission()` from `~/lib/permissions/helpers`. The help page
  auto-generates from the matrix — keep enforcement and matrix in sync.
- **No side effects inside DB transactions** (CORE-ARCH-011):
  external/non-transactional effects (HTTP, email, Discord, blob, Vault RPC)
  never run inside `db.transaction` — fetch inputs before it, deliver effects
  after commit (`after()` + `planNotification`/`dispatchNotification`). A
  runtime tripwire throws `SideEffectInTransactionError` if violated. (The
  Doodle Bug, PP-2053.)

`checkPermission` is called from `src/app/**` route handlers and pages,
`src/lib/mcp/tools/**`, `src/services/**`, `src/server/**`, and
`src/components/layout/**`; `db.transaction` appears in `src/app/**`,
`src/services/**`, `src/server/db/**`, and `src/lib/pinballmap/**`. A glob set
covering either one is everything but `src/hooks` and the CSS — which is what
`README.md` calls an always-loaded rule wearing a costume, so they are stated
here instead of pretending to be scoped. Both are the kind of rule whose cost
of *not* loading is a security hole or the Doodle Bug, which is the other half
of why they get the always-loaded slot.
