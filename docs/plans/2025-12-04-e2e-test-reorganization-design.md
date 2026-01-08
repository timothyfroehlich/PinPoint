# E2E Test Reorganization Design

**Date**: 2025-12-04
**Status**: Approved
**Author**: Claude (Brainstorming Session)

## Problem Statement

E2E tests have grown to 10 tests, causing slow preflight runs (~6-7 minutes). Need to split into smoke tests (fast, critical paths for preflight) and full suite (comprehensive, for CI only), with file-level parallelization to speed up execution.

## Goals

1. **Speed up preflight**: Reduce smoke test runtime to <3 minutes
2. **Critical paths only**: Smoke tests cover essential user journeys
3. **Safe parallelization**: Run multiple test files concurrently without conflicts
4. **CI optimization**: Measure and optimize 3 Supabase-dependent jobs

## Requirements

- Smoke tests: Maximum 8 tests (ended up with 5)
- Focus: auth-login, issues-crud, machines-crud, public-reporting, navigation
- File-level parallelization: `fullyParallel: false`, `workers: 3`
- Same parallelization locally and in CI (test what we ship)
- Aggressive conversion: Move tests from e2e → integration where possible

## Design

### Test Split

**Smoke Tests (5 tests - run in preflight):**

1. **auth-flows.spec.ts** (simplified)
   - Keep: login flow only
   - Move to full: signup, password reset, logout

2. **public-reporting.spec.ts**
   - Keep as-is: anonymous issue reporting (critical path)

3. **issues-crud.spec.ts** (streamlined)
   - Keep: create issue, view issue
   - Move to integration: update, delete (can test without browser)

4. **machines-crud.spec.ts** (streamlined)
   - Keep: list machines, view machine detail
   - Move to integration: create machine (form submission can be integration)

5. **navigation.spec.ts**
   - Keep as-is: auth/unauth navigation states

**Full E2E (5 tests - run in CI only):**

1. **auth-flows-extended.spec.ts** (new)
   - Signup flow, password reset, logout, protected routes

2. **dashboard.spec.ts**
   - Dashboard stats, assigned issues, recent issues

3. **email-notifications.spec.ts**
   - SMTP email verification via Mailpit

4. **notifications.spec.ts**
   - In-app notification system

5. **profile-settings.spec.ts**
   - Profile update functionality

### Directory Structure

```
e2e/
├── smoke/                          # Smoke tests (preflight)
│   ├── auth-flows.spec.ts
│   ├── public-reporting.spec.ts
│   ├── issues-crud.spec.ts
│   ├── machines-crud.spec.ts
│   └── navigation.spec.ts
│
├── full/                           # Full suite (CI only)
│   ├── auth-flows-extended.spec.ts
│   ├── dashboard.spec.ts
│   ├── email-notifications.spec.ts
│   ├── notifications.spec.ts
│   └── profile-settings.spec.ts
│
├── support/                        # Shared utilities (unchanged)
├── global-setup.ts
├── playwright.config.smoke.ts      # NEW
└── playwright.config.full.ts       # NEW
```

### Parallelization Strategy

**Constraints:**

- Single local Supabase PostgreSQL database
- Single Next.js dev server (one port)
- Tests share database state
- Global setup resets DB once before all tests

**Safety mechanisms:**

- Tests create unique data via timestamps (no ID conflicts)
- Tests clean up via `afterEach` hooks
- Read-only tests are inherently safe
- `test.describe.serial` is respected within files

**Configuration:**

**File-level parallel** (recommended):

- `fullyParallel: false` - Respects `.serial()` within files
- `workers: 3` - Run up to 3 test files concurrently
- Same settings locally and CI - test what we ship

### Playwright Configurations

**playwright.config.smoke.ts**:

```typescript
import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  testDir: "./e2e/smoke",
  fullyParallel: false, // Respect .serial() within files
  workers: 3, // 3 test files in parallel
  retries: process.env.CI ? 2 : 0,
};
```

**playwright.config.full.ts**:

```typescript
import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  testDir: "./e2e",
  testMatch: "**/full/**/*.spec.ts",
  fullyParallel: false,
  workers: 3,
  retries: process.env.CI ? 2 : 0,
};
```

### Package.json Changes

