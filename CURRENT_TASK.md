<!-- ⚠️ AGENTS: Keep this document updated with your progress! Update task statuses and notes as you complete work. -->

# Current Task: Issue Creation Spec & Test Implementation

## Branch Snapshot
- **Branch:** `feat_issue_creation`
- **Scope (unchanged):** Ship the Issue Creation feature spec plus full passing coverage for member and anonymous/QR flows before merge. Anonymous reporting stays in this branch so behavior parity is guaranteed.
- **State (2025-11-08):**
  - Feature spec + agent guidance are merged.
  - Unit validation suite is green (10/10 passing).
  - T1 fix landed but still uses deprecated `revalidateTag` signature.
  - T2/T3 suites exist but miss middleware coverage/visibility scenarios.
  - T4 remains a placeholder (not implemented yet).
  - T5 Playwright suite now runs green but introduces DB/policy follow-ups.
  - Implementation gaps documented per task (see Gap Analysis).

## Parallel Task Board
Each task below is intentionally scoped so a separate agent can execute it without touching files owned by another task. All tasks share the same Definition of Done (see bottom) but run in parallel once dependencies are satisfied.

| Task ID | Status | Files / Areas | Notes |
|---------|--------|---------------|-------|
| **T1 – Server Action Validation Fix** | ⚠️ Needs follow-up | `src/lib/actions/issue-actions.ts`, `src/lib/validation/schemas.ts` | Whitespace-title fix shipped, but `revalidateTag("issues")` still uses deprecated single argument. Update both actions to pass `"max"` (or use `updateTag`). |
| **T2 – Router Integration (Member)** | ⚠️ Needs fixes | `src/server/api/routers/issue.core.create.integration.test.ts` | Harness bypasses middleware, so `issueCreateProcedure` isn’t exercised, and there’s no coverage of permission downgrade (basic vs full). Rework to use the canonical context helper and add the missing scenario. |
| **T3 – Router Integration (Anonymous)** | ⚠️ Needs follow-up | `src/server/api/routers/issue.core.publicCreate.integration.test.ts` | Happy path covered, but no test asserts that private/invisible machines are rejected. Add visibility coverage. |
| **T4 – Playwright Member Flow** | ⏳ Not started | `e2e/issues/issue-create-member.e2e.test.ts` | File is still the original scaffold (no guards, incorrect selectors). Needs full implementation. |
| **T5 – Playwright Anonymous QR Flow** | ⚠️ Follow-ups open | `e2e/issues/issue-create-anon-qr.e2e.test.ts`, snapshot helpers | Suite passes, but helper writes directly to Postgres and leaves org defaults mutated. Replace with sanctioned APIs and reset state post-test. |
| **T6 – Documentation & Plan Sync** | ⏳ Blocked on T2–T5 | `docs/feature_specs/issue-creation.md`, `docs/feature_specs/AGENTS.md`, `CURRENT_TASK.md` | After tests are green, update specs to list the implemented files and bump review dates. No other task should modify docs to avoid conflicts. |
| **T7 – Implementation Gap Fixes** | 🚧 Ready to start | `src/components/forms/CreateIssueFormServer.tsx`, `src/lib/actions/issue-actions.ts`, `src/app/machines/[machineId]/report-issue/`, route structure | Fix severity field for member flow, refactor route structure to `/machines/{machineId}/report-issue`, investigate anonymous view permissions. |

## Implementation Gap Analysis (2025-11-08)

During reverse-engineering of the Issue Creation feature, **3 critical gaps** were identified between intended behavior and current implementation:

### Gap 1: Severity Field Missing from Member Flow 🐛
**Intended Behavior:** Members should see BOTH severity AND priority fields when creating issues.
- **Severity**: Reporter's assessment of impact (low/medium/high/critical) - applies to all users
- **Priority**: Internal scheduling weight (low/medium/high) - applies to Full permission users only

**Current Reality:**
- Member form (`/issues/create`) only shows priority field (Full permission)
- Severity field only appears in anonymous flow (`/report/{machineId}`)

