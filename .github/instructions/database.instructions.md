---
applyTo: "src/server/db/**/*.ts,drizzle/**,supabase/**"
---

# Database, migrations & schema

## Migrations only (CORE-ARCH-009)

- Schema changes flow through `pnpm run db:generate` + `pnpm run db:migrate`. Flag any `drizzle-kit push` and any re-enabling of Supabase's migration config — production has real user data and `push` bypasses migration history.
- Every new `.sql` migration must ship with its matching `_snapshot.json`. Flag a `drizzle/` change that adds one without the other.
- Never hand-edit `drizzle/meta/*` — those snapshots are generated; manual edits corrupt the `prevId` chain.

## Connection & driver safety

- The app + one-shot scripts connect over the Supavisor **transaction** pooler (`:6543`), which does **not** support prepared statements. Flag any postgres-js client created against a `:6543` URL without `prepare: false` — the default `prepare: true` silently loses multi-statement write transactions in production.

## Access patterns (CORE-SSR-007)

- Read user data from `user_profiles`, never from `auth.users` (exceptions: `supabase/seed.sql`, PGlite test setup).
- Single-tenant: flag any new RLS policy or org-scoping column added to the schema. Tables use the Drizzle-superuser access pattern (RLS enabled, zero policies) intentionally — don't "fix" a table that has RLS on with no policies.