```json
{
  "scripts": {
    "smoke": "playwright test --config=playwright.config.smoke.ts",
    "smoke:headed": "playwright test --config=playwright.config.smoke.ts --headed",
    "e2e:full": "playwright test --config=playwright.config.full.ts",
    "e2e:full:headed": "playwright test --config=playwright.config.full.ts --headed",
    "preflight": "npm-run-all --silent --parallel typecheck lint:fix format:fix test check:config --sequential db:reset --parallel build test:integration test:integration:supabase --sequential smoke"
  }
}
```

### GitHub Actions Changes

**Add new job:**

```yaml
test-e2e-full:
  name: E2E Tests (Full Suite)
  runs-on: ubuntu-latest
  if: ${{ github.event_name == 'pull_request' }}
  needs: [setup, typecheck, lint, format, test-unit, test-integration]
  steps:
    # ... same setup as test-e2e-smoke ...
    - name: Run E2E Full Tests
      run: pnpm exec playwright test --config=playwright.config.full.ts
```

**Update existing smoke job:**

```yaml
- name: Run E2E Smoke Tests
  run: pnpm exec playwright test --config=playwright.config.smoke.ts
```

**CI Optimization:**

- Measure Supabase setup time in all 3 jobs
- Jobs already run in parallel (current setup is good)
- Focus on test execution time, not setup time

## Implementation Plan

### Phase 1: Validate Test Split

1. Create `e2e/smoke/` and `e2e/full/` directories
2. Move 5 tests to `smoke/`, 5 tests to `full/`
3. Simplify smoke tests (extract extended auth flows)
4. Create `auth-flows-extended.spec.ts` with signup/password-reset/logout
5. Create `playwright.config.smoke.ts` with `workers: 1` (sequential)
6. Create `playwright.config.full.ts` with `workers: 1`
7. Run `pnpm run smoke` - verify all 5 pass
8. Run `pnpm run e2e:full` - verify all 5 pass

### Phase 2: Enable Parallelization Gradually

1. Change smoke config to `workers: 2`, run 5+ times
2. Monitor for flaky tests or data conflicts
3. Increase to `workers: 3`, run 10+ times
4. Verify stability (no race conditions)
5. Update full config to `workers: 3`
6. Run full suite 10+ times to verify

### Phase 3: CI Integration

1. Measure current CI times for 3 Supabase jobs
2. Update `test-e2e` job to use `playwright.config.smoke.ts`
3. Add new `test-e2e-full` job
4. Measure new CI times
5. Document findings

### Phase 4: Integration Test Migration (Future)

- Identify candidates: machine creation, issue update/delete, email logic
- Create integration tests for extracted logic
- Remove redundant e2e tests
- Update TESTING_PLAN.md

## Success Criteria

- ✅ Preflight smoke tests run in <3 minutes (down from ~6-7 min)
- ✅ All tests pass consistently (10 consecutive runs)
- ✅ No test flakiness introduced by parallelization
- ✅ CI total time doesn't increase significantly
- ✅ Same parallelization works locally and in CI

## Risks & Mitigations

**Risk**: Race conditions from parallel execution
**Mitigation**:

- Tests use unique timestamps for data
- Tests clean up via `afterEach`
- Gradual rollout (workers: 1 → 2 → 3)
- 10+ test runs to validate stability

**Risk**: CI becomes slower with extra job
**Mitigation**:

- Jobs already run in parallel
- Measure before/after
- Smoke tests are faster, offsetting full suite addition

**Risk**: Tests become flaky
**Mitigation**:

- File-level parallelization respects `.serial()`
- Extensive local testing before CI deployment
- Can always roll back to `workers: 1`

## Open Questions

- ✅ Should we use same parallelization locally and CI? **Yes**
- ⏳ How long does Supabase setup actually take in CI? **Need to measure**
- ⏳ Which tests should convert to integration tests? **Phase 4 analysis**

## References

- Current e2e tests: `/e2e/smoke/*.spec.ts` and `/e2e/*.spec.ts`
- Testing plan: `/docs/TESTING_PLAN.md`
- E2E best practices: `/docs/E2E_BEST_PRACTICES.md` (needs update)
- Playwright config: `/playwright.config.ts`
