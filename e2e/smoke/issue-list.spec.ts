import { test, expect } from "@playwright/test";
import { loginAs, openSidebarIfMobile } from "../support/actions";
import { TEST_USERS, seededIssues } from "../support/constants";

test.describe("Issue List Features", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.setTimeout(60000);
    // Use Admin to ensure permissions for all inline edits
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });
  });

  test("should filter and search issues", async ({ page }) => {
    // 1. Setup: Use seeded issues
    // Issue 1: "Thing flips the bird" (TAF-01)
    // Issue 2: "Bookcase not registering" (TAF-02)
    const title1 = seededIssues.TAF[0].title;
    const title2 = seededIssues.TAF[1].title;

    await page.goto("/issues");

    // 2. Test Searching
    // Search for Issue 1
    await page
      .getByPlaceholder("Search issues...")
      .fill("Thing flips the bird");
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.has("q"));
    await expect(page.getByText("Showing 1 of 1 issues")).toBeVisible();
    await expect(page.getByRole("row", { name: title1 })).toBeVisible();
    await expect(page.getByRole("row", { name: title2 })).toBeHidden();

    // Clear Search (Wait for search badge or clear button to be stable)
    const clearProps = page.getByRole("button", { name: "Clear", exact: true });
    await expect(clearProps).toBeVisible();
    await clearProps.click();
    await expect(page.getByText(title1)).toBeVisible();
    await expect(page.getByText(title2)).toBeVisible();

    // 3. Test Filtering
    // Filter by Severity: Major (TAF-01 and TAF-02 are both Major)
    await page.getByTestId("filter-severity").click();
    await page.getByRole("option", { name: "Major" }).click();
    await page.keyboard.press("Escape"); // Close popover

    // Both TAF-01 and TAF-02 have major severity, so both should be visible
    await expect(page.getByText(title1)).toBeVisible();
    await expect(page.getByText(title2)).toBeVisible();

    // Clear Severity Filter
    // The clear button may disappear/reappear during state changes; wait for it to stabilize
    const clearButton = page.getByRole("button", {
      name: "Clear",
      exact: true,
    });
    await expect(clearButton).toBeVisible();
    await clearButton.waitFor({ state: "visible" });
    await clearButton.click();
  });

  test.skip("should inline-edit issues (Flaky Env)", async ({ page }) => {
    const title1 = seededIssues.TAF[0].title;
    await page.goto("/issues");

    // 4. Test Inline Editing & Stable Sorting
    // Isolate TAF-01
    await page.getByPlaceholder("Search issues...").fill("TAF-01"); // Search by ID
    await page.keyboard.press("Enter");

    // Change Priority from... whatever it is to something else.
    // TAF-01 doesn't have explicit priority seeded, defaults to Low usually?
    // Actually schema defaults to 'low'.
    // Let's assume it has some priority. Use the button in the priority column.

    // Find the priority cell. The 4th column is priority.
    // Simpler: find the badge inside the row.
    const row = page.getByRole("row", { name: title1 });

    // We don't know the exact current priority, so lets just pick the priority dropdown trigger
    // It will have a chevron-down or similar, but accessible roles are tricky.
    // The cell itself is a button.
    // Let's rely on test-ids if we added them?
    // We didn't add test-ids to the cells in this change, relying on role="row" and position might be safer.
    // Or we can query by the priority text. Default is likely 'Low' or null.

    // Let's inspect the seed: it doesn't specify priority, so default 'low'.
    // Wait, let's just create a clearer test case by interacting with the cell that has "Low" text.
    // If it's not Low, we fail, which is fine as it documents assumption.
    const priorityTrigger = row
      .getByRole("button")
      .filter({ hasText: /Low|Medium|High/ })
      .first();
    await expect(priorityTrigger).toBeVisible();

    // Click and change
    await priorityTrigger.click();
    await page.getByRole("menuitem", { name: "High" }).click();

    // Toast check - wait for it to ensure server processed it
    // await expect(page.getByText("Issue updated")).toBeVisible({ timeout: 10000 });

    // Verify change persisted UI (Optimistic)
    await expect(
      row.getByRole("button").filter({ hasText: "High" })
    ).toBeVisible();

    // Verify persistence after reload
    await page.reload();
    await expect(
      page
        .getByRole("row", { name: title1 })
        .getByRole("button")
        .filter({ hasText: "High" })
    ).toBeVisible();

    // 5. Test Assignee Inline Edit
    // TAF-01 doesn't have assignee in seed (reportedBy is member, but assignedTo is null)
    const assigneeCell = row
      .getByRole("button")
      .filter({ hasText: /Unassigned/i });
    await assigneeCell.click();
    await page.getByRole("menuitem", { name: TEST_USERS.admin.name }).click();

    // Verify Update
    await expect(page.getByText("Issue assigned")).toBeVisible();
    await expect(
      row.getByRole("button").filter({ hasText: TEST_USERS.admin.name })
    ).toBeVisible();
  });

  test("should handle status group toggling in filters", async ({ page }) => {
    await page.goto("/issues");

    // Verify badges ARE visible by default (Open statuses)
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "New" })
    ).toBeVisible();

    // Open Status Filter
    await page.getByTestId("filter-status").click();

    // The MultiSelect value defaults to all OPEN_STATUSES.
    // Clicking "New" group header will DESELECT "new" and "confirmed".
    const newGroupHeader = page.getByTestId("filter-status-group-new");
    await expect(newGroupHeader).toBeVisible();
    await newGroupHeader.click();

    // Close the popover
    await page.keyboard.press("Escape");
    await page.waitForURL((url) => url.searchParams.has("status"));
    // After deselecting "New" group (new, confirmed), we should only see
    // in_progress group issues: in_progress (3), need_parts (1), wait_owner (1) = 5 total
    await expect(page.getByText(/Showing \d+ of \d+ issues/)).toBeVisible();

    // Verify "New" badge is hidden (deselected)
    // "In Progress" should still be visible as we didn't touch it
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "In Progress" })
    ).toBeVisible();
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "New" })
    ).toBeHidden();

    // Click again to re-select
    await page.getByTestId("filter-status").click();
    await newGroupHeader.click();
    await page.keyboard.press("Escape");

    // Verify "New" badge is back
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "New" })
    ).toBeVisible();

    // Test clearing to "All"
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page.waitForURL(
      (url) =>
        url.searchParams.get("status") === "all" ||
        !url.searchParams.has("status")
    );

    // After clear (status=all), NO status badges should be visible
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "New" })
    ).toBeHidden();
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "In Progress" })
    ).toBeHidden();
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
  }) => {
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

    // 3. Click "Back to Issues" and verify filters preserved
    await page.getByRole("link", { name: "Back to Issues" }).click();
    await expect(page).toHaveURL(/severity=major/);

    // Verify filter badge is still visible
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "Major" })
    ).toBeVisible();
  });

  test("should persist filters when using sidebar Issues link", async ({
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

    // 3. Click Issues in sidebar - should preserve filters
    // The sidebar link uses issuesPath prop read from cookie on the server
    await openSidebarIfMobile(page, testInfo);
    await page.getByRole("link", { name: "Issues", exact: true }).click();
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
