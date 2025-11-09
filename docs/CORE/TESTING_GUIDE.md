# Testing Guide (Source of Truth)

Last Reviewed: 2025-11-08
Last Updated: 2025-11-02

Scope: All contributors. This is the single source of truth for creating and updating tests. It replaces prior archetype-era documentation and any deprecated automation around test scaffolding.

## Objectives
- Make tests consistent, fast, and trustworthy.
- Focus on five test types: Unit, Integration, E2E, RLS, Schema.
- Define do’s/don’ts, naming, placement, and review policy.

## Test Types and When to Use Them

1) Unit Tests
- What: Pure logic (formatters, validators, utilities) with no IO.
- When: Function has no external effects and can be isolated.
- Where: Co-locate with source or under `src/**/__tests__` or `src/**/*.test.ts(x)`.
- Naming: `*.unit.test.ts` (optional suffix) or `*.test.ts` when clearly unit.
- Notes: No mocking of DB/network. Keep assertions meaningful.

2) Integration Tests
- What: Application boundaries with I/O mocked or isolated (services, DAL, tRPC callers, server actions). Validates contracts and wiring.
- When: Code integrates multiple modules or uses framework context.
- Where: `src/**/*.test.ts(x)` (by feature), or `src/integration-tests/**/*` for broader flows.
- Naming: `*.integration.test.ts` (recommended).
- Notes: Use seed-based mocks and stable fixtures. Do not instantiate a database per test; use worker-scoped strategy if DB is required.

3) E2E Tests (Playwright)
- What: Full user journeys in the browser.
- When: Validate CUJs, routing, auth gates, and server/client integration.
- Where: `e2e/**/*` (smoke and feature journeys).
- Naming: `*.e2e.test.ts`.
- Notes: Use stable `data-testid` selectors. Keep journeys focused and reliable. Prefer smoke coverage + a few critical flows.

4) RLS Tests (pgTAP / SQL)
- What: Database Row-Level Security, invariants, containment, and permission enforcement.
- When: Validating database-enforced behavior independent of application code.
- Where: `supabase/tests/**/*.test.sql`.
- Naming: `*.rls.test.sql`.
- Notes: Cite sections in `docs/CORE/DATABASE_SECURITY_SPEC.md`. Keep tests declarative; don’t adjust expectations to match bugs—add a BUG NOTE comment instead.

5) Schema Tests (pgTAP / SQL)
- What: Constraints, FKs, CHECKs, indexes; structural invariants.
- When: Ensuring schema rules remain correct and stable.
- Where: `supabase/tests/**/*.test.sql`.
- Naming: `*.schema.test.sql`.
- Notes: Keep separate from RLS policy tests.

## Naming and Placement
- Unit: `*.unit.test.ts` (optional) in same directory or `__tests__`.
- Integration: `*.integration.test.ts` near the boundary code.
- E2E: `e2e/**/something.e2e.test.ts`.
- RLS: `supabase/tests/**/something.rls.test.sql`.
- Schema: `supabase/tests/**/something.schema.test.sql`.

## Do’s and Don’ts (Non-Negotiable Behaviors)
Do
- Use `SEED_TEST_IDS` and stable fixtures from `src/test/constants/seed-test-ids.ts`.
- Prefer worker-scoped database if DB is needed; reuse across tests.
- Keep RLS tests separate from application tests.
- Assert on behavior, not implementation details.
- Use stable `data-testid` selectors in E2E.
- Update feature specs’ “Test Spec” and “Associated Test Files” when flows change.

Don’t
- Don’t create per-test PGlite instances (memory/time blow-ups).
- Don’t mix RLS SQL tests with application mocking in the same file.
- Don’t hand-roll random IDs or flaky time-based assertions.
- Don’t unit test async Server Components directly; validate via integration/E2E.
- Don’t rely on coverage % as a goal; focus on meaningful assertions.

## Creation Workflow
1) Pick the right test type (see list above). If unsure, default to Integration for boundary logic and Unit for pure logic.
2) Start from templates and helpers under `src/test/templates` and `src/test/helpers` when available.
3) Place the file by type (see Naming and Placement). Keep paths near the code under test where practical.
4) Use seed constants and deterministic mocks. Avoid ad-hoc generators.
5) For Integration with DB needs, use the worker-scoped DB pattern; do not spawn per-test instances.
6) For E2E, use stable `data-testid` and minimal journeys that map to CUJs.
7) For RLS/Schema, cite `docs/CORE/DATABASE_SECURITY_SPEC.md` section numbers in descriptions.

## Updating Tests
- Update adjacent tests when changing contracts, DTOs, validation messages, or behavior.
- Keep assertions stable via constants and helpers; avoid brittle snapshots.
- When fixing a bug uncovered by a test, keep the failing assertion and adjust implementation.
- When feature behavior changes, update the feature spec and bump dates; align tests with new acceptance criteria.

## Mocking Standards
- Prefer type-safe mocking via Vitest. See `docs/CORE/latest-updates/vitest.md` for modern patterns (vi.mock with async factory, vi.importActual, vi.hoisted).
- Keep mocks minimal and focused on behavior.
- Avoid mocking too deep; integration tests should exercise meaningful boundaries.

