# E2E Testing Best Practices

**Last Updated**: 2025-11-12
**Status**: ACTIVE - Authoritative guide for Playwright E2E tests

## Philosophy

E2E tests validate **critical user journeys** - the paths that must work for the app to deliver value. They are:

- **Expensive** to write and maintain
- **Slow** to execute
- **Fragile** when done wrong
- **Invaluable** when done right

**Golden Rule**: If a test doesn't validate a user journey that would cause support calls or lost trust, don't write it.

---

## Test Selection Criteria

### ✅ DO Write E2E Tests For

1. **Critical User Journeys** - Core value propositions
   - Public issue reporting (primary use case)
   - Member login → view assigned issues
   - Issue resolution workflow with timeline
   - Machine creation and listing

2. **Auth Boundaries** - Security critical
   - Protected routes redirect to login
   - Logout clears session
   - Signup creates functional account

3. **State Transitions** - Complex multi-step flows
   - Issue status changes with timeline updates
   - Comment addition with instant visibility

4. **Integration Points** - External dependencies
   - Supabase authentication flows
   - Database persistence across page reloads

### ❌ DON'T Write E2E Tests For

1. **Pure UI Logic** - Use unit tests
   - Form validation messages
   - Button disabled states
   - Color changes, animations

2. **Edge Cases** - Use integration tests
   - Null/undefined handling
   - Empty state rendering
   - Error boundary triggers

3. **Implementation Details** - Brittle and low value
   - Specific CSS classes
   - Component internal state
   - Event handler existence

4. **Already Covered** - Avoid redundancy
   - If unit + integration tests cover it well
   - If it's a subset of another E2E test

---

## Selector Strategy

**Priority Order** (most stable → least stable):

### 1. Semantic Role + Accessible Name (BEST)

```typescript
// ✅ Excellent - uses accessibility tree
await page.getByRole("button", { name: "Sign In" });
await page.getByRole("heading", { name: "Dashboard" });
await page.getByLabel("Email");
```

**Why**: Reflects how users and screen readers interact. Changes force accessibility review.

### 2. Visible Text (GOOD for content)

```typescript
// ✅ Good for static content
await expect(page.getByText("Issue reported successfully")).toBeVisible();
await expect(page.getByText(seededMember.name)).toBeVisible();
```

**Why**: Reflects user-visible content. Fails if UX copy changes (good forcing function).

### 3. Test IDs (RECOMMENDED for repeated elements)

```typescript
// ✅ Recommended when elements appear multiple times
await page.getByTestId("machine-status-badge");
await page.getByTestId("issue-card");
await page.getByTestId("detail-open-issues-count");
```

**Why**: Prevents Playwright strict mode violations when text/role appears multiple times on page. Explicit, stable, and prevents brittle selectors.

**When to Add During Implementation**:

- **Status badges** that appear in multiple places (header + detail card)
- **Counts/numbers** that may appear in multiple contexts (0, dates, totals)
- **Repeated components** (issue cards, machine cards, list items)
- **Any text** that could plausibly appear twice on the same page

**Best Practice**: Add `data-testid` proactively during implementation when you know an element might not be unique. This is cheaper than fixing strict mode violations later.

### 4. CSS Selectors (LAST RESORT)

```typescript
// ❌ Avoid - brittle and coupled to implementation
await page.locator(".btn-primary");
await page.locator("#user-dropdown");
```

**Why**: Breaks on CSS refactors, doesn't reflect user behavior.

---

## Writing Robust Tests

### Pattern: Dynamic Counting (Resilient to Data Changes)

When testing lists or counts, avoid hardcoding expected values. Instead, verify the UI matches reality:

```typescript
// ❌ Bad - breaks if seed data changes or user adds test data
await expect(page.getByTestId("open-issues-count")).toContainText("4");

// ✅ Good - count visible elements and verify UI matches
const issueCards = page.getByTestId("issue-card");
const displayedCountText = await page
  .getByTestId("open-issues-count")
  .textContent();
const displayedCount = Number(displayedCountText);
const actualCardCount = await issueCards.count();

expect(actualCardCount).toBe(displayedCount); // UI is consistent
expect(actualCardCount).toBeGreaterThan(0); // Has data to display
```

**Why**: Tests remain stable even when:

- Seed data changes
- Manual testing adds records
- Database state varies between runs

**Use this pattern for**:

- Issue counts, machine lists, comment threads
- Any collection where exact count may vary
- Before/after verification (create action → verify count incremented)

### Pattern: Arrange-Act-Assert

