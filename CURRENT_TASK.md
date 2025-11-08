<!-- ⚠️ AGENTS: Keep this document updated with your progress! Update task statuses and notes as you complete work. -->

# Current Task: Issue Creation Spec & Test Implementation

## Branch Snapshot
- **Branch:** `feat_issue_creation`
- **Scope (unchanged):** Ship the Issue Creation feature spec plus full passing coverage for member and anonymous/QR flows before merge. Anonymous reporting stays in this branch so behavior parity is guaranteed.
- **State (2025-11-08):**
  - Feature spec + agent guidance are merged.
  - Unit validation suite is green (10/10 passing).
  - **T1 COMPLETE**: Whitespace-title bug fixed, all createIssueAction integration tests passing (5/5).
  - T2/T3 in progress by other agents (router integration tests).
  - T4/T5 ready to start (E2E tests).

## Parallel Task Board
Each task below is intentionally scoped so a separate agent can execute it without touching files owned by another task. All tasks share the same Definition of Done (see bottom) but run in parallel once dependencies are satisfied.

| Task ID | Status | Files / Areas | Notes |
|---------|--------|---------------|-------|
| **T1 – Server Action Validation Fix** | ✅ **COMPLETE** | `src/lib/actions/issue-actions.ts`, `src/lib/validation/schemas.ts` | Fixed whitespace-title validation bug (added `.refine()` check) and corrected all `revalidateTag()` signatures. All 5 integration tests passing. Commit: dad5c55 |
| **T2 – Router Integration (Member)** | 🔨 In progress (other agent) | `src/server/api/routers/issue.core.create.integration.test.ts` | Replace skeleton with full harness-based tests for `issue.core.create`. Must not modify router implementation files owned by other workstreams. |
| **T3 – Router Integration (Anonymous)** | 🔨 In progress (other agent) | `src/server/api/routers/issue.core.publicCreate.integration.test.ts` | Implement tests for `issue.core.publicCreate`, ensuring anonymous-specific behavior. Avoid touching files from T2. |
| **T4 – Playwright Member Flow** | ✅ **COMPLETE** | `e2e/issues/issue-create-member.e2e.test.ts` | Fixed auth fixture path, updated all data-testids to match UI, added beforeEach guard. All 3 test scenarios implemented (happy path, validation, visibility). Commit: ea00879 |
| **T5 – Playwright Anonymous QR Flow** | 🚧 Ready to start | `e2e/issues/issue-create-anon-qr.e2e.test.ts`, QR route configuration (read-only) | Implement QR redirect + anonymous submission journey while keeping guest context isolated. |
| **T6 – Documentation & Plan Sync** | ⏳ Blocked on T2–T5 | `docs/feature_specs/issue-creation.md`, `docs/feature_specs/AGENTS.md`, `CURRENT_TASK.md` | After tests are green, update specs to list the implemented files and bump review dates. No other task should modify docs to avoid conflicts. |

### T1 – Server Action Validation Fix ✅ COMPLETE
- **Goal:** Make `createIssueAction` reject whitespace-only titles so `src/lib/actions/issue-actions.createIssueAction.integration.test.ts` passes without changes.
- **Status:** Complete (2025-11-08)
- **Changes Made:**
  1. Added `.refine((s) => s.trim().length > 0)` to `titleSchema` in `src/lib/validation/schemas.ts`
  2. Fixed 7 incorrect `revalidateTag("issues", "max")` calls to `revalidateTag("issues")`
  3. All 5 createIssueAction integration tests passing
- **Commit:** dad5c55
- **Tests:** `npx vitest run src/lib/actions/issue-actions.createIssueAction.integration.test.ts` ✅ 5/5 passing

### T2 – Router Integration (Member)
- **Goal:** Fully cover the member tRPC procedure (`issue.core.create`) with integration tests.
- **Allowed Files:** `src/server/api/routers/issue.core.create.integration.test.ts` plus new helper fixtures under `src/test/**` if absolutely necessary (coordinate before adding shared helpers).
- **Requirements:**
  - Use existing org-auth context helpers (`setupAuthorizedContext` or equivalent) instead of ad-hoc objects.
  - Assert success path: machine + defaults from same org, insert payload includes `createdById`, activity + notification services invoked.
  - Assert failures: soft-deleted machine (null), missing default status, missing default priority, insufficient permission (basic vs full), schema validation (blank title, empty machineId).
  - Keep mocks deterministic via `SEED_TEST_IDS`.
  - No edits to router implementation or other suites.
