# PinPoint Testing Plan v2.0

**Last Updated**: 2025-11-10
**Status**: ACTIVE - Pragmatic testing for v1.0

## Testing Philosophy

**Goal**: Confidence, not perfection.

**Priorities**:
1. ✅ Critical user journeys work
2. ✅ Data integrity maintained
3. ✅ Security boundaries enforced
4. ✅ No regressions on core features

**Anti-Goals**:
- ❌ 100% code coverage
- ❌ Testing every edge case
- ❌ Complex E2E test infrastructure
- ❌ Testing implementation details

**Rule**: If it's hard to test, simplify the code first.

---

## Test Coverage Strategy

### The Testing Pyramid (Simplified)

```
        /\
       /E2E\      ← 5-10 critical flows only
      /------\
     /  Intg  \   ← 20-30 tests for data + auth
    /----------\
   /    Unit    \ ← 50+ tests for pure logic
  /--------------\
```

**Distribution Goal:**
- **70% Unit Tests** - Pure functions, utilities, validation
- **25% Integration Tests** - Database queries, Server Actions
- **5% E2E Tests** - Critical user journeys only

**Total Test Count Target: ~100-150 tests** (not thousands)

---

## Test Types & When to Use

### 1. Unit Tests (Vitest)

**What to Test:**
- ✅ Pure utility functions
- ✅ Validation schemas (Zod)
- ✅ Data transformations (snake_case ↔ camelCase)
- ✅ Type guards
- ✅ Helper functions

**What NOT to Test:**
- ❌ React components (integration test the behavior instead)
- ❌ Database queries (integration test)
- ❌ API routes (integration test)

**Example:**

```typescript
// lib/utils/format-date.test.ts
import { describe, it, expect } from 'vitest'
import { formatIssueDate } from './format-date'

describe('formatIssueDate', () => {
  it('formats recent dates as relative time', () => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    expect(formatIssueDate(twoHoursAgo)).toBe('2 hours ago')
  })

  it('formats old dates as absolute date', () => {
    const lastYear = new Date('2024-01-15')

    expect(formatIssueDate(lastYear)).toBe('Jan 15, 2024')
  })
})
```

**Target: ~70 unit tests**

---

### 2. Integration Tests (Vitest + PGlite)

**What to Test:**
- ✅ Server Actions (create, update, delete)
- ✅ Database queries (complex joins, filtering)
- ✅ Authentication flows
- ✅ Data validation + database constraints

**What NOT to Test:**
- ❌ Database internals (trust Drizzle)
- ❌ Supabase Auth internals (trust Supabase)
- ❌ UI rendering (E2E or visual testing)

**Setup Pattern:**

```typescript
// tests/integration/setup.ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeAll, afterAll } from 'vitest'

// Worker-scoped instance (NOT per-test!)
let testDb: ReturnType<typeof drizzle>

beforeAll(async () => {
  const pglite = new PGlite()
  testDb = drizzle(pglite)

  // Apply schema
  await pglite.exec(await readFile('./schema.sql', 'utf-8'))
})

export { testDb }
```

**Example:**

```typescript
// app/issues/actions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb } from '~/tests/integration/setup'
import { createIssue } from './actions'
import { issues, machines } from '~/server/db/schema'

describe('createIssue', () => {
  beforeEach(async () => {
    // Clean slate for each test
    await testDb.delete(issues)
  })

  it('creates issue for valid machine', async () => {
    const machine = await testDb.insert(machines).values({
      name: 'Twilight Zone',
    }).returning()

    const formData = new FormData()
    formData.set('title', 'Broken flipper')
    formData.set('machineId', machine[0].id)

    await createIssue(formData)

    const allIssues = await testDb.query.issues.findMany()
    expect(allIssues).toHaveLength(1)
    expect(allIssues[0].title).toBe('Broken flipper')
  })

  it('validates required fields', async () => {
    const formData = new FormData()
    // Missing title

    await expect(createIssue(formData)).rejects.toThrow()
  })
})
```

**Target: ~40 integration tests**

---

### 3. E2E Tests (Playwright)

**Critical User Journeys ONLY:**

1. **Public Issue Reporting** (highest priority)
   - Navigate to report form
   - Select machine
   - Submit issue
   - See confirmation

2. **Member Login → View Issues**
   - Log in
   - Navigate to issues list
   - See issues
   - Filter by status

3. **Issue Resolution Flow**
   - Log in
   - Open issue
   - Assign to self
   - Change status to "in progress"
   - Add comment
   - Change status to "resolved"
   - Verify timeline

4. **Create Machine**
   - Log in
   - Navigate to machines
   - Create new machine
   - Verify appears in list

