---
name: pinpoint-e2e
description: E2E testing guide for PinPoint (Playwright, Isolation, Mailpit, Supabase). Use when writing, debugging, or fixing E2E tests to ensure worker isolation and stability.
---

# PinPoint E2E Testing Skill

This skill guides you through the E2E testing infrastructure of PinPoint.

## Quick Start

- **Run Smoke Tests**: `pnpm run smoke` (Fast, critical paths)
- **Run Full Suite**: `pnpm run e2e:full` (Comprehensive — CI only, don't run locally unless asked)
- **Debug Mode**: `pnpm exec playwright test e2e/path/to/test.spec.ts --debug`

## Which Tests to Run (Decision Tree)

1. **Changed pure logic/utils?** → `pnpm run check` (unit tests, ~12s)
2. **Changed a single E2E-relevant file?** → `pnpm exec playwright test e2e/path/to/file.spec.ts --project=chromium` (~15-30s)
3. **Changed UI components/forms?** → `pnpm run smoke` (~60s)
4. **Changed auth/permissions/middleware?** → `pnpm run smoke` + targeted full specs
5. **Changed DB schema/migrations?** → `pnpm run preflight` (full suite)
6. **NEVER** run `e2e:full` locally unless explicitly asked — that's what CI is for

**Key rules for agents:**

- Always use `--project=chromium` for targeted runs (skip Mobile Chrome unless testing responsive)
- Use `--headed` for debugging visual issues
- `pnpm run check` catches 90% of issues — E2E is for integration verification, not iteration
- If a test is flaky locally, report it — don't retry in a loop

## The Golden Rule: Worker Isolation

PinPoint E2E tests run in parallel against a **shared database**.

**YOU MUST PREVENT CROSSTALK.**

1.  **Unique Data**: Never assume the DB is empty. Always create your own unique data.
2.  **Unique Users**: Do not share `admin@test.com` across parallel tests if those tests modify global state (e.g., settings, notifications).
3.  **Unique Machines**: Create a fresh machine for your test.
4.  **Unique Titles**: Use `getTestIssueTitle("My Title")` to prefix issues with `[w0_xyz]`.

## References

- **Best Practices**: See [references/e2e-best-practices.md](references/e2e-best-practices.md) for structure and anti-patterns.
- **Isolation Patterns**: See [references/isolation-patterns.md](references/isolation-patterns.md) for how to use `test-isolation.ts` and `supabase-admin.ts`.
- **Helpers**: See [references/common-helpers.md](references/common-helpers.md) for `actions.ts`, `page-helpers.ts`, and `mailpit.ts`.

## Debugging Checklist

If a test fails in CI or parallel mode:

1.  **Crosstalk?**: Is it seeing data from another worker? (Check screenshots for other prefixes).
    - _Fix_: Use `getTestPrefix()` filtering and unique resources.
2.  **Session Lost?**: Redirecting to `/report/success` or `/login` unexpectedly?
    - _Fix_: Ensure `x-skip-autologin` is NOT interfering. Add `test.use({ storageState: STORAGE_STATE.<role> })` to the describe block, or use `loginAs` for mid-test role switches. Check `test.describe.serial` if tests share a user.
3.  **Timeout?**: Waiting for a toast or email?
    - _Fix_: Use `waitForLoadState("networkidle")` before assertions. Increase timeouts for emails.
4.  **Mobile?**: Can't find the sidebar?
    - _Fix_: Use `testInfo.project.name.includes("Mobile")` to branch between mobile/desktop selectors. With storageState, navigate directly to the target page instead of the dashboard.

## Authentication Strategy

**Decision tree for new tests:**

| Test type                                   | Auth approach                                      |
| :------------------------------------------ | :------------------------------------------------- |
| Tests one role throughout                   | `test.use({ storageState: STORAGE_STATE.<role> })` |
| Switches roles mid-test                     | `loginAs(page, testInfo, { email, password })`     |
| Tests login/signup/password reset           | No auth — start unauthenticated                    |
| Tests public routes                         | No auth — omit `test.use()`                        |
| Dynamic user (created via `createTestUser`) | `loginAs` after creating the user                  |

**Available roles:**

```typescript
import { STORAGE_STATE } from "../support/auth-state"; // adjust path to e2e root

// STORAGE_STATE.admin      → admin@test.com
// STORAGE_STATE.member     → member@test.com
// STORAGE_STATE.technician → technician@test.com
```

No auth needed for unauthenticated tests — simply omit `test.use()`.

## Creating a New Test

1.  **Scaffold** (single-role — preferred):

    ```typescript
    import { test, expect } from "@playwright/test";
    import { STORAGE_STATE } from "../support/auth-state";
    import { getTestIssueTitle } from "../support/test-isolation";

    test.describe("My Feature", () => {
      test.use({ storageState: STORAGE_STATE.member });

      test("my feature works", async ({ page }) => {
        const title = getTestIssueTitle("Feature Test");
        await page.goto("/dashboard");
        // ...
      });
    });
    ```

2.  **Scaffold** (multi-role or auth flow — use loginAs):

    ```typescript
    import { test, expect } from "@playwright/test";
    import { loginAs } from "../support/actions";

    test("role-switch works", async ({ page }, testInfo) => {
      await loginAs(page, testInfo); // logs in as member
      // ... do member actions
    });
    ```

3.  **Isolate**: If modifying global state, create a temp user/machine in `beforeAll`.
4.  **Cleanup**: Delete created resources in `afterAll`.