```typescript
test("user can report issue", async ({ page }) => {
  // ARRANGE: Set up initial state
  await page.goto("/report-issue");

  // ACT: Perform user actions
  await page.getByLabel("Machine").selectOption("twilight-zone");
  await page.getByLabel("Issue Title").fill("Broken flipper");
  await page.getByRole("button", { name: "Submit" }).click();

  // ASSERT: Verify expected outcome
  await expect(page).toHaveURL("/issues/confirmation");
  await expect(page.getByText("Issue reported successfully")).toBeVisible();
});
```

**Keep it Simple**: One concept per test, clear steps, obvious assertion.

### Wait for Elements (Don't Race)

```typescript
// ❌ Bad - implicit wait may timeout unpredictably
await page.click('button[type="submit"]');
expect(page.url()).toBe("/dashboard"); // Race condition!

// ✅ Good - explicit expectation with built-in retry
import { DEFAULT_NAVIGATION_TIMEOUT } from "~/e2e/support/constants";

await page.getByRole("button", { name: "Submit" }).click();
await expect(page).toHaveURL("/dashboard", {
  timeout: DEFAULT_NAVIGATION_TIMEOUT,
});
```

> Subsequent snippets assume `DEFAULT_NAVIGATION_TIMEOUT` is imported from `~/e2e/support/constants`.

**Playwright auto-waits** for most actions, but use `expect()` for state verification.

### Handle Asynchronous Operations

```typescript
// ✅ Good - wait for navigation after form submit
await page.getByRole("button", { name: "Sign In" }).click();
await expect(page).toHaveURL("/dashboard", {
  timeout: DEFAULT_NAVIGATION_TIMEOUT,
});

// ✅ Good - wait for API response before asserting
await page.getByRole("button", { name: "Create Machine" }).click();
await expect(page.getByText("Machine created successfully")).toBeVisible();
```

**Avoid `page.waitForTimeout()`** - brittle and slow. Use semantic waits.

### Isolate Tests (No Dependencies)

```typescript
// ❌ Bad - test depends on previous test's state
test("create machine", async ({ page }) => {
  // Creates "Twilight Zone"
});

test("view machine details", async ({ page }) => {
  // Assumes "Twilight Zone" exists from previous test ❌
});

// ✅ Good - each test is independent
test("view machine details", async ({ page }) => {
  // Seed "Twilight Zone" in this test's setup
  await seedMachine({ name: "Twilight Zone" });
  await page.goto("/machines/twilight-zone");
  // ...
});
```

**Use `.serial()` only when tests MUST run in order** (e.g., multi-step workflow in single test file).

---

## Test Organization

### File Naming Convention

```
e2e/
├── smoke/
│   ├── landing-page.spec.ts        # Basic smoke test
│   ├── auth-flows.spec.ts          # Auth journeys
│   └── navigation.spec.ts          # Navigation behavior
└── support/
    ├── actions.ts                   # Reusable actions (login, seed)
    └── constants.ts                 # Test data (seeded users)
```

**Smoke Tests**: High-level, critical paths only (5-10 tests total).

### Descriptive Test Names

```typescript
// ❌ Bad - vague
test("signup works", async ({ page }) => {});

// ✅ Good - specific about what's tested
test("signup flow - create new account and access dashboard", async ({
  page,
}) => {});

// ✅ Good - describes the scenario
test("protected route - redirect to login when not authenticated", async ({
  page,
}) => {});
```

**Format**: `[feature] - [scenario] - [expected outcome]`

### Group Related Tests

```typescript
test.describe("Authentication", () => {
  test("signup flow - create new account", async ({ page }) => {});
  test("login flow - sign in with existing account", async ({ page }) => {});
  test("logout flow - sign out and verify redirect", async ({ page }) => {});
});
```

**Benefits**: Shared setup, logical grouping, better reporting.

---

## Reusable Actions

### Extract Common Workflows

```typescript
// e2e/support/actions.ts
import { Page } from "@playwright/test";
import { seededMember } from "./constants";

export async function loginAs(
  page: Page,
  credentials = seededMember
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("/dashboard", { timeout: DEFAULT_NAVIGATION_TIMEOUT });
}

export async function createIssue(
  page: Page,
  issue: { machineId: string; title: string }
): Promise<void> {
  await page.goto("/issues/new");
  await page.getByLabel("Machine").selectOption(issue.machineId);
  await page.getByLabel("Issue Title").fill(issue.title);
  await page.getByRole("button", { name: "Submit" }).click();
}
```

**Use in Tests**:

