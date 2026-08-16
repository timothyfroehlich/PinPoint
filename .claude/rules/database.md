---
paths:
  - "drizzle/**"
  - "src/server/db/**"
  - "scripts/migrate-production.ts"
  - "scripts/mark-migration-applied.ts"
  - "supabase/**"
---

# Changing the schema or a migration

Full statement, severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

- **Drizzle migrations only** (CORE-ARCH-009): `db:generate` + `db:migrate`.
  Never `drizzle-kit push`. Supabase migration config is disabled.

Two things this rule does not say, both of which bite here:

- **Never resolve `drizzle/meta` conflicts by hand.** That folder holds
  binary-like schema snapshots; editing them corrupts the prevId chain. The
  regenerate-don't-edit protocol is in the `pinpoint-deployment` skill.
- **Local `db:reset` is fine; production `db:reset` never is.** Production has
  real user data, daily backups with 7-day retention and no PITR, so the
  recovery floor is the previous nightly snapshot (`AGENTS.md` "Deployment").

Pooler and connection-string reference, and the PP-d8l8 silent-commit-loss
incident behind `prepare:false` on every `:6543` client: `pinpoint-deployment`.
