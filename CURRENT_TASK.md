# Current Task: Issue Creation Spec & Test Implementation

## Branch Snapshot
- **Branch:** `feat_issue_creation`
- **Goal:** Land the issue creation feature spec and a complete, passing test suite (unit, integration, E2E) before merge.
- **Current state:**
  - Feature spec updates (`docs/feature_specs/issue-creation.md` and supporting guidance) are merged locally and pushed.
  - New test files exist but contain WIP implementations that are not yet green.
  - Recent commits have been force-pushed so the remote branch now mirrors this trimmed history.
  - As of 2025-09-27 we are auditing each test file sequentially, reviewing intent, authoring the full spec, and executing TDD (write failing test, then fix source).

## Execution Plan (Rolling)
1. Work through the outstanding test suites one file at a time (ordering: deterministic alphabetical by path unless a dependency suggests otherwise).
2. For each file:
   - Summarize the coverage goals and acceptance criteria to confirm scope.
   - Rewrite/complete the test implementation to reflect the agreed spec, accepting red failures caused by missing production behavior.
   - Capture any discovered gaps or upstream bugs in inline `TODO` notes or the Supporting Tasks list.
3. After every test file lands green, revisit related source modules and fix regressions before moving to the next test file.
4. Maintain this document with deltas after each file (updated status table + notes).

## Test Suites That Need Full Implementation
| File | Purpose | Current Status | Required Work |
|------|---------|----------------|---------------|
| `src/lib/issues/assignmentValidation.issueCreation.unit.test.ts` | Pure validation logic for `validateIssueCreation` and helpers. | ✅ Implemented with seed-based mocks and passes. | (Follow-up) None pending — proceed to source fixes only if later tests reveal new gaps. |
| `src/server/api/routers/issue.core.create.integration.test.ts` | Authorized member flow through the tRPC router. | Still the original skeleton with `expect("test implemented").toBe("true")`. | Use server test harness helpers (org context, mocked drizzle) to exercise: success path (issue inserts, defaults applied, activity + notifications triggered) and failure cases (soft-deleted machine, missing defaults, permission denial, validation errors). Leverage `setupOrganizationMocks` / RLS-safe mocks and assert on both DB writes and emitted errors. |
| `src/server/api/routers/issue.core.publicCreate.integration.test.ts` | Anonymous QR flow through the public create router. | Skeleton only. | Similar to above but ensure `createdById` is `null`, no activity record, notifications triggered when configured, and RLS blocks cross-org or private machines. Include reporter email validation and missing default resource scenarios. |
| `src/lib/actions/issue-actions.createIssueAction.integration.test.ts` | Server Action wiring (FormData → validation → DB + cache). | 🚨 Implemented; suite red due to whitespace-title bug in production action (returns success instead of field error). | Source fix required: tighten `createIssueAction` title validation so whitespace fails, then ensure error messaging stays user-friendly. |
| `e2e/issues/issue-create-member.e2e.test.ts` | Member journey via `/issues/create`. | Steps partly filled in (uses Playwright and SEED IDs) but not yet validated against live UI. | Finish wiring with stable `data-testid`s; confirm seeds exist for referenced machines; ensure success assertion matches actual redirect/toast behavior. Add teardown if necessary to avoid polluting shared data, or rely on seed reset between tests. |
| `e2e/issues/issue-create-anon-qr.e2e.test.ts` | Anonymous QR flow from QR endpoint to report form. | Still mostly placeholder sections. | Implement using QR seed (from `SEED_TEST_IDS.QR_CODES`). Steps: call `/api/qr/{id}`, follow redirect, submit anonymous form, ensure issue created without auth and no private data leak. Cover validation and visibility rules (guest cannot reach private machines). |

## Supporting Tasks
- **Seed/Test Data:** Confirm every test uses `SEED_TEST_IDS` and seed-based mocks; avoid hard-coded UUIDs.
- **Helpers:** Identify the correct test utilities (`setupAuthorizedContext`, `SeedBasedMockFactory`, Playwright auth fixtures) and use them instead of custom mocks.
- **Cleanup:** Ensure each test restores mutated state (e.g., database records, caches) or runs inside existing reset helpers so it remains deterministic.
- **Documentation Sync:** Update the spec’s "Associated Test Files" list once implementations settle; right now it still lists planned files with placeholder statuses.

## Definition of Done
1. All six test suites execute and pass locally:
   - `npm run test` (unit + integration)
   - `npm run test:rls` if new RLS coverage added
   - `npm run smoke` / targeted Playwright command for the new E2E flows.
2. No `expect("test implemented")` or equivalent placeholders remain.
3. Assertions match the feature spec acceptance criteria (particularly around defaults, permissions, and notifications).
4. Spec documentation reflects the final test coverage and dates are bumped if behavior changed during implementation.
5. CI plan updated if additional setup (e.g., new auth fixture) is required.

Document updated: 2025-09-27