## RLS vs Application Separation
- RLS SQL tests: verify database policies, invariants, and visibility semantics.
- Application tests (Unit/Integration/E2E): verify request flows, validations, and permissions wiring.
- Do not bypass RLS in app tests unless the purpose is to validate service logic unrelated to RLS.

## Review Checklist (for PRs)
- Correct test type, naming, and placement.
- Uses seed constants and deterministic fixtures.
- No per-test DB instances; worker-scoped if DB is used.
- For E2E: stable data-testids; minimal but complete journeys.
- For RLS/Schema: cites `DATABASE_SECURITY_SPEC` sections.
- Feature spec updated (Test Spec + Associated Test Files) if behavior changed.

## E2E Best Practices & Common Pitfalls

### Project Scoping Behavior
- Playwright runs tests on ALL configured projects by default unless explicitly restricted via `testMatch`, `testIgnore`, or guards.
- Only `auth.setup.ts` has explicit `testMatch` restriction in config.
- Without guards, authenticated tests run on unauthenticated projects and vice versa, causing failures.

### Project Guards (Required Pattern)
**Auth-required tests** (smoke tests, authenticated flows):
```typescript
test.beforeEach(({ page }, testInfo) => {
  if (!testInfo.project.name.includes("auth")) {
    test.skip("Requires authenticated storage state");
  }
});
```

**Guest-required tests** (unauthenticated redirects, sign-in flows):
```typescript
test.beforeEach(({ page }, testInfo) => {
  if (testInfo.project.name.includes("auth")) {
    test.skip("Requires unauthenticated state to test redirects");
  }
});
```

### Storage State Management
- `e2e/.auth/user.json` persists across test runs once created.
- Stale auth state causes unexpected authenticated behavior in guest tests.
- Guest tests should use `test.use({ storageState: undefined })` to ensure clean state.
- Auth setup should clear existing state before creating new session.

### Global Setup Separation of Concerns
- **Global setup** (`e2e/global-setup.ts`): Database snapshot restore only. No server interaction.
- **WebServer config**: Server lifecycle management and readiness checks.
- **Auth setup project**: Authentication flow and storage state creation.
- Do not launch browsers in global-setup; interferes with Playwright's webServer lifecycle.

### Test Filtering Patterns
- `--grep` matches test TITLES (describe/test names), not file paths.
- Pattern `--grep-invert='e2e/prod/'` does NOT filter files; matches test names only.
- Use `testMatch`/`testIgnore` in config or split npm scripts for file-based filtering.
- Tag-based filtering: `test.describe.configure({ tags: ["@prod"] })` then `--grep-invert @prod`.

### Environment-Specific Tests
- Prod tests expecting multi-org behavior will fail in alpha single-org mode.
- Use environment checks: `test.skip(baseURL?.includes("localhost"), "Prod-only behavior")`.
- Separate scripts: `e2e:smoke` (local) vs `e2e:prod` (deployed).

### Auth Setup Patterns
- Verify server readiness before auth flow (health endpoint with retry).
- Use stable selectors: `data-testid` over text content.
- Add retry logic for flaky UI interactions (button clicks).
- Better error messages: log current URL and state on timeout.
- Confirm authentication success before saving storage state.

### Common Failure Modes
| Symptom | Root Cause | Fix |
|---------|------------|-----|
| Auth test fails on `chromium` project | Test runs on wrong project | Add project guard |
| Guest test doesn't see redirect | Running on `chromium-auth` with stored auth | Add guest guard or clear storage state |
| Prod tests fail locally | Alpha vs prod behavior mismatch | Skip prod tests in local scripts |
| `--grep-invert` doesn't filter files | grep matches titles not paths | Use `testMatch`/`testIgnore` or tags |
| Auth setup timeout | Server not ready or missing health check | Add health check with retry |
| Tests pass individually, fail in suite | Project scoping leakage | Add guards to all auth/guest tests |

### Diagnostic Commands
```bash
# List which tests run on which projects
npx playwright test --list --project=chromium | grep "test-name"
npx playwright test --list --project=chromium-auth | grep "test-name"

# Verify grep filter behavior
npx playwright test --list --grep-invert='pattern' --project=chromium | wc -l

# Debug webServer startup
DEBUG=pw:webserver npm run e2e

# Run single project
npx playwright test --project=chromium-auth
```

## Commands
- Unit/Integration: `npm test`, `npm run test:watch`
- RLS: `npm run test:rls`
- E2E: `npm run e2e`
- E2E full suite: `npm run e2e`
- E2E single project: `npx playwright test --project=chromium-auth`

## References
- Security authority: `docs/CORE/DATABASE_SECURITY_SPEC.md`
- Vitest modern mocking: `docs/CORE/latest-updates/vitest.md`
- Test infra (helpers/templates/constants): `src/test/`
- Investigation archive: Lessons from Nov 2025 E2E failures incorporated above
