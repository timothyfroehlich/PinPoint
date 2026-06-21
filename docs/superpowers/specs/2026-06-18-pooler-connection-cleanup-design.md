# Supabase pooler / connection-strategy cleanup — design

**Date:** 2026-06-18
**Beads:** PP-z428 (P2), PP-54eu (P2), PP-xhqt (P1)
**Author:** Claude-PoolerBeads (with Tim)
**Status:** Approved design — ready for implementation plan

## 1. Motivation

Three beads came out of the preview-branch / preview-migrate investigation, all
about how PinPoint connects to Postgres:

- **PP-z428** — Supabase pooler terminology is wrong/misleading in several places,
  and the prepared-statement / connection strategy is inconsistent across DB
  scripts. Agents keep re-deriving the facts and getting them wrong.
- **PP-54eu** — Supabase API key env-var naming is split between legacy
  (`anon` / `service_role`) and the new integration naming
  (`publishable` / `secret`); the claimed "fallbacks cover both" is unverified.
- **PP-xhqt** — the production migration connection (`migrate-production.ts`) has
  no assertion and a silent fallback; it works today but on an implicit path.

This cleanup is **non-prod for the bulk of it** (PP-z428 + PP-54eu) plus one
**prod-touching** change (PP-xhqt) that hardens an already-correct config.

## 2. Verified facts (Supabase docs, 2026-06-17 + prod measurement)

The canonical reference below was re-confirmed against the live Supabase
"Connect to your database" guide and measured against `PinPoint-Prod`
(`udhesuizjsgxfeotqybn`, us-east-2, Pro). **This corrects PP-z428's original
"canonical facts," which were partly wrong.**

### 2.1 Connection endpoints

| Endpoint                                  | Mode                       | IP                           | Prepared statements                                            | Use for                                   |
| ----------------------------------------- | -------------------------- | ---------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| `aws-N-<region>.pooler.supabase.com:6543` | Supavisor **transaction**  | IPv4 (always)                | docs say **disable**; works in practice via Supavisor named-PS | app runtime, serverless, one-shot scripts |
| `aws-N-<region>.pooler.supabase.com:5432` | Supavisor **session**      | IPv4 (always)                | supported                                                      | migrations / DDL from IPv4-only hosts     |
| `db.<ref>.supabase.co:5432`               | **direct**                 | IPv6 (IPv4 only with add-on) | supported                                                      | migrations from IPv6-capable hosts        |
| `db.<ref>.supabase.co:6543`               | Dedicated PgBouncer (paid) | IPv6 (IPv4 with add-on)      | no                                                             | high-perf app traffic                     |

Pooler usernames are `postgres.<ref>`; direct usernames are plain `postgres`.

### 2.2 Corrections to the bead's premise

1. **Prepared statements on `:6543`.** PP-z428 claimed "Supavisor supports
   transaction-mode prepared statements, so the `prepare:false` guidance is
   PgBouncer-era." The **current docs say the opposite**: disable prepared
   statements on transaction mode (`:6543`). Reality is nuanced — PinPoint's app
   runtime _does_ run prepared statements over `:6543` successfully, so Supavisor
   does support it in practice. The **portable, docs-aligned default for new
   one-shot scripts is `prepare: false`**; the app runtime keeps prepared
   statements as a deliberate, tested exception. The reference states both so the
   ambiguity stops costing time.
2. **The shared pooler is already IPv4.** Both `:5432` (session) and `:6543`
   (transaction) on `*.pooler.supabase.com` are IPv4 on every tier, for free.
   "Enabling IPv4" is **not** something you do to the pooler.
3. **The IPv4 add-on is a separate, optional, paid thing** that makes the
   _direct_ connection (and the dedicated PgBouncer pooler) IPv4. PinPoint does
   **not** need it — the session pooler already provides an IPv4 endpoint that
   supports prepared statements and DDL.

### 2.3 Prod measurement

