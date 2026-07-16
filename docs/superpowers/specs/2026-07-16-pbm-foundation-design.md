# PinballMap Foundation — Shared Schema + Snapshot Read Path (PP-o355.16)

**Date:** 2026-07-16
**Bead:** PP-o355.16 (parent epic PP-o355)
**Status:** Design approved (Tim + Claude, 2026-07-16)

## Purpose

PP-o355.11 (inbound snapshot sync, automatic/cron) and PP-o355.12 (outbound
list/unlist) both build on the same DB schema and the same "fetch our location
and persist the snapshot" read path. If each added its own migration they'd
collide on the drizzle chain and on the `pinballmap_state` table shape. This
bead **lands that shared foundation first, as its own PR**, so `.11` and `.12`
then fork cleanly and proceed in parallel — each adding **zero** schema.

A complete but **unmerged** reference implementation exists in commit `b6eb7dca`
(the original PP-o355.3 backend). This bead ports the schema + shared read path
from it and **drops** everything cron/status/action/UI (those go to `.11`/`.12`).
It also adds **net-new** machine columns for the locked _store-and-heal_ lmx
model that `b6eb7dca` did not have.

## Scope

### In

1. **Migration 0052** — regenerated _fresh_ via `pnpm run db:generate` (chain is
   at 0051). **Never** cherry-pick `b6eb7dca`'s `0046_purple_vision.sql`; on
   `origin/main`, 0046 is an unrelated migration.

   **a. `pinballmap_state` singleton table** — full proven `b6eb7dca` column set,
   so `.11`/`.12` add no schema:

   | Column                    | Type / constraint                                                                       |
   | ------------------------- | --------------------------------------------------------------------------------------- |
   | `id`                      | `text` PK, default `'singleton'`, CHECK `id = 'singleton'`                              |
   | `enabled`                 | `boolean` NOT NULL default `false`                                                      |
   | `location_id`             | `integer` NOT NULL default `26454` (APC)                                                |
   | `snapshot_json`           | `jsonb` nullable, Drizzle `$type<LocationSnapshot>()`                                   |
   | `last_synced_at`          | `timestamptz` nullable                                                                  |
   | `last_sync_status`        | `text` NOT NULL default `'unknown'`, CHECK in `unknown\|ok\|error`                      |
   | `last_sync_error`         | `text` nullable                                                                         |
   | `outbound_email`          | `text` nullable                                                                         |
   | `outbound_token_vault_id` | `uuid` nullable (references `vault.secrets.id`; **no FK** — Drizzle can't cross-schema) |
   | `updated_at`              | `timestamptz` NOT NULL default `now()`                                                  |
   | `updated_by`              | `uuid` nullable (references `auth.users.id`; no FK)                                     |

   Mirrors the `discord_integration_config` singleton pattern already in
   `schema.ts` (id-singleton CHECK, health-enum CHECK, vault UUID with no FK).

   **b. `machines` net-new (store-and-heal lmx model):**

   - `pinballmap_lmx_id` `integer` nullable — the durable captured PBM listing
     handle (the `location_machine_xref` id). We **store and heal** it, not
     re-resolve per push.
   - CHECK `machines_pinballmap_lmx_requires_link`:
     `NOT (pinballmap_lmx_id IS NOT NULL AND pinballmap_machine_id IS NULL)`
     (an lmx implies a catalog link).
   - CHECK `machines_pinballmap_lmx_requires_listed`:
     `NOT (pinballmap_lmx_id IS NOT NULL AND NOT pinballmap_listed)`
     (an lmx implies we consider it listed).
   - Partial `UNIQUE(pinballmap_machine_id) WHERE pinballmap_listed` — one PBM
     lister per catalog title at our location. Duplicate physical cabinets of
     the same title share one PBM lmx (PbmApiAudit finding #1).

2. **`src/lib/pinballmap/state.ts`** (new file — `state.ts`, not `sync.ts`, so
   `.11`'s cron/scheduling layer gets a clean `sync.ts`):

   - `getPinballMapState(): Promise<PinballmapState | null>` — read the singleton.
   - `syncLocationSnapshot(opts?): Promise<SyncResult>` — the **single shared read
     path**. Fetch `getPinballMapClient().fetchLocation(locationId)` **outside any
     transaction** (CORE-ARCH-011), then upsert `snapshot_json` + `last_synced_at`
     - `last_sync_status`/`last_sync_error`. Never throws on PBM/network failure:
       records the error on the singleton and returns `{ ok: false, error }`.
       Ported from `b6eb7dca`'s `sync.ts` **minus** the `status.ts` re-exports.

3. **Type export** `PinballmapState` in `src/lib/types/database.ts`
   (`InferSelectModel<typeof pinballmapState>`), matching the existing pattern.

4. **Fix the stale comment** in `src/lib/pinballmap/types.ts:23-30`. The current
   `PbmLmx` doc says the lmx id "is ephemeral … resolved from the latest snapshot
   at action time and never cached." That directly contradicts the locked
   store-and-heal model (we persist `pinballmap_lmx_id` and heal it). Rewrite it
   to describe store-and-heal.

5. **Integration test** — PGlite + direct call, PBM pinned to the mock client at
   the seam (CORE-TEST-006): singleton upsert, snapshot persist with health
   fields, and the error path (fetch throws → `last_sync_status = 'error'`,
   `last_sync_error` set, no throw).

### Explicitly out (→ other beads)

- **PP-o355.11:** cron route `/api/cron/pinballmap-sync`, hourly schedule,
  `status.ts` (`shouldBeListedOnPbm`, `derivePbmMachineStatus`), desync UI.
- **PP-o355.12:** `pinballmap.sync` permission matrix entry, "Sync now" action,
  vault token write, connect/link/list/unlist server actions, form UI.
- **PP-h059:** backfilling existing machines' `pinballmap_lmx_id` from the
  snapshot.

## Architecture / data flow

```
getPinballMapClient()  ──fetchLocation(APC_LOCATION_ID)──►  LocationSnapshot
        (seam; live or mock by env)                              │
                                                                 ▼  (outside txn)
                            syncLocationSnapshot()  ──upsert──►  pinballmap_state
                                                                 (snapshot_json + health)
```

- The fetch is the only side effect and runs **before/outside** any DB
  transaction — the upsert itself is a single statement, no wrapping txn needed.
- `.11` will call `syncLocationSnapshot()` on a cron; `.12` reads the persisted
  `snapshot_json` to resolve/verify lmx handles for link/unlist. Neither re-adds
  schema.

## Testing

- **Layer:** integration (PGlite + direct action call) per CORE-TEST-005 — this
  is server-action/query-correctness wiring, not a UI journey.
- **Mock the SDK at its boundary** (CORE-TEST-006): inject the mock
  `PinballMapClient`; never reach `pinballmap.com`.
- Cases: (1) first sync inserts the singleton with `snapshot_json` + `ok` health;
  (2) second sync updates it (upsert, not duplicate); (3) fetch throws → `error`
  health recorded, `syncLocationSnapshot` returns `{ ok: false }` without
  throwing. Schema CHECKs/partial-unique are exercised by the migration applying
  - a targeted insert conflict assertion if cheap.

## Risks / landmines

- **Migration renumber landmine:** generate fresh `0052`; never reapply `0046`.
  Verify `drizzle/meta/_journal.json` chains 0051 → 0052.
- **Partial-unique on existing data:** if two current machines already share a
  `pinballmap_machine_id` with `pinballmap_listed = true`, creating the unique
  index fails. Listing is a newish flag (default false, backfill is PP-h059), so
  risk is low — but the plan verifies against local seed before relying on it.
- **`snapshot_json` typing:** `$type<LocationSnapshot>()` is a compile-time cast
  only; the column is plain `jsonb`. The client is the source of the shape.
