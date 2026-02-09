import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { seededIssues, TEST_USERS } from "../support/constants.js";

test.describe("Issue detail permission-aware UI", () => {
  test("unauthenticated users can view issue detail with read-only controls", async ({
    page,
  }) => {
    const issue = seededIssues.AFM[0];
    await page.goto(`/m/AFM/i/${issue.num}`);

    await expect(page).toHaveURL(`/m/AFM/i/${issue.num}`);
    await expect(page.getByTestId("login-to-comment")).toBeVisible();

    // Unauthenticated users should get read-only badges, not editable controls.
    await expect(page.getByTestId("issue-status-select")).toHaveCount(0);
    await expect(page.getByTestId("issue-severity-select")).toHaveCount(0);
    await expect(page.getByTestId("issue-priority-select")).toHaveCount(0);
    await expect(page.getByTestId("issue-frequency-select")).toHaveCount(0);
    await expect(page.getByTestId("assignee-readonly")).toBeVisible();

    // Watching requires auth.
    await expect(
      page.getByRole("button", { name: /watch issue/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /unwatch issue/i })
    ).toHaveCount(0);
  });

  test("guest sees disabled controls for non-owned issue and enabled controls for owned issue", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });

    // Guest on someone else's issue: status should be disabled.
    const otherIssue = seededIssues.AFM[0];
    await page.goto(`/m/AFM/i/${otherIssue.num}`);
    const disabledStatus = page.getByTestId("issue-status-select").first();
    await expect(disabledStatus).toBeDisabled();

    // Guest on own seeded issue: status should be enabled.
    const ownIssue = seededIssues.AFM[1];
    await page.goto(`/m/AFM/i/${ownIssue.num}`);
    const enabledStatus = page.getByTestId("issue-status-select").first();
    await expect(enabledStatus).toBeEnabled();
  });
});
