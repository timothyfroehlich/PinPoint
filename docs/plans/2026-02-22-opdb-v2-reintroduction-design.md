# OPDB v2 Reintroduction Design

**Date**: 2026-02-22  
**Context**: Reintroduce OPDB-based machine metadata in PinPoint v2 without regressing current server-action architecture.

## Goal

Bring back OPDB integration so admins/technicians can search OPDB during machine creation, import canonical game metadata, and optionally refresh that metadata later.

## Current Architecture Constraints

- PinPoint v2 is server-action-first (not tRPC-first for new features).
- `machines` currently has instance fields (`name`, `initials`, ownership, presence) and no `models` table.
- Issues are keyed by `machineInitials`; machine identity and reporting flows should not be disrupted.
- Auth/security must follow Supabase SSR contract (`createClient()` -> immediate `auth.getUser()`), Zod input validation, and permission matrix alignment.
- Forms must keep progressive enhancement (`<form action={serverAction}>`).

## Options

### Option A (Recommended): Machine-Centric OPDB Metadata (Incremental)

Add optional OPDB metadata columns directly on `machines`. OPDB import enriches a machine record, but machine CRUD semantics stay unchanged.

Pros:

- Lowest migration and regression risk.
- Preserves current pages/actions with small, targeted edits.
- Fastest path to re-enable OPDB search/import.

Cons:

- Metadata duplicated across multiple copies of the same title.
- Less normalized than v1 `Model` architecture.

### Option B: Reintroduce Global `models` Table Now (v1-style)

Create `models`, link `machines.modelId`, move metadata ownership to models.

Pros:

- Canonical normalization; shared metadata across instances.
- Closest to late-v1 design.

Cons:

- High blast radius: create/update pages, listing queries, report flow, tests, and migration complexity.
- More risky for an active beta.

### Option C: Read-Through OPDB, No Persistence

Only use OPDB in UI typeahead; persist only machine name/initials.

Pros:

- Minimal DB changes.

Cons:

- Loses core value (metadata persistence/sync).

## Recommended Blueprint (Option A)

### 1) Data Model (Drizzle)

Add nullable OPDB columns to `machines`:

- `opdbId` (text, indexed, not unique)
- `opdbTitle` (text)
- `opdbManufacturer` (text)
- `opdbYear` (integer)
- `opdbImageUrl` (text)
- `opdbMachineType` (text)
- `opdbLastSyncedAt` (timestamp with timezone)

Rationale:

- Keeps existing machine identity untouched (`id`, `initials`, issue numbering).
- Supports multiple physical machines using same OPDB ID/title.

### 2) OPDB Integration Layer

Create a focused integration module:

- `src/lib/opdb/types.ts`: Zod-backed response contracts and TS types.
- `src/lib/opdb/client.ts`: token-authenticated client with timeout, basic rate limiting, and bounded in-memory caching.
- `src/lib/opdb/mappers.ts`: map OPDB payload -> machine OPDB fields.

Environment:

- Use `OPDB_API_URL` and `OPDB_API_KEY` (or `OPDB_API_TOKEN`, choose one canonical name and remove ambiguity).
- Centralize env reads in OPDB module; never expose token client-side.

### 3) Server Actions + API Surface

Keep progressive-enhancement forms while enabling typeahead UX:

- Add server action(s) in machine domain for:
  - `importMachineFromOpdbAction` (called on create/update submit)
  - `syncMachineOpdbMetadataAction` (manual refresh from detail page)
- Add a guarded route handler for search suggestions (authenticated admin/technician only):
  - `GET /api/opdb/search?q=...`

Validation and auth:

- Validate OPDB ID/query with Zod.
- Enforce auth/role checks exactly as existing machine create/edit rules.

### 4) UI Flow

Enhance existing machine create/edit UI (no MUI, keep current shadcn patterns):

- Add “Search OPDB” combobox to `src/app/(app)/m/new/create-machine-form.tsx`.
- On selection, prefill hidden OPDB fields and optionally prefill machine name.
- Keep manual entry path fully functional if OPDB fails or user skips import.
- In machine detail/edit, add a “Refresh OPDB Data” control for admin/technician.

### 5) Rollout Strategy

Phase 1 (MVP comeback):

- Schema columns + OPDB client + create/edit import + detail refresh.

Phase 2 (operational polish):

- Admin page for stale-metadata review and bulk refresh.
- Optional async job/cron sync (only if needed after usage).

Phase 3 (optional normalization):

- If duplication pain becomes real, migrate to `models` table later with staged backfill.

## Error Handling & Safety

- If OPDB is unavailable/timeouts: log warning, continue with manual machine creation.
- Do not hard-fail machine creation on OPDB lookup failures.
- Store last successful sync timestamp for observability and stale badges.
- Keep OPDB responses sanitized and bounded; no raw untrusted HTML.

## Testing Plan

Unit:

- OPDB ID parsing/validation + payload mapping + cache key behavior.

Integration (worker-scoped PGlite):

- create/update machine actions with OPDB metadata import path.
- auth and role enforcement for search/import/sync.

E2E:

- Add-machine flow with OPDB search selection and successful create.
- Failure fallback path (OPDB unavailable -> manual create still works).
- Any new clickable UI (search result select / refresh button) must be exercised in E2E.

## Non-Goals (for reintroduction)

- Full v1 model normalization in first pass.
- Automatic hourly background sync from day one.
- Public/unauthenticated OPDB search endpoint.

## Success Criteria

- Admin/technician can search OPDB and create a machine with imported metadata.
- Existing machine/report/issue flows continue unchanged.
- OPDB failure never blocks manual machine creation.
- Tests cover import path, fallback path, and permissions.
