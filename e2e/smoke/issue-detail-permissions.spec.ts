/**
 * Smoke: Issue detail page renders for an unauthenticated visitor.
 *
 * Coverage goal: D-class — "page loads without 500" for each role.
 * All permission-enforcement assertions (E-class) live in:
 *   src/test/integration/issue-detail-permissions.test.ts
 * All UI-state assertions (H-class) live in:
 *   src/test/unit/components/issues/issue-detail-permissions.test.tsx
 */
import { test, expect } from "@playwright/test";
import { seededIssues } from "../support/constants.js";

test.describe("Issue detail smoke — unauthenticated render", () => {
  test("page loads without error for unauthenticated visitor", async ({
    page,
  }) => {
    const issue = seededIssues.AFM[0];
    await page.goto(`/m/AFM/i/${issue.num}`);

    // Confirm the page did not redirect to an error or login page.
    await expect(page).toHaveURL(`/m/AFM/i/${issue.num}`);

    // The issue title heading is the canonical signal that the detail page
    // rendered successfully (not a 500 / redirect / blank screen).
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 })
    ).toBeVisible();
  });
});