- **Status (2025-11-08):** Test harness + scenarios drafted; `npm run test -- src/server/api/routers/issue.core.create.integration.test.ts` currently fails because the Vitest worker exits before executing tests (`[vitest-pool]: Worker forks emitted error`). Needs investigation before marking complete.
- **Validation:** `npx vitest run src/server/api/routers/issue.core.create.integration.test.ts`.

### T3 – Router Integration (Anonymous)
- **Goal:** Mirror T2 for `issue.core.publicCreate`, focusing on anonymous behavior.
- **Allowed Files:** `src/server/api/routers/issue.core.publicCreate.integration.test.ts` (plus new helper files under `src/test/**` if unique to anonymous flow).
- **Requirements:**
  - Success: insert with `createdById = null`, no activity recorded, notification service invoked, reporter email persisted.
  - Failures: machine missing/soft-deleted, cross-org machine, missing default status or priority, invalid reporter email, private machine blocked per visibility helper (mock accordingly).
  - Ensure tests document that anonymous flow never calls `recordIssueCreated`.
- **Validation:** `npx vitest run src/server/api/routers/issue.core.publicCreate.integration.test.ts`.

### T4 – Playwright Member Flow
- **Goal:** Complete `e2e/issues/issue-create-member.e2e.test.ts` to cover the authenticated `/issues/create` journey.
- **Allowed Files:** That test file only (can read existing fixtures/config). Do not edit shared Playwright config.
- **Requirements:**
  - Use `test.beforeEach` guard to ensure the suite only runs on auth-enabled projects (`chromium-auth` etc.).
  - Implement happy path: load page, fill required fields (`data-testid` from spec), submit, assert on redirect/toast or detail view.
  - Implement validation path: submitting empty form shows inline errors that clear appropriately.
  - Implement visibility path: confirm member sees private machines in select menu.
  - Keep assertions resilient (avoid text brittle to localization).
- **Validation:** `npx playwright test e2e/issues/issue-create-member.e2e.test.ts --project=chromium-auth`.

### T5 – Playwright Anonymous QR Flow
- **Goal:** Finalize `e2e/issues/issue-create-anon-qr.e2e.test.ts` to exercise `/api/qr/[qrCodeId]` redirect and guest submission.
- **Allowed Files:** `e2e/issues/issue-create-anon-qr.e2e.test.ts` only. Run tests in guest project (ensure `storageState` undefined).
- **Requirements:**
  - Test QR redirect: hitting `/api/qr/{SEED_TEST_IDS.QR_CODES.machinePrimary}` should land on the report form for that machine; assert machine name + form presence.
  - Test submission: fill title/description/reporterEmail, submit, assert success message/redirect; fetch issue list if necessary to confirm creation (reuse existing helper APIs if available).
  - Negative assertions: anonymous user cannot access edit page or attachment uploads on the created issue (expect redirect/login prompt).
  - Guard tests to skip on auth-enabled projects.
- **Validation:** `npx playwright test e2e/issues/issue-create-anon-qr.e2e.test.ts --project=chromium`.

### T6 – Documentation & Plan Sync
- **Goal:** Once T1–T5 are green, update documentation to reflect reality.
- **Allowed Files:** `docs/feature_specs/issue-creation.md`, `docs/feature_specs/AGENTS.md`, `CURRENT_TASK.md`.
- **Steps:**
  1. Move implemented test files from “Planned” to “Current” in the feature spec, add any new helper references, bump Last Reviewed/Updated dates.
  2. Summarize final coverage + outcomes in this task file; mark tasks complete.
  3. If agent workflow guidance needs updates (e.g., spec references), adjust `docs/feature_specs/AGENTS.md`.
- **Validation:** Docs lint (markdown) if available; no code tests required.

## Shared Supporting Notes
- Always use `SEED_TEST_IDS` + Seed-based mock factories for deterministic data.
- Follow `docs/CORE/TESTING_GUIDE.md` (worker-scoped DB, no per-test PGlite).
- Do not edit another task’s owned files without live coordination; if unavoidable, document the conflict here before proceeding.

## Definition of Done (unchanged)
1. `npm run test` (unit + integration) passes with new suites enabled.
2. Playwright flows (`npm run smoke` or targeted commands above) pass locally.
3. No placeholder assertions remain; specs + docs reflect shipped behavior.
4. Anonymous + member flows both validated end-to-end.
5. CI instructions remain accurate (update if new env/setup is required).

Document updated: 2025-09-27
