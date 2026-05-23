# E2E Testing Best Practices

## Core Philosophy

- **Isolation First**: Every test should run independently. Never rely on state from previous tests.
- **Parallel Safe**: Tests must be written to run in parallel workers without crosstalk.
- **Database Reset**: The database is reset before the suite runs (`globalSetup`), but NOT between tests.
- **No "API" Shortcuts**: Prefer UI interactions over API shortcuts unless testing specific edge cases.

## Authentication

**Prefer `storageState` for single-role tests.** Auth is expensive (8-12s per login). The `auth-setup` Playwright project logs in once per role and saves cookies to `e2e/.auth/*.json`. Tests opt in via:

```typescript
import { STORAGE_STATE } from "../support/auth-state";

test.describe("My Feature", () => {
  test.use({ storageState: STORAGE_STATE.member }); // pre-authenticated

  test("something", async ({ page }) => {
    await page.goto("/dashboard"); // starts already logged in
  });
});
```

**When NOT to use `storageState`:**

- **Auth flow tests** (`auth-flows.spec.ts`, signup, password reset) — must test the login UI itself
- **Public route tests** — no auth needed, omit `test.use()` entirely
- **Multi-role tests** — use `loginAs` to switch roles mid-test
- **Dynamic user tests** — user is created at runtime via `createTestUser`, use `loginAs` after creation

**Roles available:** `STORAGE_STATE.admin`, `.member`, `.technician`
(guest and usernameAccount not cached — no eligible single-role tests)

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

- **DO**: Use `submitFormAndWaitForRedirect` helper for form submissions that redirect.
- **DO**: Use semantic assertions (`expect(...).toBeVisible()`, `expect(...).toContainText(...)`) as the readiness gate after mutations — these naturally retry until the UI reflects the server response.
- **DON'T**: Use `waitForLoadState("networkidle")` — it stalls indefinitely on pages with persistent connections (Turnstile widget, SSE, WebSocket). Direct usage was removed from full spec files in Phase 2 of the CI hardening effort; shared helpers should also avoid it.
- **DON'T**: Use `waitForURL(callback)` for search-param checks (e.g. `url.searchParams.get("q")`). On Safari/WebKit, `router.push()` uses `pushState` which doesn't fire Playwright's URL change event. Use `expect.poll()` instead:

```typescript
// BAD — fails on Safari with pushState-based navigation
await page.waitForURL((url) => url.searchParams.get("q") === query);

// GOOD — polls until the condition holds
await expect
  .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 15000 })
  .toBe(query);
```

- **OK**: `waitForURL(/pathname/)` for full-page navigations (pathname changes) — those trigger real browser navigation events and work cross-browser.

### 2. Mobile Stability

Mobile viewports use the BottomTabBar for navigation. Desktop uses AppHeader nav links.

- **DO**: Use `ensureLoggedIn` which handles auth checks on all viewports (unified AppHeader).
- **DO**: Use `data-testid="app-header"` for header assertions — same testid on mobile and desktop.
- **DO**: Use `data-testid="bottom-tab-bar"` for mobile-only tab bar assertions.

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
