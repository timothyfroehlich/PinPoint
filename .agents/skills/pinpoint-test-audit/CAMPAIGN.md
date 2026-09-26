# PinPoint Test-Pruning Campaign

Campaign mode prunes one subsystem's whole test surface in one coordinated effort: a major feature area (such as machine management, issue reporting, or notifications) or a test layer (such as the E2E suite or PGlite integration tests). The value bar, retention bar, candidate evidence, and validation rules in [SKILL.md](SKILL.md) apply to every lane.

This document defines the 8-phase execution pipeline and lessons from large-scale test refactoring. Each phase ends on a strict completion criterion; do not advance early.

## 1. Baseline

Work from a clean, dedicated worktree with isolated Supabase ports. Record the subsystem's production and test line counts (`wc -l`), and run the full relevant test suite at the starting `main` commit SHA.

Keep baseline failures in their own list: a baseline failure is treated as a possible product bug or unmigrated contract, never a test to silently delete.

**Completion criterion:** Every in-scope test file has a recorded baseline pass/fail result and line count.

## 2. Lanes and Inventory

Split the test surface into **lanes** along production owner boundaries, not file paths or directories. In PinPoint, canonical lanes correspond to functional subsystems:

- **Issues & Comments:** Lifecycle, status transitions, comment editing/deletion, audit logging;
- **Machines & Roster:** Inventory mutations, manufacturer tags, loaner/ownership tracking, quick search;
- **Auth & Permissions:** Role matrices, route protection, session cookies, user management;
- **Notifications & Mail:** Mailpit delivery, Discord webhook dispatch, notification formatting;
- **Integrations & Third-Party:** PinballMap sync, Vercel Blob storage, iScored mappings;
- **End-to-End Journeys:** Multi-step user journeys that genuinely require full browser orchestration (Class F bugs).

**Completion criterion:** Every in-scope test file and E2E spec belongs to exactly one lane.

## 3. Read-Only Ledger per Lane

For each lane, perform a read-only inspection of every test declaration and table case, cross-referencing production owners, callers, and history. Mark each test in a written **ledger**:

- **`R` (Retain):** Name the contract and the specific bug class (`CORE-TEST-005`) it catches. If a test moves to a canonical file, keep as `R` and note the target file.
- **`F` (Fix):** Retain the contract but repair a broken or vacuous assertion (e.g. replacing an assertion-free render or a `toBeVisible()` check with interaction verification).
- **`C` (Consolidate):** Name the owner that absorbs the assertion (e.g. folding duplicate standalone tests into an `it.each` table case in `issue-detail-permissions.test.ts` or `middleware.test.ts`).
- **`D` (Delete):** Name the stronger proof that remains (e.g. PGlite integration test proves the DB write and response, rendering mock unit test obsolete), or why no contract exists.

Judge every test by its actual assertions, not its title.

**Completion criterion:** Every test declaration in the lane has a ledger entry with a mark (`R`, `F`, `C`, `D`) and an evidence rationale.

## 4. Layer Plan per Lane

Look at the ledger holistically to identify redundant **layers**, rather than just deleting individual assertions:

- **Mocked DB unit tests vs. PGlite integration:** If a service is tested with heavily mocked Drizzle chains (`CORE-TEST-004`), retire the unit mocks in favor of worker-scoped PGlite integration tests (`src/test/integration/`).
- **E2E vs. Integration:** If an E2E spec only tests a single Server Action or permission gate without multi-page transitions, move the contract to an integration test and retire or reduce the E2E spec to a smoke test.
- **Identify test-only seams:** List all production exports, parameters, and bypasses (`isTest`, test-only query flags) that will become dead code once redundant tests are pruned.

**Completion criterion:** The lane plan names retired files, the keeper suite for each contract, assertions to merge into keepers, and unlocked production cleanups.

## 5. Cutover

Apply changes lane by lane:

1. Move or consolidate assertions into designated keeper suites.
2. Verify keeper suites pass using targeted test runners:
   - Unit: `pnpm run test <path>`
   - PGlite Integration: `pnpm run test:integration:target -- <path>`
   - E2E: `pnpm exec playwright test <path> --project=chromium`
3. Delete retired test files and dead test helpers.
4. Remove unlocked production seams (unexport internal helpers, delete test-only parameters).
5. Run `pnpm run check` after each lane.

**Completion criterion:** Every lane plan is executed, test-only seams are deleted, and all keeper suites pass.

## 6. Preservation Review & Mutation Testing

Verify that deleted tests did not leave critical contracts unguarded:

1. An independent review checks whether any core behavior lost its sole verification.
2. **Deliberate Mutation Testing:** For each core contract whose test was consolidated or pruned, introduce a deliberate 1-line syntax or logic mutation in the production owner (e.g. invert an `if (hasPermission)` condition or modify a query filter). Run the keeper test and verify it turns RED.
3. Revert the mutation byte-for-byte and verify the keeper test turns GREEN.

**Completion criterion:** Every consolidated contract has verified failure against a deliberate mutation, and all production files are restored.

## 7. Product Defects

Any baseline failure or defect revealed by the audit must be handled deliberately:

- Never delete a test simply because it is failing on `main`.
- Isolate the product bug.
- Fix it in the production owner as a separate, clearly labeled commit.
- Provide control proof (failing on pre-fix code) and candidate proof (passing on post-fix code).

**Completion criterion:** Repaired product bugs have demonstrated pre-fix failure and post-fix success.

## 8. Reconcile and Hand Off

Campaigns can touch many files. Keep git operations clean:

- Sync with merge from `origin/main`, never rebase.
- If `main` added new tests to a file the campaign deleted, port those new contracts into the canonical keeper file rather than resurrecting the dead test file.
- Run `pnpm run check` and targeted tests.
- Report metrics: baseline vs. final LOC (production vs. test), retired layers, keeper suites, and mutation proofs.

**Completion criterion:** PR opened following [pinpoint-pr-workflow](../pinpoint-pr-workflow/SKILL.md), CI passes, and review record posted.
