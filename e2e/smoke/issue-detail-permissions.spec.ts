/**
 * Smoke: Issue detail page renders for an unauthenticated visitor.
 *
 * Coverage goal: D-class — "page loads without 500" for the unauthenticated
 * path. Authenticated render is already covered by e2e/smoke/issues-crud.spec.ts
 * (which uses STORAGE_STATE.member). All permission-enforcement assertions
 * (E-class) live in:
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
    const response = await page.goto(`/m/AFM/i/${issue.num}`);

    // Assert the server actually returned 2xx — a 500 error page can still
    // render with a URL match and an h1, so the response status is the
    // load-bearing assertion for this D-class smoke.
    expect(response?.ok(), "issue detail page should respond 2xx").toBe(true);

    // Confirm the page did not redirect to an error or login page.
    await expect(page).toHaveURL(`/m/AFM/i/${issue.num}`);

    // The issue title heading is the canonical signal that the detail page
    // rendered successfully (not a redirect / blank screen). Target the
    // specific issue-title h1 — after the tabbed-layout PR, the persistent
    // MachineDetailHeader also renders the machine name as an h1, so a bare
    // `heading level=1` selector matches two elements.
    await expect(
      page.getByRole("heading", { level: 1, name: issue.title })
    ).toBeVisible();
  });
});
