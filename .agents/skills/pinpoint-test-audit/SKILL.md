---
name: pinpoint-test-audit
description: Invoke whenever writing, changing, reviewing, or sweeping tests in PinPoint. Authoring gate for new tests plus audit workflow for low-value, implementation-coupled, or duplicative tests and test-only production seams.
---

# PinPoint Test Audit

Three modes, one value bar. Authoring mode gates every new or changed test at write time. Audit mode runs focused sweeps of tests that re-assert source, duplicate stronger proof, couple behavior to implementation, or keep test-only production seams alive. Continue broad audits as separate coherent follow-up PRs; optimize for confidence, not deletion count. Campaign mode prunes one whole subsystem's test surface (every test file a feature or core area owns); before starting one, read [CAMPAIGN.md](CAMPAIGN.md).

Complements [pinpoint-testing](../pinpoint-testing/SKILL.md) and [pinpoint-e2e](../pinpoint-e2e/SKILL.md), enforcing the binding testing rules in [docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing) (`CORE-TEST-001` through `CORE-TEST-006`).

## Authoring Gate

Before adding any test, answer four questions; a missing answer means do not add it yet:

1. **What observable behavior, invariant, or independent contract does it protect?**
   (Map to PinPoint bug classes A through J from [pinpoint-testing](../pinpoint-testing/SKILL.md)).
2. **What credible regression makes it fail?**
3. **Why does existing coverage not already catch that failure?**
   Each contract has one primary test owner at the cheapest catching boundary (`CORE-TEST-005`). Another layer needs its own distinct risk, such as a transport or lifecycle failure the owner cannot reach. Prefer extending an existing canonical test file (e.g. extending table cases in `middleware.test.ts` or `issue-detail-permissions.test.ts`) over authoring a new file or near-duplicate test. Consolidate duplicated setup in the same change.
4. **Does it need a production seam (export, flag, wrapper, injection hook) that no production caller needs?**
   If yes, move the test to the real boundary instead. Never export internal helpers or add bypass parameters solely to satisfy a test.

