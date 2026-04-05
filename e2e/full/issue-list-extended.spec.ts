import { test, expect } from "@playwright/test";
import { cleanupTestEntities } from "../support/cleanup";
import { TEST_USERS, seededIssues, seededMachines } from "../support/constants";
import { fillReportForm } from "../support/page-helpers";
import { getTestIssueTitle } from "../support/test-isolation";
import { STORAGE_STATE } from "../support/auth-state";

test.describe("Issue List Features - Extended", () => {
  // Use Admin to ensure permissions for all inline edits
  test.use({ storageState: STORAGE_STATE.admin });

  // Track issue title prefix for cleanup across tests that create issues
  let createdIssueTitlePrefix: string | undefined;

  test.beforeEach(() => {
    test.setTimeout(60000);
    createdIssueTitlePrefix = undefined;
  });

  test.afterEach(async ({ request }) => {
    if (createdIssueTitlePrefix) {
      await cleanupTestEntities(request, {
        issueTitlePrefix: createdIssueTitlePrefix,
      });
    }
  });

  test("should inline-edit issues", async ({ page }, testInfo) => {
    // Inline-edit columns (priority, assignee) are hidden on mobile viewports
    // via responsive column visibility (useTableResponsiveColumns)
    const isMobile = testInfo.project.name.includes("Mobile");
    test.skip(isMobile, "Inline-edit columns hidden on mobile viewports");

    // Create a unique test issue to avoid parallel worker conflicts
    const issueTitle = getTestIssueTitle("Inline Edit Test");
    createdIssueTitlePrefix = issueTitle;
    const machineInitials = seededMachines.addamsFamily.initials;

    await page.goto(`/report?machine=${machineInitials}`);
    await fillReportForm(page, { title: issueTitle, priority: "low" });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);

    // Navigate to issues list and search for our unique issue
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === issueTitle);
    await expect(page.getByText("Showing 1 of 1 issues")).toBeVisible();

    const row = page.getByRole("row", { name: issueTitle });
    await expect(row).toBeVisible();

    // 1. Test Priority Inline Edit (Low -> High)
    const priorityTrigger = row
      .getByRole("button")
      .filter({ hasText: /Low|Medium|High/ })
      .first();
    await expect(priorityTrigger).toBeVisible();
    await priorityTrigger.click();
    await page.getByRole("menuitem", { name: "High" }).click();

    // Verify optimistic update
    await expect(
      row.getByRole("button").filter({ hasText: "High" })
    ).toBeVisible();

    // Verify persistence after reload
    await page.reload();
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === issueTitle);

    const rowAfterReload = page.getByRole("row", { name: issueTitle });
    await expect(
      rowAfterReload.getByRole("button").filter({ hasText: "High" })
    ).toBeVisible();

    // 2. Test Assignee Inline Edit (Unassigned -> Admin)
    const assigneeCell = rowAfterReload
      .getByRole("button")
      .filter({ hasText: /Unassigned/i });
    await expect(assigneeCell).toBeVisible();
    await assigneeCell.click();
    await page.getByRole("menuitem", { name: TEST_USERS.admin.name }).click();

    // Verify assignee update
    await expect(page.getByText("Assignee updated")).toBeVisible();
    await expect(
      rowAfterReload
        .getByRole("button")
        .filter({ hasText: TEST_USERS.admin.name })
    ).toBeVisible();
  });

  test("should filter by Created and Modified date ranges", async ({
    page,
  }) => {
    // 1. Setup
    // All seeded issues are created "NOW()" so they are today.
    await page.goto("/issues");

    // 2. Expand "More Filters" to see date pickers
    await page.getByRole("button", { name: "More Filters" }).click();

    // Verify date pickers are now visible
    // Expand filters if hidden (desktop usually shows them)
    // The previous implementation added two distinct pickers

    // Verify date pickers are now visible
    await expect(page.getByTestId("filter-created")).toBeVisible();
    await expect(page.getByTestId("filter-modified")).toBeVisible();

    // Verify clicking opens the calendar popover
    await page.getByTestId("filter-created").click();
    await expect(
      page.getByRole("dialog").or(page.locator('[role="dialog"]')).first()
    ).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");

    // Verify the "Modified Range" picker also works
    await page.getByTestId("filter-modified").click();
    await expect(
      page.getByRole("dialog").or(page.locator('[role="dialog"]')).first()
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("should persist filters when navigating to issue detail and back", async ({
    page,
  }, testInfo) => {
    // 1. Go to issues and apply a severity filter
    await page.goto("/issues");
    await page.getByTestId("filter-severity").click();
    await page.getByRole("option", { name: "Major" }).click();
    await page.keyboard.press("Escape");

    // Wait for URL to update with filter
    await page.waitForURL(/severity=major/);

    // 2. Click on an issue title link to navigate to detail page
    const issueLink = page.getByRole("link", {
      name: seededIssues.TAF[0].title,
    });
    await issueLink.click();

    // Wait for navigation to issue detail
    await expect(page).toHaveURL(/\/m\/[A-Z]+\/i\/\d+/);

    // 3. Return to the filtered issue list
    if (testInfo.project.name.includes("Mobile")) {
      await page.goBack();
    } else {
      await page.getByRole("link", { name: "Back to Issues" }).click();
    }
    await expect(page).toHaveURL(/severity=major/);

    // Verify filter badge is still visible
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "Major" })
    ).toBeVisible();
  });

  test("should persist filters when using AppHeader Issues link", async ({
    page,
  }, testInfo) => {
    // 1. Go to issues and apply a search filter
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill("Thing");
    await page.keyboard.press("Enter");
    await page.waitForURL(/q=Thing/);

    // 2. Navigate to a different page (dashboard)
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");

    // 3. Navigate to Issues - should preserve filters via cookie
    // Desktop: click AppHeader Issues link (which reads issuesPath cookie)
    // Mobile: navigate directly since AppHeader hides nav links on mobile
    const isMobile = testInfo.project.name.includes("Mobile");
    if (isMobile) {
      await page.goto("/issues?q=Thing");
    } else {
      await page.getByRole("link", { name: "Issues", exact: true }).click();
    }
    await expect(page).toHaveURL(/q=Thing/);

    // Verify search term is still in the input
    await expect(page.getByPlaceholder("Search issues...")).toHaveValue(
      "Thing"
    );
  });

  test("should persist filters across page reload", async ({ page }) => {
    // 1. Go to issues and apply multiple filters
    await page.goto("/issues");

    // Apply severity filter
    await page.getByTestId("filter-severity").click();
    await page.getByRole("option", { name: "Major" }).click();
    await page.keyboard.press("Escape");
    await page.waitForURL(/severity=major/);

    // Apply search
    await page.getByPlaceholder("Search issues...").fill("bird");
    await page.keyboard.press("Enter");
    await page.waitForURL(/q=bird/);

    // 2. Reload the page
    await page.reload();

    // 3. Verify filters are restored from URL (URL params are the source of truth)
    await expect(page).toHaveURL(/severity=major/);
    await expect(page).toHaveURL(/q=bird/);

    // Verify UI reflects the filters
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "Major" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search issues...")).toHaveValue("bird");
  });
});
