# E2E Testing Best Practices

## Core Philosophy

- **Isolation First**: Every test should run independently. Never rely on state from previous tests.
- **Parallel Safe**: Tests must be written to run in parallel workers without crosstalk.
- **Database Reset**: The database is reset before the suite runs (`globalSetup`), but NOT between tests.
- **No "API" Shortcuts**: Prefer UI interactions over API shortcuts unless testing specific edge cases.

## Test Structure

### Smoke Tests (`e2e/smoke/`)

- **Goal**: Fast verification of critical paths (Login, Dashboard load).
- **Frequency**: Run on every commit (Preflight).
- **Config**: `playwright.config.smoke.ts`.
- **Parallelism**: Files run in parallel, tests within files run in parallel.

### Full Suite (`e2e/full/`)

- **Goal**: Comprehensive coverage of all features.
- **Frequency**: Run before merge / nightly.
- **Config**: `playwright.config.full.ts`.
- **Parallelism**: Files run in parallel (`fullyParallel: false` by default in config, though we aim for true), tests within files run sequentially (`test.describe.serial` recommended for complex flows).

## Parallel Execution & Worker Isolation

PinPoint uses a shared database for E2E tests to mirror production architecture. This requires strict discipline to avoid "Crosstalk" (one test's actions affecting another).

**The "Nuclear" Isolation Pattern:**

For tests involving global resources (like "Recent Issues" lists or Admin dashboards), use **Unique Resources per Worker**.

1.  **Unique Users**: Create a fresh user for the test run.
2.  **Unique Machines**: Create a fresh machine for the test run.
3.  **Unique Titles**: Use `getTestIssueTitle()` to prefix titles.

```typescript
test("isolated test", async ({ page }) => {
  // 1. Create unique resources
  const admin = await createTestUser(getTestEmail("admin@test.com"));
  const machine = await createTestMachine(admin.id);

  // 2. Run test using ONLY these resources
  await page.goto(`/report?machine=${machine.initials}`);
  // ...
});
```

## Flakiness Prevention

### 1. Waiting for Server Actions

Server Actions in Next.js can be slow to revalidate.

- **DO**: Use `waitForLoadState("networkidle")` after submitting forms that trigger revalidation.
- **DO**: Use `submitFormAndWaitForRedirect` helper.
- **DON'T**: Rely solely on `expect(...).toBeVisible()` immediately after a click if the UI update depends on a round-trip.

### 2. Mobile Stability

Mobile viewports (e.g., Pixel 5) hide the sidebar and use a hamburger menu.

- **DO**: Use `ensureLoggedIn` which handles both desktop and mobile navigation checks.
- **DO**: Be aware that "Click Sidebar" actions might need to open the mobile menu first.

### 3. Mailpit & Emails

Mailpit is shared across all workers.

- **NEVER**: Use `mailpit.clearMailbox()` (it clears for EVERYONE).
- **ALWAYS**: Use specific criteria in `waitForEmail`, such as the unique issue title.

```typescript
// BAD
const email = await mailpit.waitForEmail(adminEmail, {
  subjectContains: "Status Changed",
});

// GOOD
const email = await mailpit.waitForEmail(adminEmail, {
  subjectContains: uniqueIssueTitle,
});
```