```typescript
import { loginAs, createIssue } from "../support/actions";

test("member can create issue", async ({ page }) => {
  await loginAs(page);
  await createIssue(page, {
    machineId: "twilight-zone",
    title: "Broken flipper",
  });
  await expect(page.getByText("Issue created")).toBeVisible();
});
```

**Benefits**: DRY, maintainable, consistent.

---

## Test Data Management

### Use Seed Data for Predictability

```typescript
// e2e/support/constants.ts
export const seededMember = {
  email: "member@example.com",
  password: "TestPassword123", // Only for E2E tests
  name: "Test Member",
};

export const seededMachines = {
  twilightZone: { id: "twilight-zone", name: "Twilight Zone" },
  medievalMadness: { id: "medieval-madness", name: "Medieval Madness" },
};
```

**Seed Script** (`supabase/seed.sql`):

```sql
-- Create test user (hashed password for "TestPassword123")
INSERT INTO auth.users (id, email) VALUES
  ('test-member-id', 'member@example.com');

-- Create test machines
INSERT INTO machines (id, name, manufacturer, year) VALUES
  ('twilight-zone', 'Twilight Zone', 'Bally', 1993),
  ('medieval-madness', 'Medieval Madness', 'Williams', 1997);
```

**Benefits**: Deterministic tests, no test pollution, fast setup.

### Avoid Dynamic Data Generation in E2E

```typescript
// ❌ Bad - non-deterministic
const timestamp = Date.now();
const email = `test-${timestamp}@example.com`;

// ✅ Good - use seeded data
const email = seededMember.email;

// ⚠️ Acceptable ONLY for signup tests (one-time accounts)
test("signup creates new account", async ({ page }) => {
  const timestamp = Date.now();
  const email = `e2e-test-${timestamp}@example.com`; // Unique per run
  // ...
});
```

**Why**: Seeded data is faster, predictable, and easier to debug.

---

## Debugging Failed Tests

### 1. Run in UI Mode

```bash
pnpm exec playwright test --ui
```

**Shows**: Test execution step-by-step, screenshots, network calls.

### 2. Run in Headed Mode

```bash
pnpm exec playwright test --headed --debug
```

**Opens**: Real browser window, pauses at failures.

### 3. Enable Trace

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: "on-first-retry", // Captures full trace on retry
  },
});
```

**View Trace**: `pnpm exec playwright show-trace trace.zip`

### 4. Add Console Logs

```typescript
test("debug test", async ({ page }) => {
  page.on("console", (msg) => console.log(msg.text()));
  // Test steps...
});
```

**Captures**: Browser console output in terminal.

---

## Performance Optimization

### Parallel Execution

```typescript
// playwright.config.ts
export default defineConfig({
  // Run tests in parallel locally, but serially in CI
  fullyParallel: !process.env.CI,
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
});
```

**Local Development**: Parallel for speed.
**CI**: Serial to avoid Supabase rate limits and ensure stability.

### Reuse Authentication State

```typescript
// playwright.config.ts
import { test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("TestPassword123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.context().storageState({ path: "auth.json" });
});

// Use in tests
test.use({ storageState: "auth.json" });
```

**Benefits**: Skip login in every test, massive time savings.

### Skip Unnecessary Waits

```typescript
// ❌ Bad - arbitrary wait
await page.waitForTimeout(5000);

// ✅ Good - semantic wait
await expect(page.getByText("Loading...")).not.toBeVisible();
await expect(page.getByText("Content loaded")).toBeVisible();
```

---

## Environment Defaults (Local/Preview)

- **Autologin:** When `DEV_AUTOLOGIN_ENABLED=true` (default for dev/preview), middleware auto-signs in with `DEV_AUTOLOGIN_EMAIL`/`DEV_AUTOLOGIN_PASSWORD` (seeded admin by default) if no valid session exists. Opt out per-request with header `x-skip-autologin: true`, cookie `skip_autologin=true`, or query `?autologin=off`—use these for guest/public E2E scenarios.
- **Fast DB reset:** Playwright `global-setup` now uses `pnpm run db:fast-reset` first. If it fails (e.g., brand-new container without tables), it falls back to the full `supabase db reset` + schema push + seeding automatically. Set `SKIP_SUPABASE_RESET=true` to bypass entirely for iterative UI-only runs.
- **Cleanup API:** `/api/test-data/cleanup` accepts `issueIds`, `machineIds`, and `issueTitlePrefix`. The Playwright helper `cleanupTestEntities` now forwards `issueTitlePrefix`, so public-reporting tests stay tidy.

---

## Common Anti-Patterns

### ❌ Over-Testing UI Details

```typescript
// ❌ Bad - tests implementation
test("button has blue background", async ({ page }) => {
  const button = page.getByRole("button", { name: "Submit" });
  await expect(button).toHaveCSS("background-color", "rgb(0, 0, 255)");
});