**Impact:** Members cannot set severity, which is meant to be independent from priority.

**Fix Required:**
- Add severity selector to `CreateIssueFormServer.tsx` for authenticated users
- Update `createIssueAction` schema to include severity in member flow
- Update integration tests to assert severity field presence
- Update E2E tests to test severity selection

### Gap 2: Anonymous View Permissions 🔍
**Intended Behavior:** Anonymous users should be able to view issues they created based on permission system (e.g., if anonymous users are granted `issue:read` permission).

**Current Reality:** Hard-coded access denial after anonymous issue creation. Anonymous users get success message but cannot view the issue they just created.

**Investigation Needed:**
- Check if permission system supports granting `issue:read` to anonymous (null userId)
- Review RLS policies for anonymous access patterns
- Determine if this is architectural limitation or just missing implementation

**Fix Required:** TBD pending investigation results.

### Gap 3: Route Structure Incorrect 🚨
**Intended Route:** `/machines/{machineId}/report-issue`

**Current Route:** `/report/{machineId}`

**Impact:** E2E test expectations are correct but implementation uses wrong structure.

**Fix Required:**
- Move route from `src/app/report/[machineId]/` to `src/app/machines/[machineId]/report-issue/`
- Update QR redirect in `/api/qr/[qrCodeId]/route.ts`
- Update any internal links/references
- E2E tests should already be correct (using intended route)

---

### Gap 3: Route Structure Incorrect 🚨
**Intended Route:** `/machines/{machineId}/report-issue`

**Current Route:** `/report/{machineId}`

**Impact:** QR redirect + docs assume `/machines/.../report-issue`. Implementation uses `/report/{machineId}`, so deep links & breadcrumbs diverge.

**Fix Required:** Move route under `src/app/machines/[machineId]/report-issue/`, update QR redirect + internal links, and adjust imports/tests accordingly.

### Gap 4: Member Router Tests Bypass Middleware ⚠️
`issue.core.create.integration.test.ts` calls the router with a mocked context, so `issueCreateProcedure`/`organizationProcedure` never run. We miss permission and RLS coverage. Need to reuse the canonical context helper or hit the tRPC handler so middleware executes.

### Gap 5: Member Router Missing Permission-Downgrade Case ⚠️
No test asserts that assignee data is stripped when only `issue:create_basic` is granted. Add a scenario where the first permission check fails, the second passes, and assigneeId becomes null.

### Gap 6: Anonymous Router Missing Private-Machine Enforcement ⚠️
Current tests validate cross-org rejection but not `is_public` inheritance. Add coverage for machines/locations/orgs marked private to ensure `publicCreate` rejects as per spec.

### Gap 7: Anonymous Playwright Suite Mutates DB Directly ⚠️
Helper imports `postgres` and edits `organizations`, `machines`, `issue_statuses`, `priorities` directly, bypassing Supabase permissions. Replace with sanctioned APIs (server actions/tRPC) or encapsulate updates behind a test helper endpoint.

### Gap 8: Anonymous Playwright Suite Leaves Config Drift ⚠️
After toggling anonymous flags/defaults, we never reset rows, so later tests inherit altered state. Either restore values after each run or scope mutations to temporary data.

### Gap 9: Member Playwright Suite Missing ⚠️
`e2e/issues/issue-create-member.e2e.test.ts` is still the placeholder. Need to implement happy path, validation, and visibility scenarios with correct `data-testid`s and guards.

---

### T1 – Server Action Validation Fix
- **Goal:** Make `createIssueAction` reject whitespace-only titles so `src/lib/actions/issue-actions.createIssueAction.integration.test.ts` passes without changes.
- **Status:** Shipped but needs follow-up (deprecated `revalidateTag` usage).
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
- **Status (2025-11-08):** Tests run but bypass middleware and miss the permission downgrade scenario. Needs harness rework + additional coverage.
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
- **Status (2025-11-08):** Suite passes locally, but helper violates DB policy (direct Postgres writes) and leaves state mutated (see Gaps 7 & 8). Follow-up required even though tests are green.
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

Document updated: 2025-11-08