Then check the test against every [junk pattern](#junk-patterns); a match fails the gate unless the [retention bar](#retention-bar) names the contract it independently guards. A test that would break under behavior-preserving refactoring is asserting implementation, not behavior; rewrite it at the owning boundary before landing it.

Bug regression tests must fail on the pre-fix code for the intended reason and pass after the owner-boundary repair. A regression test that never demonstrably failed proves the mock, not the fix. One regression at the owner boundary covers the bug; do not replay the same scenario across unit, integration, and E2E layers.

## Junk Patterns

The shared checklist for authoring and audit modes: the authoring gate rejects a new test that matches one, and audits hunt for existing tests that do.

### General Test Anti-Patterns

- **Assertion-free coverage probes:** Tests that execute code paths without verifying outcomes or state mutations.
- **Self-comparisons and identity copiers:** Tautological tests where the expected value is produced by the helper, serializer, or renderer under test.
- **Copied fixtures, inventories, manifests, or export lists:** Restating code lists or schemas in test assertions that duplicate source code.
- **Exact source, import, or string greps:** Asserting AST shapes or import paths rather than behavioral contracts.
- **Private predicate or call-shape tests duplicated at real boundaries:** Testing internal helper functions separately when boundary integration tests already exercise the exact same branches.
- **Duplicate invocations of the same contract:** Multiple tests verifying the same underlying permission or validation with trivial variation.
- **Mocks that implement the asserted behavior:** Handcrafted mock functions that emulate business logic or canned response generators standing in for multiple APIs.
- **Vacuous / False-assurance negative controls:** Tests passing for an unrelated failure (e.g., failing on auth middleware when testing input validation, or asserting a rejection that production code never reaches).
- **Misleading names or fixtures:** Tests promising more than the input exercises (e.g., naming a test "resets form on error" while only asserting error message visibility without checking field values).

### PinPoint-Specific Junk Patterns

- **Mocking Drizzle ORM method chains or DB clients (`CORE-TEST-004`):** Writing unit tests with `vi.mock("~/server/db")` returning canned objects or mocking `.select().from().where()`. Use integration tests with worker-scoped PGlite via `getTestDb()` instead.
- **Synthesizing third-party internals (`CORE-TEST-006`):** Scaffolding that mimics external service state (e.g. raw SQL inserts into `auth.identities`, fake OAuth provider round-trips, regex extraction from Supabase or Mailpit email templates). Test PinPoint's boundary code with unit tests, verify page rendering with smoke, and test real owned services only.
- **Production seam leaks:** Exporting private server action helpers, unexported database queries, or adding `isTest` / bypass parameters to route handlers or middleware just for Vitest access.
- **Unit testing async React Server Components (`CORE-TEST-002`):** RSCs are integration concerns. Test them via Playwright E2E or test their underlying server actions / data loaders with PGlite integration tests.
- **Surface-only element checks without interaction (`CORE-TEST-005`):** Asserting `expect(button).toBeVisible()` without triggering the handler. If an interactive control exists, test the actual interaction at the cheapest catching layer.
- **Over-mocked external SDKs in E2E (`CORE-TEST-006`):** Calling live external third-party endpoints or excessively stubbing them in browser E2E runs. Mock external SDKs cleanly at `src/lib/<sdk>/` client boundaries.

## Value Bar

Tests justify their maintenance cost by protecting behavior, a credible regression, or an independently meaningful contract. In an audit, an existing test that must change for behavior-preserving source reorganization is suspect, not automatically deletable; the authoring gate still rejects new ones.

Before judging a candidate, read the complete test and production owner, its entry point, callers, callees, sibling implementations, overlapping tests, CI routing, and relevant history. Read root and scoped `AGENTS.md` files first. When the test claims dependency-backed behavior, inspect the dependency source or types directly.

## Discovery

Keep discovery read-only and report evidence before editing. For broad scope, run parallel discovery lanes when available:

- Core data layer and server actions (`src/server/`, `src/actions/`);
- Route handlers and middleware (`src/app/api/`, `src/lib/supabase/middleware.ts`);
- Components and UI hooks (`src/components/`, `src/hooks/`);
- E2E and smoke suites (`e2e/`);
- Scripts and tooling (`scripts/`).

Outside campaign mode, prefer a few high-confidence candidates over a large speculative inventory. Hunt for the [junk patterns](#junk-patterns).

## Retention Bar

Keep a test when it independently enforces a public API, database migration invariant, security check, role permission matrix, platform constraint, default configuration, or architecture contract. Also keep:

- **Call and side-effect ordering** when ordering is an observable contract (e.g. `CORE-ARCH-011`: external side effects delivered post-commit, never inside a DB transaction);
- **Regressions with a credible failure mode;**
- **Boundary contract checks:** Tests that verify PinPoint's boundary formatting to external services (Discord webhooks, PinballMap client calls, Vercel Blob);
- **Baseline failures:** Treat a failing test on the baseline as a potential product bug, reproduce it, and repair the production owner rather than deleting the test.

Static or slow is not a deletion reason. A test that resembles implementation may still be the independent contract; prove otherwise before removing it.

## Candidate Evidence

Record every field below before editing. A missing field means the candidate is not ready for deletion:

- Exact test name and location;
- What failure it can actually detect;
- Non-test callers of the covered production or support seam;
- Stronger remaining owner-boundary proof, or why no proof is needed (cite bug class from [pinpoint-testing](../pinpoint-testing/SKILL.md));
- Relevant history and the reason the test or seam exists;
- Production or test-support deletion unlocked (e.g. removing unused export or internal helper);
- Risk and the focused validation command.

## Edit Shape

Choose one coherent owner-boundary batch. Delete obsolete test-only exports, globals, wrappers, and dead production paths instead of preserving aliases. Move retained regressions to their canonical owners. Consolidate repeated assertions into one generic table or contract.

Prefer net-negative production LOC. Do not add replacement tests that restate the same implementation, and do not convert uncertain candidates into cleanup to increase deletion counts.

## Validation

Never edit source or tests while Vitest is running in the checkout.

1. **Focused owner verification:**
   - Unit test: `pnpm run test <path>` (no `--`)
   - Integration test (PGlite): `pnpm run test:integration:target -- <path>`
   - Supabase integration test: `pnpm run test:supabase`
   - Targeted Playwright E2E: `pnpm exec playwright test e2e/path/file.spec.ts --project=chromium` (never run bare `playwright test`)
2. **Smoke verification:** `pnpm run smoke`
3. **Static validation:** `pnpm run check` (static lint, format, typecheck, actionlint, ruff, shellcheck)
4. **Heavier suites (when required):** If DB schema, migrations, server actions, or auth are modified, run `pnpm run preflight`. For heavy suites under local load, offload to Bazzite via Crabbox (`crabbox` skill).
5. **Inspect diff:** Run `git diff --numstat`; report production/tooling separately from tests and test support.

## Landing and Continuation

Commit, push, open a PR, or land only following the repository workflow ([pinpoint-pr-workflow](../pinpoint-pr-workflow/SKILL.md)):

- Run on a dedicated worktree;
- Open PR as draft;
- Monitor CI;
- Request Claude Code `/code-review` and record review record;
- Hand off with `bash scripts/workflow/merge-handoff.sh <PR>`.

## Handoff Report

Report:

- Root cause and removed low-value categories;
- Production owner simplifications and deleted test-only seams;
- Retained false positives and why they remain valuable;
- Focused and full proof actually run;
- Production versus test LOC diff;
- PR and merge state;
- Named follow-ups.