// ✅ Good - tests behavior
test("submit button creates issue", async ({ page }) => {
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Issue created")).toBeVisible();
});
```

### ❌ Testing Every Edge Case

```typescript
// ❌ Bad - edge cases belong in unit tests
test("handles empty string");
test("handles null");
test("handles undefined");
test("handles 10000-character string");

// ✅ Good - test happy path and critical error
test("creates issue with valid data");
test("shows error for missing required fields");
```

### ❌ Flaky Selectors

```typescript
// ❌ Bad - breaks on CSS changes
await page.locator(".btn-submit").click();

// ✅ Good - semantic, stable
await page.getByRole("button", { name: "Submit" }).click();
```

### ❌ Hard-Coded Delays

```typescript
// ❌ Bad - arbitrary, brittle
await page.click("button");
await page.waitForTimeout(3000); // Magic number

// ✅ Good - wait for specific condition
await page.getByRole("button").click();
await expect(page.getByText("Success")).toBeVisible();
```

---

## Accessibility Integration

### Tests Should Validate Accessible Markup

```typescript
// ✅ Good - this test validates accessibility
test("form fields have labels", async ({ page }) => {
  await page.goto("/issues/new");

  // If getByLabel() works, labels exist
  await page.getByLabel("Machine").selectOption("twilight-zone");
  await page.getByLabel("Issue Title").fill("Test");
});

// ✅ Good - validates button role and name
test("submit button is accessible", async ({ page }) => {
  await page.goto("/issues/new");

  // If getByRole() finds it, it's accessible
  const submitButton = page.getByRole("button", { name: "Submit" });
  await expect(submitButton).toBeVisible();
});
```

**Bonus**: E2E tests written with semantic selectors validate a11y for free.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps

      # Start Supabase (required for auth)
      - uses: supabase/setup-cli@v1
      - run: supabase start

      # Run tests
      - run: pnpm run smoke

      # Upload artifacts on failure
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**Key Points**:

- Install Playwright browsers in CI
- Start dependencies (Supabase) before tests
- Upload traces/screenshots on failure

---

## Test Maintenance

### Review Quarterly

1. **Remove flaky tests** - Fix or delete, no middle ground
2. **Remove obsolete tests** - Delete tests for removed features
3. **Update seed data** - Keep aligned with schema changes
4. **Refactor duplicated actions** - Extract to `support/actions.ts`

### Red Flags

- ⚠️ Tests pass locally, fail in CI (environment mismatch)
- ⚠️ Tests randomly fail (flaky selectors, timing issues)
- ⚠️ Tests take >2 minutes to run (too many tests, poor parallelization)
- ⚠️ Tests break on every refactor (testing implementation details)

---

## Success Metrics

**Healthy E2E Test Suite:**

- ✅ 5-10 tests covering critical journeys
- ✅ Runs in <60 seconds (local)
- ✅ Zero flakes (consistent pass/fail)
- ✅ Clear failure messages (obvious what broke)
- ✅ No maintenance required during refactors (unless behavior changes)

**When to Add More Tests:**

- ✅ New critical user journey added
- ✅ Production bug in user flow (add regression test)
- ✅ Security boundary added (test auth/authorization)

**When NOT to Add More Tests:**

- ❌ "We should test this edge case" → Unit test
- ❌ "Let's increase coverage" → Metric gaming
- ❌ "This component needs tests" → Integration test

---

## Quick Reference Checklist

**Before Writing an E2E Test:**

- [ ] Is this a critical user journey?
- [ ] Can this be tested faster at a lower level? (unit/integration)
- [ ] Will this test catch production bugs?

**When Writing the Test:**

- [ ] Used semantic selectors (role + name)
- [ ] Avoided hard-coded delays
- [ ] Made test independent (no order dependency)
- [ ] Used descriptive test name
- [ ] Extracted reusable actions if used >2 times

**Before Merging:**

- [ ] Test passes locally
- [ ] Test passes in CI
- [ ] Test passes 5 times in a row (no flakes)
- [ ] Failure message is clear
- [ ] Test runs in <10 seconds

---

**Remember**: E2E tests validate **confidence in deployments**. Write fewer, better tests. Quality > Quantity.