5. **Dashboard Overview**
   - Log in
   - View dashboard
   - See assigned issues
   - See recent issues

**That's it. 5 E2E tests total.**

**Example:**

```typescript
// e2e/issue-reporting.spec.ts
import { test, expect } from '@playwright/test'

test('public user can report issue', async ({ page }) => {
  await page.goto('/report-issue')

  // Select machine
  await page.selectOption('[name="machineId"]', 'twilight-zone')

  // Fill form
  await page.fill('[name="title"]', 'Left flipper not working')
  await page.fill('[name="description"]', 'No response when pressing button')

  // Submit
  await page.click('button[type="submit"]')

  // Confirmation
  await expect(page.locator('text=Issue reported successfully')).toBeVisible()
})
```

**Setup Strategy (Avoid Complexity):**
- Use shared authenticated state for member tests
- Reset DB before E2E run (not between tests)
- Use `data-testid` sparingly (prefer semantic selectors)
- Keep assertions simple

**Target: 5 E2E tests**

---

## Test Organization

```
tests/
├── unit/
│   ├── utils/
│   │   ├── format-date.test.ts
│   │   └── validation.test.ts
│   └── lib/
│       └── case-transform.test.ts
│
├── integration/
│   ├── setup.ts                 # PGlite setup
│   ├── issues/
│   │   ├── create-issue.test.ts
│   │   ├── update-issue.test.ts
│   │   └── filter-issues.test.ts
│   ├── machines/
│   │   └── create-machine.test.ts
│   └── auth/
│       └── login.test.ts
│
└── e2e/
    ├── fixtures/
    │   └── auth.ts              # Authenticated user fixture
    ├── 01-issue-reporting.spec.ts
    ├── 02-member-login.spec.ts
    ├── 03-issue-resolution.spec.ts
    ├── 04-create-machine.spec.ts
    └── 05-dashboard.spec.ts
```

---

## What We're NOT Testing (v1.0)

### ❌ Skip These (Not Worth It Yet)

**Visual Regression Testing**
- Manual QA is sufficient for v1.0
- Add if UI bugs become frequent

**Performance Testing**
- Premature for single-org app
- Add if users complain about speed

**Accessibility Testing**
- Use semantic HTML and shadcn/ui (accessible by default)
- Manual screen reader testing before launch
- Automated a11y tests in v2

**Browser Compatibility**
- Modern browsers only (Chrome, Firefox, Safari, Edge)
- No IE11, no old mobile browsers

**Mobile App Testing**
- Just mobile web browsers (responsive design)
- No native apps in v1.0

**Stress/Load Testing**
- Single org won't generate enough load
- Add if scaling to more orgs

---

## Testing Workflow

### Development (TDD for Complex Logic)

```bash
npm run test:watch
```

Watch mode for unit tests when building utilities or complex logic.

### Pre-Commit (Quick Validation)

```bash
npm test                  # Run all unit + integration tests
```

**Should complete in <10 seconds.**

### Pre-Push (Full Validation)

```bash
npm test                  # Unit + integration
npm run e2e              # E2E tests
npm run typecheck        # Type checking
npm run lint             # Linting
```

**Should complete in <60 seconds.**

### CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run e2e
```

---

## Test Data Strategy

### Seed Data for E2E

```sql
-- supabase/seed.sql
INSERT INTO machines (id, name, manufacturer, year) VALUES
  ('twilight-zone', 'Twilight Zone', 'Bally', 1993),
  ('medieval-madness', 'Medieval Madness', 'Williams', 1997),
  ('attack-from-mars', 'Attack from Mars', 'Bally', 1995);

INSERT INTO user_profiles (id, name, is_member) VALUES
  ('test-member-id', 'Test Member', true),
  ('test-public-id', 'Test Public', false);
```

**Principles:**
- ✅ Hardcoded IDs for predictable testing
- ✅ Minimal data set (3-5 machines, 2 users)
- ✅ Representative of real data
- ❌ No generated data (keep tests deterministic)

### Test Isolation

**Unit Tests:**
- Pure functions, no state needed

**Integration Tests:**
- Reset tables between tests (`beforeEach`)
- Worker-scoped DB (one instance for all tests)

**E2E Tests:**
- Reset DB once before entire suite
- Tests should not depend on order
- Use unique titles/names per test

---

## Coverage Targets

**Overall:** 80% for critical paths

**By Layer:**
- Server Actions: 90%+ (critical for data integrity)
- Utilities: 90%+ (pure functions are easy to test)
- Components: 20%+ (E2E tests cover these)
- Database queries: 60%+ (integration tests)

**Don't Aim for 100%:**
- Diminishing returns after 80%
- Tests become brittle
- Maintenance burden increases

---

## Common Testing Patterns

### Testing Server Actions

```typescript
import { mockSupabaseAuth } from '~/tests/mocks/supabase'

