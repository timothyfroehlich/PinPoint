# PinPoint Test-Pruning Campaign

A campaign prunes one subsystem's whole test surface, such as a feature area (machines, issues, notifications) or a test layer (the E2E suite, PGlite integration). Everything in [SKILL.md](SKILL.md) applies to every lane: the retention bar, candidate evidence, edit shape, and validation.

A campaign is an **epic bead** with one **child bead per lane**. A baseline bead runs first. Each lane bead then lands as its own PR, so every review covers one production owner. The beads are the durable record, and each session reads its lane's bead before starting:

| Bead   | `--design` holds                        | `--notes` holds                              |
| ------ | --------------------------------------- | -------------------------------------------- |
| Epic   | Baseline results and the lane→file map  | Links to lane PRs; campaign metrics at close |
| Lane   | That lane's ledger, then its layer plan | Branch, PR, mutation results, follow-ups     |
| Defect | The failing test and the isolated cause | PR and pre-/post-fix results                 |

Write the design text in the session scratchpad and sync it with `bd update <id> --design-file <path>`. Re-run the command whenever the ledger or plan changes; Dolt keeps each version (`bd history <id>`).

Each phase ends on a completion criterion; finish it before starting the next.

## Baseline bead

### 1. Baseline

Record the subsystem's production and test line counts, and run every in-scope suite at the starting `main` SHA (offload heavy suites with the `crabbox` skill). Each baseline failure is evidence of a product bug or an unmigrated contract (CORE-TEST-010). File a defect bead for each one under the epic.

**Done when:** every in-scope test file has a recorded pass/fail result and line count in the epic's design, and every failure has a defect bead.

### 2. Lanes

Split the surface into lanes by production owner, not by test directory. Typical PinPoint lanes:

- **Issues and comments:** lifecycle, status transitions, comment edit/delete, timeline and audit trail;
- **Machines and roster:** machine CRUD, ownership and loaners, tags and collections, quick search;
- **Auth and permissions:** the permission matrix, route protection in the proxy, sessions, user management;
- **Notifications:** email via Mailpit, Discord dispatch, notification formatting;
- **Integrations:** Pinball Map sync, OPDB, iScored, Vercel Blob storage;
- **Journeys:** multi-page E2E flows (bug class F).

**Done when:** every in-scope test file and E2E spec belongs to exactly one lane in the epic's design, and each lane has its own bead under the epic.

## Lane bead

Each lane is one worktree, one branch, and one PR. Lanes are independent, so separate sessions can run them in parallel. If a layer plan would make a PR too large to review in one sitting, split the lane into child beads, one PR each. Land the keeper additions before the deletions that depend on them.

### 3. Ledger

Read every test declaration and table case in the lane against its production owner, callers, and history. Mark each one in the ledger:

- **`R` Retain:** name the contract and its bug class (A–J in `pinpoint-testing`), and cite the `CORE-TEST-*` rule it enforces when one applies. A test moving to a canonical file stays `R`, with the target file noted.
- **`F` Fix:** keep the contract, repair the assertion (an assertion-free render, a presence-only check that should drive the handler).
- **`C` Consolidate:** name the keeper that absorbs it, such as an `it.each` row in `src/lib/supabase/middleware.test.ts` or `src/test/integration/issue-detail-permissions.test.ts`.
- **`D` Delete:** name the stronger owner that remains, or why no contract exists.

**Done when:** every declaration in the lane has a mark and a written rationale in the lane bead's design.

### 4. Layer plan

Read the ledger as a whole to find redundant layers, not just redundant tests:

- **Mocked DB unit tests vs. PGlite integration:** retire unit tests built on canned Drizzle mocks (CORE-TEST-004) in favor of PGlite integration tests of the same service.
- **E2E vs. integration:** when a spec exercises a single Server Action or permission check with no page transition, move that contract to an integration test and reduce the spec. Keep Playwright coverage for behavior an async Server Component owns (CORE-TEST-002); integration tests cannot render one.
- **Test-only seams:** list the exports, parameters, and bypasses that lose their last caller once the plan lands (CORE-TEST-008).

**Done when:** the lane bead's design names the retired files, the keeper for each contract, the assertions merging into keepers, and the production seams to delete.

### 5. Cutover

1. Move or consolidate assertions into the keepers.
2. Run each keeper at its layer (commands in SKILL.md, Validation step 1).
3. Delete retired test files and their dead helpers.
4. Delete the production seams the plan listed. The E2E harness is out of scope (CORE-TEST-008).
5. `pnpm run check`, then commit.

**Done when:** the plan is applied, its seams are deleted, and all keepers pass.

### 6. Preservation proof

1. An independent reviewer (a subagent or fresh session handed the diff and the ledger, not your conclusions) checks whether any contract lost its only test.
2. With the cutover committed, run the mutation check from SKILL.md Validation step 2 for every consolidated or deleted contract: mutate the owner's behavior, watch the keeper go red, restore, watch it go green.

**Done when:** every consolidated contract has a recorded red result against a behavior mutation in the lane bead's notes, and the production files match `HEAD`.

### 7. Land

Merge `origin/main`. When `main` added tests to a file this lane deleted, port those contracts into the keeper. Run `pnpm run check` and the keepers again, then land per SKILL.md. Add the lane's line diff (production and test) and mutation results to the PR body.

**Done when:** the PR is open per `pinpoint-pr-workflow`, CI passes, the review record is posted, and the lane bead's notes carry the PR.

## Defect bead

For each baseline failure, and each defect a lane exposes: isolate the product bug and fix it in the production owner in its own PR. Record the test failing before the fix and passing after (CORE-TEST-007). A lane whose keeper depends on the fix is blocked by the defect bead (`bd dep add <lane> <defect>`).

**Done when:** the fix PR is open with the pre-fix failure and post-fix pass recorded.

## Closing the campaign

When every lane and defect bead is closed, record the campaign metrics in the epic's notes: baseline versus final lines (production and test), retired layers, keepers, and mutation results. Then close the epic.