- **IPv4 add-on is OFF.** `db.udhesuizjsgxfeotqybn.supabase.co` resolves to an
  IPv6 AAAA record only (no A record). Per the docs, the add-on swaps AAAA→A, so
  its absence means the direct connection is IPv6-only and **unreachable from
  Vercel/CI** (both IPv4-only).
- **Prod's non-pooling endpoint is the session pooler.** The Vercel prod env
  exposes `DIRECT_URL = …@aws-1-us-east-2.pooler.supabase.com:5432/postgres`
  (host + port + `postgres.<ref>` username = Supavisor **session** pooler, IPv4).
  `DIRECT_URL` and `POSTGRES_URL_NON_POOLING` are the conventional twin, so the
  migration endpoint is the IPv4 session pooler — which is why prod migrations
  succeed despite the add-on being off. **Residual:** `POSTGRES_URL_NON_POOLING`
  itself reads empty on `vercel env pull` (integration-managed / not materialized
  back); the session-pooler conclusion is inferred from `DIRECT_URL`. PR2 will
  confirm the literal value with a one-line redacted host log on the next deploy.
- **Key naming:** the integration injects the **new** names populated
  (`SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and leaves legacy
  `SUPABASE_SERVICE_ROLE_KEY` empty — so server code must read the new names or
  fall back, or admin calls break in prod.

## 3. Script inventory (the work-list)

`POSTGRES_URL_NON_POOLING ?? POSTGRES_URL` appears in ~10 places. They split into
two camps that need **opposite** treatment:

**Data / seed / reset camp** → should use the IPv4 pooler (`POSTGRES_URL`,
`prepare: false`):

- `supabase/seed-timeline-backfill.mjs` — NON_POOLING-first (remote-broken)
- `supabase/seed-timeline-demo.mjs` — NON_POOLING-first (remote-broken; local-guarded)
- `scripts/force-db-reset.mjs` — NON_POOLING-first (local-only, guarded)
- `scripts/db-fast-reset.mjs` — NON_POOLING-first (local-only, guarded)
- `scripts/reset-to-empty.mjs` — NON_POOLING-first (local-only, guarded)
- Already-correct (plain `POSTGRES_URL`): `seed-users.mjs`, `seed-discord.mjs`,
  `reset-preview-db.mjs`, and `seed-machine-settings.mjs` (fixed on
  `feat/machine-settings-tab-scaffold-PP-43q3`, not yet merged — coordinate).

**Migration camp** → needs an explicit IPv4-safe session/direct endpoint, not a
silent fallback:

- `scripts/migrate-production.ts` (PP-xhqt, prod)
- `scripts/mark-migration-applied.ts` (same fallback, also prod-touching)
- `drizzle.config.ts` (drizzle-kit; legitimately wants the direct/session URL)
- `scripts/workflow/preview/preview-migrate-seed.sh` (already correct — rewrites
  `:6543→:5432` for `drizzle-kit migrate`)

**Dead code:** `scripts/db-reset-preview.sh` — no references, hardcodes an orphan
prod ref, unguarded `DROP SCHEMA`. Delete.

## 4. Decisions (locked with Tim)

- **Two PRs**, not three: PR1 combines PP-z428 + PP-54eu (both non-prod); PR2 is
  PP-xhqt alone (prod). One-bead-one-PR is relaxed here because z428 and 54eu are
  small, related, non-prod, and share the same review surface.
- **Broad sweep:** fully unify _all_ data/seed/reset scripts onto one shared
  connection pattern (helper), including the currently-correct local-only reset
  scripts, so every script reads identically.
- **`prepare: false`** on one-shot data/seed/reset scripts (docs-aligned;
  no caching benefit lost on one-shot scripts).
- **I investigate prod facts** (done — see §2.3).

## 5. PR 1 — non-prod cleanup (PP-z428 + PP-54eu)

### 5.1 Terminology + canonical reference

- Replace the wrong/misleading text: `AGENTS.md:198–199` (calls `:6543` the
  "session pooler"; conflates direct-IPv6 with session-pooler-IPv4),
  `.env.example:18–21` (NON_POOLING example host `aws-0-region.supabase.com` is
  malformed — missing `.pooler.`), and the comments in `reset-preview-db.mjs` and
  `preview-migrate-seed.sh`.
- Add the §2.1 table + §2.2 corrections to **AGENTS.md §6** as the one durable
  reference.

### 5.2 Shared connection helper (Rule of Three)

- Add a small helper (e.g. `scripts/lib/pg-client.mjs`) that returns a configured
  porsager client: reads `POSTGRES_URL`, sets `{ prepare: false }`, single place
  for the convention. Justified by >3 call sites.
- Migrate the data/seed/reset camp (§3) to the helper:
  `seed-timeline-backfill.mjs`, `seed-timeline-demo.mjs`, `force-db-reset.mjs`,
  `db-fast-reset.mjs`, `reset-to-empty.mjs`, and optionally retro-fit the
  already-correct `.mjs` scripts for uniformity.
- Coordinate with the machine-settings branch on `seed-machine-settings.mjs` so
  we don't collide.

### 5.3 Localhost guards

- Bring `seed-from-backup.sh`, `seed-users.mjs`, `seed-discord.mjs` up to the
  URL-parsed `assertLocalDatabase` guard the `.mjs` reset scripts already use
  (the destructive/local-only ones must refuse non-local URLs).

### 5.4 Dead-script delete

- Remove `scripts/db-reset-preview.sh`.

### 5.5 PP-54eu — key-naming reconciliation

- Grep what the app actually reads (`SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`,
  `SUPABASE_PUBLISHABLE_KEY`, …) and confirm the fallbacks in
  `src/.../server.ts` / `middleware.ts` genuinely cover both old and new names
  (prod has legacy `service_role` empty, new `secret` populated — see §2.3).
- Confirm `preview-create.sh`'s `set_vercel_env` injects names the app reads.
- Reconcile to one convention (prefer new `publishable`/`secret` with documented
  fallbacks); update AGENTS.md to match reality.

### 5.6 Verification

- `pnpm run check`.
- `pnpm db:reset` to confirm the local reset/seed scripts still work through the
  helper (DDL via the chosen endpoint).
- A `/preview` on the PR (migrate + seed) confirms the preview path still works.

## 6. PR 2 — prod migration hardening (PP-xhqt)

Prod is currently healthy (§2.3); this hardens the **code** around it.

- **`scripts/migrate-production.ts`:**
  - Assert `POSTGRES_URL_NON_POOLING` is present in production; **fail loud**
    instead of silently falling back to `POSTGRES_URL` (`:6543`).
  - Preserve the current working behavior (session pooler `:5432`, prepared
    statements on) to minimize prod risk; add `prepare: false` **only** as a
    conditional safety net if the resolved endpoint is `:6543`.
  - Fix the misleading comment (lines 47–49) using the §2.1/§2.2 facts.
  - Add a one-line **redacted** host log (`host:port`, no credentials) so the next
    deploy confirms the literal endpoint.
- **`scripts/mark-migration-applied.ts`:** apply the same assert + comment fix
  (sibling prod-touching script with the same fallback).
- **Out of scope:** changing the app runtime's prepared-statement behavior
  (`src/server/db/index.ts` keeps them for perf, by design); enabling the IPv4
  add-on.
- **Verification:** test against a **preview branch**, never prod. Confirm a
  migration applies cleanly via the preview's session-pooler path. Watch the
  first prod deploy after merge (the redacted host log confirms the endpoint).

## 7. Out of scope / non-goals

- No IPv4 add-on (the session pooler already solves IPv4 reachability for free).
- No change to app-runtime prepared statements.
- No `drizzle-kit push` / migration-config changes (CORE-ARCH-009 unchanged).

## 8. Open items

- Confirm the literal prod `POSTGRES_URL_NON_POOLING` value at PR2 time (redacted
  host log on next deploy, or dashboard reveal).
- Coordinate `seed-machine-settings.mjs` ownership with the machine-settings
  branch to avoid a merge collision.
