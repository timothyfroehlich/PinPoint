# Unit / Integration Test Suite Audit — 2026-06

**Status:** DRAFT — pending Tim review of verdicts before the reclass/rewrite waves are filed as beads.
Wave 1 whole-file deletes (4 files: 3 redundant + 1 obsolete) are executed in the PR that carries this
doc; everything else is a proposal.
**Scope:** All three Vitest projects — `unit` (jsdom), `integration` (PGlite), `integration-supabase`
(local Supabase). ~1,473 classified `it`/`test` leaf blocks across 176 files (raw regex count is higher
due to `it.each` expansion).
**Method:** 6 domain-sliced subagents read every test body, cross-referenced existing coverage, and
classified each block by bug class + verdict. Framework is canonical in the `pinpoint-testing` skill
§ "Bug Classes & Cheapest Catching Layer" and mirrors `docs/testing/e2e-audit-2026-05.md`.

## TL;DR

- **The suite is largely healthy.** ~1,260 of ~1,473 blocks (85%) are KEEP at the correct layer. There
  is **no skip/todo debt and no snapshot debt**, and class-J is mostly well-contained.
- **The dominant problem is CORE-TEST-004**: **~120 blocks are mocked-DB/action "unit" tests** that
  should be PGlite integration tests (or are already covered by one). Worst offenders: `machine-actions`
  (38), `services/issues` (9 via `vitest-mock-extended`), `lib/issues/queries` (10, mocks both
  `~/server/db` _and_ `drizzle-orm`), `issue-actions` (7), `public-issue-security` (6).
- **~31 blocks are outright deletes** (18 redundant + 8 inert + 5 obsolete). Of these, **8 whole/near-whole
  files** collapse cleanly.
- **One P0 hazard (class-J / CORE-TEST-006), now removed:** the whole `src/test/unit/mailpit-utils.test.ts`
  defines `decodeHtmlEntities` + `extractPasswordResetLink` **inline** (imports nothing real) and asserts
  **GoTrue's email template format**. `extractPasswordResetLink` no longer exists in the real
  `e2e/support/mailpit.ts`, so the file tested dead inline copies — zero coverage of shipped code. Deleted
  in this PR.
- **One audit hint was WRONG and caught by verification:** `src/test/unit/dates.test.ts` is **not** a
  duplicate of `src/lib/dates.test.ts` (disjoint exports). Both KEEP. (Recorded because it shows the
  per-block re-verification is load-bearing — do not delete on a filename hunch.)
- **~39 REWRITE** (mostly brittle Tailwind class-string assertions in components + a couple of
  fragile-mock integration tests) and **6 MERGE** (auth-validation → co-located schemas).
- **CI cost:** the win here is correctness/clarity, not runtime — unit/integration are already fast.
  The value is killing false-confidence tests (test-the-mock) and stopping the mocked-DB pattern from
  spreading.

## Aggregate verdict counts (≈, leaf blocks)

| Verdict                   |  Count | Notes                                                |
| ------------------------- | -----: | ---------------------------------------------------- |
| KEEP                      | ~1,260 | correct layer                                        |
| RECLASS-integration       |   ~111 | mocked-DB/action unit → PGlite                       |
| RECLASS-unit              |      9 | pure Zod/comparator blocks misfiled _as_ integration |
| DELETE-redundant          |     18 | covered elsewhere (cited)                            |
| DELETE-inert              |      8 | assert only that a mock was called                   |
| DELETE-obsolete (class-J) |      5 | tests dead inline copies of third-party email format |
| REWRITE                   |     37 | brittle/impl-detail assertions                       |
| MERGE                     |      6 | fold into sibling                                    |

Per-slice raw reports: `/tmp/unit-audit/slice-1.md` … `slice-6.md` (working artifacts, not committed).

## P0 hazard (resolved in this PR)

### `src/test/unit/mailpit-utils.test.ts` (whole file, 5 blocks) — class-J / CORE-TEST-006

The file `import`s nothing from production or E2E code: it defines `decodeHtmlEntities` and
`extractPasswordResetLink` **inline** (lines 22 and 36) and tests those copies, asserting the **GoTrue
password-reset email template format** — i.e. Supabase Auth's output, not PinPoint code. The real
`e2e/support/mailpit.ts` keeps its own separate `decodeHtmlEntities` and **no longer has
`extractPasswordResetLink` at all**, so the unit file covered dead inline copies and provided zero
coverage of anything we ship (casework PP-q9r). Per AGENTS.md §2.1 rule #13 ("test what we own"),
third-party output must be mocked at the boundary. **Verdict: DELETE the whole file** — done in this PR
(see Wave 1). No coverage lost; nothing imports it.

## Wave plan

### Wave 1 — whole-file redundant deletes (EXECUTED in this PR; replacement verified by test-name diff)

