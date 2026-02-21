---
name: pinpoint-e2e
description: E2E testing guide for PinPoint (Playwright, Isolation, Mailpit, Supabase). Use when writing, debugging, or fixing E2E tests to ensure worker isolation and stability.
---

# PinPoint E2E Testing Skill

This skill guides you through the E2E testing infrastructure of PinPoint.

## Quick Start

- **Run Smoke Tests**: `pnpm run smoke` (Fast, critical paths)
- **Run Full Suite**: `pnpm run e2e:full` (Comprehensive)
- **Debug Mode**: `pnpm exec playwright test e2e/path/to/test.spec.ts --debug`

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
    - _Fix_: Ensure `x-skip-autologin` is NOT interfering, use `ensureLoggedIn`, and check `test.describe.serial` if tests share a user.
3.  **Timeout?**: Waiting for a toast or email?
    - _Fix_: Use `waitForLoadState("networkidle")` before assertions. Increase timeouts for emails.
4.  **Mobile?**: Can't find the sidebar?
    - _Fix_: Use `ensureLoggedIn` (handles mobile menu).

## Creating a New Test

1.  **Scaffold**:

    ```typescript
    import { test, expect } from "@playwright/test";
    import { ensureLoggedIn } from "../support/actions";
    import { getTestIssueTitle } from "../support/test-isolation";

    test("my feature works", async ({ page }, testInfo) => {
      await ensureLoggedIn(page, testInfo);
      const title = getTestIssueTitle("Feature Test");
      // ...
    });
    ```

2.  **Isolate**: If modifying global state, create a temp user/machine in `beforeAll`.
3.  **Cleanup**: Delete created resources in `afterAll`.