describe('updateIssueStatus', () => {
  it('requires authentication', async () => {
    mockSupabaseAuth(null) // No user

    await expect(
      updateIssueStatus('issue-id', 'resolved')
    ).rejects.toThrow('Unauthorized')
  })

  it('updates status and creates timeline entry', async () => {
    mockSupabaseAuth({ id: 'user-id' })

    await updateIssueStatus('issue-id', 'resolved')

    const issue = await testDb.query.issues.findFirst({
      where: eq(issues.id, 'issue-id')
    })

    expect(issue.status).toBe('resolved')

    const comments = await testDb.query.issueComments.findMany({
      where: eq(issueComments.issueId, 'issue-id')
    })

    expect(comments).toContainEqual(
      expect.objectContaining({
        isSystem: true,
        content: expect.stringContaining('resolved')
      })
    )
  })
})
```

### Testing Forms with Validation

```typescript
import { createIssueSchema } from '~/lib/schemas/issue'

describe('createIssueSchema', () => {
  it('requires title', () => {
    const result = createIssueSchema.safeParse({
      machineId: 'machine-id',
      // title missing
    })

    expect(result.success).toBe(false)
  })

  it('accepts valid issue data', () => {
    const result = createIssueSchema.safeParse({
      title: 'Broken flipper',
      machineId: 'machine-id',
      severity: 'high',
    })

    expect(result.success).toBe(true)
  })
})
```

---

## Debugging Failed Tests

### Quick Checklist

1. **Read the error message** (obvious but often skipped)
2. **Check test data** - Are IDs correct? Is data seeded?
3. **Isolate the test** - Does it pass alone? (`it.only`)
4. **Check side effects** - Did previous test leave dirty state?
5. **Verify setup** - Is DB schema applied? Are mocks correct?

### Playwright Debugging

```bash
# Run with UI mode
npx playwright test --ui

# Run with headed browser
npx playwright test --headed

# Debug specific test
npx playwright test --debug issue-reporting
```

---

## Testing Anti-Patterns to Avoid

❌ **Testing implementation details**
```typescript
// Bad
expect(component.state.count).toBe(5)

// Good
expect(screen.getByText('Count: 5')).toBeInTheDocument()
```

❌ **Per-test database instances**
```typescript
// Bad (causes system lockups)
beforeEach(() => {
  db = new PGlite() // ❌ Don't do this
})

// Good (worker-scoped)
beforeAll(() => {
  db = new PGlite() // ✅ Once per worker
})
```

❌ **Testing every possible edge case**
```typescript
// Bad (diminishing returns)
it('handles 0')
it('handles -1')
it('handles -999999')
it('handles MAX_SAFE_INTEGER + 1')

// Good (representative cases)
it('handles positive numbers')
it('handles negative numbers')
it('handles zero')
```

❌ **Complex test setup that obscures intent**
```typescript
// Bad
beforeEach(async () => {
  await setupComplexScenario()
  await seedMultipleMachines()
  await createTestUsers()
  await generateIssues()
  // ... 50 lines later
})

// Good
it('filters issues by status', async () => {
  await testDb.insert(issues).values([
    { title: 'Open', status: 'new' },
    { title: 'Closed', status: 'resolved' },
  ])

  // Test is self-contained and clear
})
```

---

## Success Metrics

**Test Suite Health:**
- ✅ All tests pass before merge
- ✅ Test suite runs in <60 seconds
- ✅ Tests are deterministic (no flakes)
- ✅ Coverage at 80% for critical paths

**Development Velocity:**
- ✅ Tests catch bugs before production
- ✅ Tests don't slow down feature development
- ✅ Refactoring is safe (tests pass or fail clearly)

**When to Add More Tests:**
- Bug found in production → Add regression test
- Complex feature → Add integration test
- Critical user journey → Add E2E test

**When NOT to Add Tests:**
- "We should have better coverage" → Only if it prevents real bugs
- "Let's test this just in case" → Only if failure would be catastrophic
- "CI coverage check is failing" → Don't game metrics, test what matters

---

## Test Maintenance

**Monthly Review:**
- Remove flaky tests (fix or delete)
- Remove obsolete tests (for removed features)
- Update fixtures if schema changes

**Red Flags:**
- Tests frequently break on refactors (testing implementation)
- Tests are slow (>60s total)
- Tests are flaky (random failures)
- Coverage is decreasing (missing tests for new features)

---

**Remember:** Tests are a tool for confidence, not a goal. Ship working software.
