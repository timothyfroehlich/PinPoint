import { test, expect, type TestInfo, type Page } from "@playwright/test";
import { loginAs, logout } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("Reporter Variations E2E", () => {
  test.beforeEach(async ({ page }: { page: Page }, testInfo: TestInfo) => {
    test.setTimeout(60000);
    await loginAs(page, testInfo);
  });

  test("should display confirmed member reporter correctly", async ({
    page,
  }) => {
    // AFM Issue 1 is reportedBy member@test.com
    await page.goto("/m/AFM/i/1");
    const sidebar = page.getByTestId("issue-sidebar");

    // Check for member name and email in the reporter section
    await expect(sidebar).toContainText("Member User");
    await expect(sidebar).not.toContainText("member@test.com");

    // Check timeline initial report
    await expect(
      page
        .getByTestId("timeline-author-name")
        .filter({ hasText: "Member User" })
    ).toBeVisible();
  });

  test("should display guest with name and email correctly", async ({
    page,
  }) => {
    // TAF Issue 1 is reporterName: 'John Guest', reporterEmail: 'john@guest.com'
    await page.goto("/m/TAF/i/1");
    const sidebar = page.getByTestId("issue-sidebar");

    await expect(sidebar).toContainText("John Guest");
    await expect(sidebar).not.toContainText("john@guest.com");
  });

  test("should display guest with name only correctly", async ({ page }) => {
    // TAF Issue 2 is reporterName: 'Only Name'
    await page.goto("/m/TAF/i/2");
    const sidebar = page.getByTestId("issue-sidebar");

    await expect(sidebar).toContainText("Only Name");
  });

  test("should display guest with email only correctly", async ({ page }) => {
    // TAF Issue 3 is reporterEmail: 'only@email.com'
    await page.goto("/m/TAF/i/3");
    const sidebar = page.getByTestId("issue-sidebar");

    await expect(sidebar).toContainText("Anonymous");
    await expect(sidebar).not.toContainText("only@email.com");
  });

  test("should display fully anonymous reporter correctly", async ({
    page,
  }) => {
    // TAF Issue 4 is all null
    await page.goto("/m/TAF/i/4");
    const sidebar = page.getByTestId("issue-sidebar");

    await expect(sidebar).toContainText("Anonymous");
  });

  test("should display invited user reporter correctly (legacy logic)", async ({
    page,
  }) => {
    // TAF Issue 5 is invitedReportedBy (Jane Doe)
    await page.goto("/m/TAF/i/5");
    const sidebar = page.getByTestId("issue-sidebar");

    await expect(sidebar).toContainText("Jane Doe");
    await expect(sidebar).not.toContainText("jane.doe@example.com");
    await expect(
      page.getByTestId("timeline-author-name").filter({ hasText: "Jane Doe" })
    ).toBeVisible();
  });

  test("should display emails for administrators", async ({
    page,
  }, testInfo) => {
    // Log out first to switch to admin
    await logout(page);

    // Log in as admin
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // AFM Issue 1 is reportedBy member@test.com
    await page.goto("/m/AFM/i/1");
    const sidebar = page.getByTestId("issue-sidebar");

    // Admins should NOT see emails in the sidebar anymore
    await expect(sidebar).toContainText("Member User");
    await expect(sidebar).not.toContainText("member@test.com");
  });
});
