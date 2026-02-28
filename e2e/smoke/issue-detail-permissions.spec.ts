import { test, expect } from "@playwright/test";
import { getIssueSidebar, loginAs } from "../support/actions.js";
import { seededIssues, TEST_USERS } from "../support/constants.js";

test.describe("Issue detail permission-aware UI", () => {
  test.describe("Unauthenticated visitor", () => {
    test("sees read-only badges instead of selects", async ({
      page,
    }, testInfo) => {
      const issue = seededIssues.AFM[0];
      await page.goto(`/m/AFM/i/${issue.num}`);

      await expect(page).toHaveURL(`/m/AFM/i/${issue.num}`);

      const sidebar = getIssueSidebar(page, testInfo);

      // All four field selects should be absent for unauthenticated users
      await expect(sidebar.getByTestId("issue-status-select")).toHaveCount(0);
      await expect(sidebar.getByTestId("issue-severity-select")).toHaveCount(0);
      await expect(sidebar.getByTestId("issue-priority-select")).toHaveCount(0);
      await expect(sidebar.getByTestId("issue-frequency-select")).toHaveCount(
        0
      );

      // Read-only badges should be visible (use first() since badges appear in both header and sidebar)
      await expect(
        page.getByTestId("issue-status-badge").first()
      ).toBeVisible();
      await expect(
        page.getByTestId("issue-severity-badge").first()
      ).toBeVisible();
      await expect(
        page.getByTestId("issue-priority-badge").first()
      ).toBeVisible();
      await expect(
        page.getByTestId("issue-frequency-badge").first()
      ).toBeVisible();

      // Assignee should be read-only
      await expect(sidebar.getByTestId("assignee-readonly")).toBeVisible();

      // Watch button should be hidden
      await expect(
        page.getByRole("button", { name: /watch issue/i })
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /unwatch issue/i })
      ).toHaveCount(0);

      // Comment: login prompt visible
      await expect(page.getByTestId("login-to-comment")).toBeVisible();
    });
  });

  test.describe("Guest on another user's issue", () => {
    test("sees disabled controls for all fields", async ({
      page,
    }, testInfo) => {
      await loginAs(page, testInfo, {
        email: TEST_USERS.guest.email,
        password: TEST_USERS.guest.password,
      });

      const otherIssue = seededIssues.AFM[0]; // reported by member
      await page.goto(`/m/AFM/i/${otherIssue.num}`);

      const sidebar = getIssueSidebar(page, testInfo);

      // All selects should be visible but disabled
      await expect(sidebar.getByTestId("issue-status-select")).toBeDisabled();
      await expect(sidebar.getByTestId("issue-severity-select")).toBeDisabled();
      await expect(sidebar.getByTestId("issue-priority-select")).toBeDisabled();
      await expect(
        sidebar.getByTestId("issue-frequency-select")
      ).toBeDisabled();

      // Assignee picker should be visible but disabled
      await expect(
        sidebar.getByTestId("assignee-picker-trigger")
      ).toBeDisabled();
    });

    test("can see watch button and comment input", async ({
      page,
    }, testInfo) => {
      await loginAs(page, testInfo, {
        email: TEST_USERS.guest.email,
        password: TEST_USERS.guest.password,
      });

      const otherIssue = seededIssues.AFM[0];
      await page.goto(`/m/AFM/i/${otherIssue.num}`);

      // Watch button should be visible for authenticated users
      const sidebar = getIssueSidebar(page, testInfo);
      await expect(
        sidebar.getByRole("button", { name: /watch issue|unwatch issue/i })
      ).toBeVisible();

      // Comment input should be visible (not the login prompt)
      await expect(page.getByTestId("login-to-comment")).toHaveCount(0);
      await expect(
        page.getByRole("textbox", { name: "Comment" })
      ).toBeVisible();
    });
  });

  test.describe("Guest on own issue", () => {
    test("has enabled status, severity, frequency but disabled priority and assignee", async ({
      page,
    }, testInfo) => {
      await loginAs(page, testInfo, {
        email: TEST_USERS.guest.email,
        password: TEST_USERS.guest.password,
      });

      const ownIssue = seededIssues.AFM[1]; // reported by guest
      await page.goto(`/m/AFM/i/${ownIssue.num}`);

      const sidebar = getIssueSidebar(page, testInfo);

      // Status, severity, frequency should be enabled on own issue
      await expect(sidebar.getByTestId("issue-status-select")).toBeEnabled();
      await expect(sidebar.getByTestId("issue-severity-select")).toBeEnabled();
      await expect(sidebar.getByTestId("issue-frequency-select")).toBeEnabled();

      // Priority is always disabled for guests, even on own issue
      await expect(sidebar.getByTestId("issue-priority-select")).toBeDisabled();

      // Assignee is always disabled for guests, even on own issue
      await expect(
        sidebar.getByTestId("assignee-picker-trigger")
      ).toBeDisabled();
    });
  });

  test.describe("Member", () => {
    test("has all controls enabled", async ({ page }, testInfo) => {
      await loginAs(page, testInfo, {
        email: TEST_USERS.member.email,
        password: TEST_USERS.member.password,
      });

      const issue = seededIssues.AFM[0];
      await page.goto(`/m/AFM/i/${issue.num}`);

      const sidebar = getIssueSidebar(page, testInfo);

      // All selects should be enabled
      await expect(sidebar.getByTestId("issue-status-select")).toBeEnabled();
      await expect(sidebar.getByTestId("issue-severity-select")).toBeEnabled();
      await expect(sidebar.getByTestId("issue-priority-select")).toBeEnabled();
      await expect(sidebar.getByTestId("issue-frequency-select")).toBeEnabled();

      // Assignee picker should be enabled
      await expect(
        sidebar.getByTestId("assignee-picker-trigger")
      ).toBeEnabled();
    });

    test("can see watch button and comment input", async ({
      page,
    }, testInfo) => {
      await loginAs(page, testInfo, {
        email: TEST_USERS.member.email,
        password: TEST_USERS.member.password,
      });

      const issue = seededIssues.AFM[0];
      await page.goto(`/m/AFM/i/${issue.num}`);

      // Watch button should be visible
      const sidebar = getIssueSidebar(page, testInfo);
      await expect(
        sidebar.getByRole("button", { name: /watch issue|unwatch issue/i })
      ).toBeVisible();

      // Comment input should be visible
      await expect(page.getByTestId("login-to-comment")).toHaveCount(0);
      await expect(
        page.getByRole("textbox", { name: "Comment" })
      ).toBeVisible();
    });
  });
});
