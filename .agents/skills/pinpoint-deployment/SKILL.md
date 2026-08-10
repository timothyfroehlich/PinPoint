---
name: pinpoint-deployment
description: Deployment reference for PinPoint — Supabase/Postgres pooler and connection-string reference (Supavisor transaction vs session pooler, IPv4/IPv6, prepared statements, and the resolved PP-d8l8 silent-commit-loss incident); the day-to-day Drizzle migration loop (db:generate, db:migrate, db:reset, test:_generate-schema, the exported PGlite schema.sql, ensure-test-schema, CORE-ARCH-009 migrations-not-push); resolving drizzle/meta conflicts on merge; why `supabase start` died with "FATAL: invalid secret key" on an SELinux host under CLI 2.111.0 and why 2.112.0+ fixed it (PP-9mg0); on-demand TTL'd Supabase preview branches, the /preview command, the sticky status comment, and the hourly reaper; and the per-PR /audit-override escape hatch for unrelated pnpm audit failures blocking CI Gate. Use when changing the Drizzle schema or generating/applying a migration; when touching src/server/db/**, scripts/migrate-production.ts, or scripts/lib/pg-client.mjs (DB connection/pooler config); when a merge or rebase produces conflicts under drizzle/meta or drizzle migration .sql/_snapshot.json files; when setting up, debugging, or explaining Vercel preview deployments or the /preview command; when a PR's audit job goes red on a freshly-published advisory unrelated to the PR's own changes, or when explaining/debugging the /audit-override command; or when the local Supabase stack will not start and the db container is restart-looping.
---

# PinPoint Deployment

Merged reference covering PinPoint's deployment-adjacent operational surfaces: DB connections/pooling, the day-to-day migration loop, migration-conflict resolution, preview deployments, and the audit-gate override. Four of these sections were previously their own skills (`pinpoint-db-connections`, `pinpoint-migration-conflicts`, `pinpoint-preview-deployments`, `pinpoint-audit-override`) and are reproduced here verbatim; **Database Migrations (day-to-day)** was absorbed from the retired patterns docs (PP-22e4).

## DB Connections

Full pooler/endpoint reference for PinPoint's Supabase Postgres setup. The one-line operational rules live in `AGENTS.md` §7 Supabase — this skill is the deep reference behind them.

### Connection string format

`postgresql://postgres.[ref]:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres`

