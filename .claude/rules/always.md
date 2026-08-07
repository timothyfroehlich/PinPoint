# Rules with no narrower home

These four apply to every file in the repo, so there is no glob that would
narrow them — they carry no `paths:` and load at launch. Full statements,
severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

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
