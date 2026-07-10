---
name: pinpoint-db-connections
description: Supabase/Postgres pooler and connection-string reference for PinPoint — Supavisor transaction vs session pooler, IPv4/IPv6, prepared statements, and the resolved PP-d8l8 silent-commit-loss incident. Use when touching src/server/db/**, scripts/migrate-production.ts, scripts/lib/pg-client.mjs, or any DB connection/pooler config.
---

# PinPoint DB Connections

Full pooler/endpoint reference for PinPoint's Supabase Postgres setup. The one-line operational rules live in `AGENTS.md` §7 Supabase — this skill is the deep reference behind them.

## Connection string format

`postgresql://postgres.[ref]:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres`

- App + scripts use `POSTGRES_URL` — the Supavisor **transaction** pooler (`…pooler.supabase.com:6543`, IPv4).
- In prod the Supabase↔Vercel integration injects `POSTGRES_URL_NON_POOLING` as the IPv4 **session** pooler (`…pooler.supabase.com:5432`) — the prepared-statement-capable, IPv4-reachable endpoint that `scripts/migrate-production.ts` uses for DDL on the IPv4-only Vercel build runner (verified 2026-06-18 via prod build logs + DNS, PP-xhqt).
- The **direct** connection (`db.<ref>.supabase.co:5432`) is **not** what NON_POOLING points to here: it is IPv6-only (prod's IPv4 add-on is **off**, confirmed — the host has no A record), so it is unreachable from CI/preview/Vercel; the session pooler is used instead.

## Canonical endpoint reference (Supabase docs, verified 2026-06-18)

| Endpoint                    | Mode                       | IP                      | Prepared statements           | Use for                                      |
| --------------------------- | -------------------------- | ----------------------- | ----------------------------- | -------------------------------------------- |
| `…pooler.supabase.com:6543` | Supavisor **transaction**  | IPv4 (always)           | **disable** (`prepare:false`) | reads, serverless, one-shot scripts          |
| `…pooler.supabase.com:5432` | Supavisor **session**      | IPv4 (always)           | supported                     | migrations / DDL / write transactions (IPv4) |
| `db.<ref>.supabase.co:5432` | **direct**                 | IPv6 (IPv4 with add-on) | supported                     | migrations from IPv6-capable hosts           |
| `db.<ref>.supabase.co:6543` | Dedicated PgBouncer (paid) | IPv6 (IPv4 with add-on) | no                            | high-perf app traffic                        |

- The shared Supavisor pooler is **already IPv4** on both ports, free, every tier — there is nothing to "enable". The paid **IPv4 add-on** is a separate thing that makes the _direct_ connection IPv4; PinPoint does not need it (the session pooler already gives an IPv4, prepared-statement-capable endpoint).
- **Transaction pooler (`:6543`) does not support prepared statements** — set `prepare:false` on **every** porsager client that connects there: one-shot scripts (`scripts/lib/pg-client.mjs`) **and the app runtime** (`src/server/db/index.ts`). This is the canonical Drizzle + postgres-js + Supabase serverless setting. `scripts/migrate-production.ts` also sets `prepare:false` as defense-in-depth: it normally runs over the `:5432` session pooler (prepared-statement-capable), but the option keeps it correct if it ever falls back to `:6543`, and it additionally **requires** `POSTGRES_URL_NON_POOLING` in production rather than silently falling back (PP-xhqt).

## Write/transaction hazard (resolved, PP-d8l8)

Multi-statement write transactions over the `:6543` transaction pooler with prepared statements caused **silent commit loss** in prod (the driver saw COMMIT succeed; nothing persisted — incident 2026-06-18). Root cause: the runtime client (`src/server/db/index.ts`) used postgres-js's default `prepare:true`. **Fixed by setting `prepare:false` on the runtime client** — one client-level option that covers all write transactions and standalone writes; no read/write split or session-pooler routing needed (the `:5432` session pooler is wrong for Vercel serverless — session mode exhausts connections under Fluid Compute). The app-layer read-back guard in `src/services/issues.ts` (PP-qk7s) remains as a tripwire until prod confirms the fix, then is removed in a follow-up.

**Do not reintroduce `prepare:true` on a `:6543` client.**
