# PinPoint Test-Pruning Campaign

A campaign prunes one subsystem's whole test surface in one coordinated effort: a feature area (machines, issues, notifications) or a test layer (the E2E suite, PGlite integration). Everything in [SKILL.md](SKILL.md) applies to every lane: the retention bar, candidate evidence, edit shape, and validation.

Each phase ends on a completion criterion; finish it before starting the next.

## 1. Baseline

Work in a dedicated worktree. Record the subsystem's production and test line counts, and run every in-scope suite at the starting `main` SHA (offload heavy suites with the `crabbox` skill). Keep baseline failures on their own list; each one is evidence of a product bug or an unmigrated contract (CORE-TEST-010), handled in phase 7.

**Done when:** every in-scope test file has a recorded pass/fail result and line count.

## 2. Lanes

Split the surface into lanes by production owner, not by test directory. Typical PinPoint lanes:

- **Issues and comments:** lifecycle, status transitions, comment edit/delete, timeline and audit trail;
- **Machines and roster:** machine CRUD, ownership and loaners, tags and collections, quick search;
- **Auth and permissions:** the permission matrix, route protection in the proxy, sessions, user management;
- **Notifications:** email via Mailpit, Discord dispatch, notification formatting;
- **Integrations:** Pinball Map sync, OPDB, iScored, Vercel Blob storage;
- **Journeys:** multi-page E2E flows (bug class F).

**Done when:** every in-scope test file and E2E spec belongs to exactly one lane.

## 3. Ledger

For each lane, read every test declaration and table case against its production owner, callers, and history. Mark each in a written ledger:

- **`R` Retain:** name the contract and its bug class (A–J in `pinpoint-testing`), and cite the `CORE-TEST-*` rule it enforces when one applies. A test moving to a canonical file stays `R` with the target file noted.
- **`F` Fix:** keep the contract, repair the assertion (an assertion-free render, a presence-only check that should drive the handler).
- **`C` Consolidate:** name the keeper that absorbs it, such as an `it.each` row in `src/lib/supabase/middleware.test.ts` or `src/test/integration/issue-detail-permissions.test.ts`.
- **`D` Delete:** name the stronger owner that remains, or why no contract exists.

**Done when:** every declaration in the lane has a mark and a written rationale.

## 4. Layer plan

Read each lane's ledger as a whole to find redundant layers, not just redundant tests:

- **Mocked DB unit tests vs. PGlite integration:** retire unit tests built on canned Drizzle mocks (CORE-TEST-004) in favor of PGlite integration tests of the same service.
- **E2E vs. integration:** when a spec exercises a single Server Action or permission check with no page transition, move that contract to an integration test and reduce the spec. Keep Playwright coverage for behavior an async Server Component owns (CORE-TEST-002); integration tests cannot render one.
- **Test-only seams:** list the exports, parameters, and bypasses that lose their last caller once the plan lands (CORE-TEST-008).

**Done when:** each lane's plan names retired files, the keeper for each contract, the assertions merging into keepers, and the production seams to delete.

## 5. Cutover

Per lane, in order:

1. Move or consolidate assertions into the keepers.
2. Run each keeper at its layer (commands in SKILL.md, Validation step 1).
3. Delete retired test files and their dead helpers.
4. Delete the production seams the plan listed.
5. `pnpm run check`.

**Done when:** every lane plan is applied, its seams are deleted, and all keepers pass.

## 6. Preservation proof

1. An independent reviewer (a subagent handed the diff and the ledger, not your conclusions) checks whether any contract lost its only test.
2. For every consolidated or deleted contract, run the mutation check from SKILL.md Validation step 2: mutate the owner's behavior, watch the keeper go red, restore, watch it go green.

**Done when:** every consolidated contract has a recorded red result against a behavior mutation, and the production files match `HEAD`.

## 7. Product defects

For each baseline failure and each defect the audit exposed: isolate the product bug, fix it in the production owner as its own commit, and record the test failing before the fix and passing after (CORE-TEST-007).

**Done when:** each repaired defect has recorded pre-fix failure and post-fix pass.

## 8. Reconcile and hand off

Merge `origin/main` into the branch. When `main` added tests to a file the campaign deleted, port those contracts into the keeper. Run `pnpm run check` and the keepers again, then land per SKILL.md. Add campaign metrics to the handoff report: baseline versus final lines (production and test), retired layers, keepers, and mutation results.

**Done when:** the PR is open per `pinpoint-pr-workflow`, CI passes, and the review record is posted.
