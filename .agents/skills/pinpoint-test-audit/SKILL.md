---
name: pinpoint-test-audit
description: Audit and prune existing PinPoint tests — find tests that duplicate a stronger owner, assert implementation, prove only their own mocks, or keep test-only production seams alive, then delete, fix, or consolidate them with recorded evidence. Use when asked to audit, sweep, or prune tests, when a test suite feels slow or redundant, or when planning a subsystem-wide test campaign. Writing a new test is `pinpoint-testing`.
---

# PinPoint Test Audit

An audit applies the same standard to existing tests that [`pinpoint-testing`](../pinpoint-testing/SKILL.md) applies to new ones: its authoring gate, its anti-pattern list, and the `CORE-TEST-*` rules in [NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing). Read that skill first; this one adds how to find candidates, the evidence a change needs, and how to land it.

Two modes:

- **Focused audit** — a few high-confidence candidates in one area, landed as one coherent PR. Broad audits continue as separate follow-up PRs. Optimize for confidence, not deletion count.
- **Campaign** — one subsystem's whole test surface, run as an epic bead with one child bead and one PR per lane. Read [CAMPAIGN.md](CAMPAIGN.md) before starting or picking up a campaign bead.

## Discovery

Discovery is read-only; report evidence before editing. For broad scope, split into parallel lanes by area:

- Server actions (`actions.ts` beside their routes under `src/app/`, plus `src/server/actions/`) and services (`src/services/`, `src/lib/<domain>/`);
- Route handlers and the request proxy (`src/app/api/`, `src/proxy.ts`, `src/lib/supabase/middleware.ts`);
- Components and hooks (`src/components/`, `src/hooks/`);
- E2E and smoke specs (`e2e/full/`, `e2e/smoke/`);
- Scripts and tooling (`scripts/`).

Hunt for the [anti-patterns](../pinpoint-testing/SKILL.md#test-anti-patterns) and for tests that fail the authoring gate today. Judge each test by its assertions, not its title.

## Retention Bar

Keep a test that independently guards a public API, migration invariant, security check, permission matrix row, platform constraint, default configuration, or architecture contract. Also keep:

- **Observable ordering:** tests that pin an order callers depend on, such as side effects delivered after commit (CORE-ARCH-011);
- **Boundary formatting:** tests of what PinPoint sends to Discord, Pinball Map, Vercel Blob, and other external services (CORE-TEST-006);
- **Regressions with a credible failure mode;**
- **Failing tests:** a failure on `main` is evidence (CORE-TEST-010) — reproduce it and fix the owner.

Static or slow is not a reason to delete. A test that resembles implementation may still be the only independent guard of its contract; prove otherwise before removing it.

## Candidate Evidence

Before editing, read the whole test and its production owner, the owner's callers and callees, overlapping tests, and the history of both (`git log -S`, the originating PR or bead). Then record each field below. A candidate with a missing field is not ready:

- Test name and file;
- The failure it can actually detect;
- Non-test callers of any seam it covers;
- The stronger owner that remains, with its bug class — or why no contract exists;
- Why the test or seam was added;
- Production or test-support code the change unlocks for deletion;
- Risk, and the focused command that validates the change.

## Edit Shape

Take one coherent batch per PR, grouped by production owner. Move retained regressions into their canonical file, collapse repeated assertions into one table, and delete the test-only exports, parameters, and wrappers the change leaves without a caller (CORE-TEST-008) rather than keeping aliases. Aim for a net reduction in production lines. Leave an uncertain candidate in place and list it as a follow-up.

## Validation

1. Run each touched keeper file at its layer:
   - Unit: `pnpm run test <path>`
   - PGlite integration: `pnpm run test:integration:target -- <path>`
   - Real-Supabase integration: `pnpm run test:integration:supabase`
   - E2E: `pnpm exec playwright test <spec> --project=chromium`
2. Commit the batch, then, for each contract whose test was deleted or consolidated, mutate the owner's behavior (invert the condition, drop the filter) and confirm the keeper goes red. Undo the mutation with `git restore <file>` — safe only because the batch is committed — and confirm green. A syntax error is not a mutation: it fails at parse time without testing the contract.
3. `pnpm run check`. Add `pnpm run smoke` when the batch touched auth, middleware, or UI specs, and `pnpm run preflight` when it touched production code in migrations, auth, or server actions. Offload heavy suites with the `crabbox` skill when the Mac is loaded.
4. `git diff --numstat`, reported as production and tooling lines versus test and test-support lines.

## Landing

Follow [`pinpoint-pr-workflow`](../pinpoint-pr-workflow/SKILL.md): dedicated worktree, draft PR, CI, local `/code-review` with a recorded review, then `bash scripts/workflow/merge-handoff.sh <PR>`. The PR body carries the handoff report:

- Categories of low-value tests removed, with the candidate evidence;
- Production simplifications and deleted test-only seams;
- Candidates kept after inspection, and why;
- Validation actually run, including mutation results;
- Production versus test line diff;
- Named follow-ups.