- App + scripts use `POSTGRES_URL` — the Supavisor **transaction** pooler (`…pooler.supabase.com:6543`, IPv4).
- In prod the Supabase↔Vercel integration injects `POSTGRES_URL_NON_POOLING` as the IPv4 **session** pooler (`…pooler.supabase.com:5432`) — the prepared-statement-capable, IPv4-reachable endpoint that `scripts/migrate-production.ts` uses for DDL on the IPv4-only Vercel build runner (verified 2026-06-18 via prod build logs + DNS, PP-xhqt).
- The **direct** connection (`db.<ref>.supabase.co:5432`) is **not** what NON_POOLING points to here: it is IPv6-only (prod's IPv4 add-on is **off**, confirmed — the host has no A record), so it is unreachable from CI/preview/Vercel; the session pooler is used instead.

### Canonical endpoint reference (Supabase docs, verified 2026-06-18)

| Endpoint                    | Mode                       | IP                      | Prepared statements           | Use for                                      |
| --------------------------- | -------------------------- | ----------------------- | ----------------------------- | -------------------------------------------- |
| `…pooler.supabase.com:6543` | Supavisor **transaction**  | IPv4 (always)           | **disable** (`prepare:false`) | reads, serverless, one-shot scripts          |
| `…pooler.supabase.com:5432` | Supavisor **session**      | IPv4 (always)           | supported                     | migrations / DDL / write transactions (IPv4) |
| `db.<ref>.supabase.co:5432` | **direct**                 | IPv6 (IPv4 with add-on) | supported                     | migrations from IPv6-capable hosts           |
| `db.<ref>.supabase.co:6543` | Dedicated PgBouncer (paid) | IPv6 (IPv4 with add-on) | no                            | high-perf app traffic                        |

- The shared Supavisor pooler is **already IPv4** on both ports, free, every tier — there is nothing to "enable". The paid **IPv4 add-on** is a separate thing that makes the _direct_ connection IPv4; PinPoint does not need it (the session pooler already gives an IPv4, prepared-statement-capable endpoint).
- **Transaction pooler (`:6543`) does not support prepared statements** — set `prepare:false` on **every** porsager client that connects there: one-shot scripts (`scripts/lib/pg-client.mjs`) **and the app runtime** (`src/server/db/index.ts`). This is the canonical Drizzle + postgres-js + Supabase serverless setting. `scripts/migrate-production.ts` also sets `prepare:false` as defense-in-depth: it normally runs over the `:5432` session pooler (prepared-statement-capable), but the option keeps it correct if it ever falls back to `:6543`, and it additionally **requires** `POSTGRES_URL_NON_POOLING` in production rather than silently falling back (PP-xhqt).

### Write/transaction hazard (resolved, PP-d8l8)

Multi-statement write transactions over the `:6543` transaction pooler with prepared statements caused **silent commit loss** in prod (the driver saw COMMIT succeed; nothing persisted — incident 2026-06-18). Root cause: the runtime client (`src/server/db/index.ts`) used postgres-js's default `prepare:true`. **Fixed by setting `prepare:false` on the runtime client** — one client-level option that covers all write transactions and standalone writes; no read/write split or session-pooler routing needed (the `:5432` session pooler is wrong for Vercel serverless — session mode exhausts connections under Fluid Compute). The app-layer read-back guard in `src/services/issues.ts` (PP-qk7s) remains as a tripwire until prod confirms the fix, then is removed in a follow-up.

**Do not reintroduce `prepare:true` on a `:6543` client.**

## Database Migrations (day-to-day)

PinPoint uses **Drizzle ORM** for schema definition and migrations, plus a **separately exported schema** for PGlite tests. Migrations keep production and preview databases in sync; the exported snapshot keeps tests running against a known-good schema.

- **Source of truth**: `src/server/db/schema.ts`
- **Migrations folder**: `drizzle/` (generated by Drizzle Kit)
- **Test schema**: `src/test/setup/schema.sql` (generated with `drizzle-kit export`)

### Commands

| Command                                   | What it does                                                                   |
| :---------------------------------------- | :----------------------------------------------------------------------------- |
| `pnpm run db:generate -- --name <change>` | Generate a migration from the current `schema.ts`                              |
| `pnpm run db:migrate`                     | Apply pending migrations to the current database                               |
| `pnpm run db:reset`                       | **DESTRUCTIVE, local only** — restart Supabase, reapply all migrations, reseed |
| `pnpm run test:_generate-schema`          | Regenerate `src/test/setup/schema.sql` for PGlite integration tests            |

- **`db:migrate`** is the daily driver locally, and is what CI/CD runs for preview and production updates.
- **`db:reset`** is local-only, for when you want a clean slate. It wipes all local data.
- **`test:_generate-schema`** must be re-run after any schema change. `scripts/ensure-test-schema.ts` is the safety net — it fails fast when `schema.ts` is newer than `schema.sql`, so a stale snapshot surfaces as a clear error rather than as confusing PGlite test failures.

### Rules

- **Migrations only, never `drizzle-kit push`** (CORE-ARCH-009). Generate and apply; the Supabase migration config is deliberately disabled.
- **Descriptive names** — `add-notifications-table`, not `changes2`.
- **Commit everything together**: `schema.ts`, the new `drizzle/` files (`.sql` **and** `_snapshot.json`), and the updated `src/test/setup/schema.sql`.
- **Production and preview are `db:migrate` only.** Never `db:reset`, never `drizzle-kit push` against them. (AGENTS.md §7.)

## Local stack won't start on an SELinux host (resolved, PP-9mg0)

**Fixed by the CLI pin bump to 2.113.0 (#1837). Recorded because the symptom is unrecognizable from its error message, and the trigger was a CLI version — so an older CLI reintroduces it.**

Symptom on Bazzite (Fedora Atomic, SELinux enforcing, `docker` is a shim over rootless podman): `supabase start` never completes, the `supabase_db_*` container restart-loops, and the log reads

```
pgsodium_getkey.sh: /etc/postgresql-custom/pgsodium_root.key: Read-only file system
FATAL:  invalid secret key
```

Cause: **CLI 2.111.0 only**. Older CLIs wrote the pgsodium root key from _inside_ the container. 2.111.0 staged it on the host at `supabase/.temp/start-secrets/<container>/secret-0` and bind-mounted it `:ro` — with no `z`/`Z` relabel. The staged file inherits `user_home_t` from the repo, the container runs as `container_t`, so SELinux denies the `stat`. That makes `pgsodium_getkey.sh`'s `[[ ! -f "$KEY_FILE" ]]` true (`test -f` is false on `EACCES`), so it tries to _create_ the key — writing through a read-only mount. Both messages, one cause. Kong and pooler staged secrets the same way; db just failed first.

Why it is gone: 2.112.0 replaced the bind mount with `docker cp` from a short-lived temp file, and the 2.113.0 `secretFiles` doc says it is never a host bind mount (supabase/cli#6022). Verified on Bazzite at 2.113.0 — the stack is healthy, `supabase/.temp/start-secrets/` is never created, and no Supabase container has any host bind mount into the repo.

If it ever returns: check the CLI version first. Either bump it, or label the staging directory once — `chcon -R -t container_file_t -l s0 supabase/.temp/start-secrets` — which is enough because the directory survives a restart (the CLI removes only the per-container subdirectory) and staged files inherit the parent's label. macOS and CI have no SELinux and were never affected.

## Migration Conflicts

Never resolve `drizzle/meta` conflicts manually — the folder holds binary-like schema snapshots; manual edits corrupt the `prevId` chain.

### Protocol when meta conflicts on merge

1. Take upstream's `drizzle/meta` (theirs).
2. Delete your migration files (`.sql` + `_snapshot.json`).
3. Resolve `schema.ts` manually.
4. `pnpm db:generate` — Drizzle regenerates a fresh migration.
5. Compare the new SQL to what you deleted; confirm intent preserved.
6. `pnpm db:reset` to verify.

Before merging any migration PR: every new `.sql` has a matching `_snapshot.json`; `pnpm db:generate` reports "No schema changes".

## Preview Deployments

Native Supabase auto-branching is **disabled** — no PR gets a preview by default (zero branches, zero cost). Previews are created on demand via PR comment commands and torn down on a TTL.

- **Control surface = PR comments** (from authors with write access only):
  - `/preview` — create (or restart after expiry) a branch, migrate + seed it, wire creds into the Vercel preview, and post a sticky status comment with the live URL + 48h expiry.
  - `/preview extend` — push expiry +48h (no DB work). `/preview stop` — tear down now.
- **State**: one sticky bot comment per PR (keyed `<!-- pinpoint-preview-status -->`) holds the `Expires:` timestamp — the TTL source of truth.
- **Reaper**: `Preview Reaper` runs hourly; deletes branches past expiry or on closed/merged PRs, and flips the sticky comment to "expired — comment `/preview` to restart."
- **Implementation** (workflows, the Vercel git-integration wiring, and required secrets): `.github/workflows/preview-control.yaml`, `preview-reaper.yaml`, `scripts/workflow/preview/*.sh`.

Vercel preview migrations: preview deployments skip `migrate:production` (branch DB user lacks `CREATE SCHEMA`). The on-demand `Preview Controller` workflow migrates + seeds the branch DB before building the preview. Production deploys still migrate.

## Audit-Gate Override

When `pnpm audit --audit-level=high` goes RED on a freshly-published advisory **unrelated** to a PR's changes (a transitive dev-dep CVE, or a fix that's major-bump-only), the audit job cascades into CI Gate and blocks the PR. The proper fix is still a dependency-bump PR — but `/audit-override` is the escape hatch so an unrelated repo-wide advisory doesn't force an admin-merge.

- **Control surface = PR comments** (from authors with write access only):
  - `/audit-override <reason>` — bypass the `pnpm audit` gate for the PR's **current head commit**. Records a `pinpoint-audit-override` commit status + a sticky bot comment (who/when/why) and re-runs the failed CI so the gate re-evaluates immediately.
  - `/audit-override clear` — re-arm the gate.
- **Commit-bound, not PR-bound**: the override is a commit status on the head SHA. **Pushing a new commit drops it** — the gate re-fires and the override must be re-issued, so a newly-introduced real vulnerability is never silently masked. It only bypasses the audit gate; any other failing check stays red.
- **Scope**: single PR only; never changes repo-wide audit policy or any other PR. No secrets required (default `GITHUB_TOKEN`).
- **Implementation**: `.github/workflows/audit-override.yaml`, `scripts/workflow/audit-override/*.sh`; the consuming check is the `Run pnpm audit` step in `ci.yml` (`gate.sh check`).
