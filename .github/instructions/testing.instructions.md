---
applyTo: "**/*.test.ts,**/*.spec.ts,e2e/**/*.ts,src/test/**/*.ts"
---

# Testing Review Instructions

## Test Architecture Requirements

When reviewing test code, enforce patterns from `/docs/CORE/TESTING_GUIDE.md`:

### Test Type Selection (CORE-TEST-001)

- **Unit Tests**: Pure functions, utilities, validation logic
- **Integration Tests**: Database interactions, tRPC procedures, Server Actions
- **E2E Tests**: Full user workflows, Server Component validation
- **RLS Tests**: Row-Level Security policy validation via pgTAP

### Required Patterns

- Use SEED_TEST_IDS constants for predictable test data
- Worker-scoped PGlite instances (NOT per-test instances)
- Seed-based mocks and fixtures
- Auth setup utilities from `/src/test/helpers/`

### Forbidden Patterns (CRITICAL)

- **Memory Safety Violation**: Per-test database instances (`createSeededTestDatabase()` in `beforeEach()`)
- **System Impact**: Multiple PGlite instances cause 1-2GB+ memory usage and system lockups
- **Hardcoded Test IDs**: Use SEED_TEST_IDS instead of `nanoid()` or random generation
- **Mixing RLS Tracks**: Don't mix pgTAP RLS tests with PGlite application tests

### Testing Memory Safety

- **Required Pattern**: `import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"`
- **Single Instance**: One PGlite instance per worker, not per test
- **Transaction Isolation**: Use `withIsolatedTest` for test isolation
- **Performance**: Sub-100ms unit tests, <5s integration test suites

### Seed Architecture Compliance

- **Hardcoded IDs**: Use `SEED_TEST_IDS.ORGANIZATIONS.primary` and `.competitor`
- **Cross-Org Testing**: Test data isolation between organizations
- **Predictable Data**: No random generation in tests for debugging reliability
- **Mock Contexts**: Use `createMockAdminContext()` patterns from helpers

### Server Component Testing (CORE-TEST-002)

- **Integration Concern**: Async Server Components are integration concerns
- **E2E Validation**: Use Playwright for end-to-end Server Component validation
- **No Unit Testing**: Don't unit test async Server Components directly

### Test Structure Requirements

- Follow naming conventions: `*.test.ts(x)` for unit/integration
- Use `*.e2e.test.ts` under `e2e/` directory
- SQL tests in `supabase/tests/rls/*.test.sql`
- Use helpers from `src/test/helpers/` and look at similar existing tests

### Vitest Safety

- **FORBIDDEN**: Redirection commands (`npm test 2>&1`, `vitest >>`)
- **Cause**: Vitest interprets redirection as test name filters
- **Required**: Use `npm run test:brief`, `npm run test:verbose` for output control