| #   | Delete                                                 | Blocks | Replacement (verified)                                                                                                                                                    |
| --- | ------------------------------------------------------ | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/auth/internal-accounts-notifications.test.ts` |      3 | `src/lib/auth/internal-accounts.test.ts` covers internal=true / regular=false / partial-domain=false                                                                      |
| 2   | `src/app/(app)/settings/notifications/actions.test.ts` |      1 | `src/test/integration/notification-preferences-action.test.ts` covers persistence + auth + defaults (drops only the low-value `revalidatePath` literal assertion — inert) |
| 3   | `src/test/unit/public-issue-validation.test.ts`        |      3 | `src/app/(app)/report/validation.test.ts` is a strict superset (8 cases vs 3)                                                                                             |
| 4   | `src/test/unit/mailpit-utils.test.ts`                  |      5 | none needed — tests dead inline copies; real `decodeHtmlEntities` lives in `e2e/support/mailpit.ts`, `extractPasswordResetLink` no longer exists (P0 class-J)             |

### Wave 2 — free-win deletes bundled into their file's cleanup/reclass PR (proposals)

These are genuine deletes/inert removals but live in files that are _also_ being reclassed or rewritten,
so they ship in that file's PR to avoid a partial edit that leaves a broken `describe`/imports:

- `src/test/unit/machine-actions.test.ts` — 7 redundant blocks (covered by
  `src/test/integration/machine-owner-promotion.test.ts`); the other 38 blocks in this file are
  RECLASS-integration, so handle the whole file at once.
- `src/test/integration/machines.test.ts` — 4 "Machine Presence Filtering" blocks duplicate unit
  `src/test/unit/lib/machines/filters-queries.test.ts` (delete the _integration_ copies); file also has
  RECLASS-unit Zod blocks.
- `src/app/(app)/.../export-action.test.ts` — 3 inert filter-arg assertions.
- `src/app/(app)/report/actions.test.ts` — 2 inert DB-error blocks (file also has 3 RECLASS blocks).
- `src/test/integration/database-queries.test.ts` — 2 inert raw-Drizzle blocks.

### Wave 3 — RECLASS-integration into an EXISTING target (extend, then delete the unit file)

| Source (unit, mocked DB)                               | Blocks | Landing target (exists)                                                   |
| ------------------------------------------------------ | -----: | ------------------------------------------------------------------------- |
| `src/services/issues.test.ts`                          |      9 | `src/test/integration/issue-services.test.ts`                             |
| `src/test/unit/machine-actions.test.ts`                |     38 | `machine-owner-promotion.test.ts` + `machine-timeline-actions.test.ts`    |
| `src/lib/issues/queries.test.ts`                       |     10 | template `supabase/issue-filtering.test.ts` (new `getIssues` integration) |
| `src/test/unit/issue-actions.test.ts`                  |      7 | `issue-services.test.ts` + `issue-detail-permissions.test.ts`             |
| `src/test/unit/public-issue-security.test.ts`          |      6 | `report/actions.test.ts` or new integration file                          |
| `src/app/(app)/settings/delete-account-action.test.ts` |      5 | `account-deletion.test.ts`                                                |
| `src/server/actions/images.test.ts`                    |      3 | `supabase/images.test.ts`                                                 |
| `change-password-action.test.ts`                       |      3 | `supabase/auth-actions.test.ts`                                           |

### Wave 4 — RECLASS needing NEW integration infra first (gated)

- `src/test/unit/delete-comment-audit.test.ts` (11) → **new** `src/test/integration/issue-comment-actions.test.ts`
  (`deleteCommentAction`/`addCommentAction`/`editCommentAction` have no integration coverage today).
- `src/lib/blob/cleanup.test.ts` (7) → new PGlite integration for the DB half of `cleanupOrphanedBlobs`.
- `src/test/unit/machines.test.ts` (6, watcher service) → extend `src/test/integration/machines.test.ts`
  with a watcher section.

### Wave 5 — REWRITE + MERGE (cosmetic / quality)

- **Components (16):** replace brittle Tailwind class-string assertions
  (`max-w-6xl`, `text-[10px]`, `bottom-[calc(...)]`) with behavioral assertions; extract
  `FeedbackWidget` param-building + `mailpit-utils` `decodeHtmlEntities` to pure exported utils;
  rewrite `NotificationList` to assert observable UI state, not mock calls.
- **Integration (17):** `src/test/integration/issue-services.test.ts` uses a fragile
  `globalThis.testDb` proxy mock — switch to the canonical `{ db: await getTestDb() }` pattern.
- **MERGE (6):** fold `src/test/unit/auth-validation.test.ts` `loginSchema` cases into
  `src/app/(auth)/schemas.test.ts`; move its `signupSchema` coverage there too (no co-located home today).

## Observations beyond the per-block verdicts

1. **The mocked-DB unit-test pattern is the single systemic issue.** It produces both the RECLASS
   backlog _and_ most of the ~310 "inert" assertions (tests that only check `toHaveBeenCalledWith`
   against a hand-fed mock). Worth a `pinpoint-testing` skill amendment: a unit test that `vi.mock`s
   `~/server/db` is a smell — prefer PGlite integration.
2. **Two route handlers** (`api/client-logs.route.test.ts`, `api/unsubscribe.route.test.ts`) are pure
   handler unit tests filed under `integration/` with no DB access — harmless, but mislocated (P4).
3. **`admin/discord-integration-actions.test.ts`** mocks the DB via `vi.fn()` chains _intentionally_
   (Vault functions can't run in PGlite, documented) — NOT a misfile; leave it.
4. **Background-agent reliability:** 2 of the 8 dispatched audit subagents died at launch (119-byte
   transcript, no output) and were detected via output-file freshness + re-dispatched. Noted for future
   orchestration runs.

## Verification of the Wave 1 deletes

- `pnpm run check` (typecheck + lint + `unit` project) green.
- `pnpm run test:integration` green (confirms the integration replacements still pass).
- Nothing imports the deleted `*.test.ts` files. All 4 live in the `unit` project, which drops
  143 → 139 files / 12 blocks and stays green at **1,269 tests**; the `integration` project is unchanged
  and green at **207 tests** (confirms the `notification-preferences-action` replacement still passes).
