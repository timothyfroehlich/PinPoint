# Task 5: Testing Infrastructure

**Status**: ⏳ PENDING
**Branch**: `setup/testing`
**Dependencies**: Task 4 (UI Foundation & Landing Page)

## Objective

Vitest, PGlite, Playwright setup with example tests and code coverage enforcement.

## Acceptance Criteria

- [ ] `npm test` runs and passes
- [ ] `npm run test:coverage` generates coverage report
- [ ] Coverage thresholds enforce 80% minimum
- [ ] Example integration test with PGlite passes
- [ ] `npm run smoke` runs Playwright test
- [ ] Example E2E test passes (landing page)
- [ ] GitHub Actions runs tests successfully
- [ ] CI fails if coverage below 80%

## Tasks

### Vitest Setup

- [ ] Install Vitest (`npm install -D vitest @vitest/ui @vitest/coverage-v8`)
- [ ] Install React Testing Library (`npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event`)
- [ ] Create `vitest.config.ts`
  - Configure path aliases (`~/*`)
  - Set up test environment (jsdom)
  - Configure globals (describe, it, expect)
  - Configure coverage:
    - Provider: v8
    - Minimum coverage thresholds: 80% (lines, functions, branches, statements)
    - Include: `src/**/*.{ts,tsx}`
    - Exclude: `src/**/*.test.{ts,tsx}`, `src/test/**`, `src/app/**`, type definition files
- [ ] Add test scripts to package.json
  - [ ] `test` - Run Vitest unit/integration tests
  - [ ] `test:watch` - Vitest watch mode
  - [ ] `test:ui` - Vitest UI
  - [ ] `test:coverage` - Run tests with coverage report

### PGlite Integration Testing

- [ ] Install PGlite (`npm install -D @electric-sql/pglite`)
- [ ] Create `src/test/setup/` directory
- [ ] Create worker-scoped PGlite instance setup (CORE-TEST-001)
- [ ] Create database test helpers in `src/test/helpers/`
  - Setup/teardown utilities
  - Test data factories
  - Schema application helpers
- [ ] Write example integration test (database query)

### Playwright E2E Setup (Simplified)

- [ ] Install Playwright (`npm install -D @playwright/test`)
- [ ] Initialize Playwright (`npx playwright install`)
- [ ] Create `playwright.config.ts`
  - Configure base URL
  - Single chromium project (keep it simple)
  - Basic retries and timeouts
- [ ] Create `e2e/` directory
  - [ ] `smoke/` subdirectory for smoke tests
- [ ] Write example smoke test (landing page loads)
- [ ] Add `smoke` script to package.json

### Code Coverage Enforcement

- [ ] Add coverage check to `.github/workflows/ci.yml`
  - Run `npm run test:coverage` in CI
  - Fail build if coverage below 80%
  - Upload coverage reports as artifacts
- [ ] Add coverage badge to README (optional, after first run)

### GitHub Actions - E2E Tests

- [ ] Add E2E job to `.github/workflows/ci.yml`
  - Install Playwright browsers
  - Run smoke tests (`npm run smoke`)
  - Upload Playwright trace on failure

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
