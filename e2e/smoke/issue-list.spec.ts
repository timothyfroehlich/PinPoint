import { test, expect } from "@playwright/test";
import { assertNoHorizontalOverflow } from "../support/actions";
import { seededIssues } from "../support/constants";
import { STORAGE_STATE } from "../support/auth-state";

test.describe("Issue List Features", () => {
  // Use Admin to ensure permissions for all operations
  test.use({ storageState: STORAGE_STATE.admin });

  test.beforeEach(() => {
    test.setTimeout(120000);
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
    const searchInput = page.getByPlaceholder("Search issues...");
    await searchInput.focus();
    await searchInput.fill("Thing flips the bird");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 60000 })
      .toBe("Thing flips the bird");
    await expect(page.getByText("Showing 1 of 1 issues")).toBeVisible();
    await expect(page.getByRole("row", { name: title1 })).toBeVisible();
    await expect(page.getByRole("row", { name: title2 })).toBeHidden();

    // Clear Search (Wait for search badge or clear button to be stable)
    const clearProps = page.getByRole("button", { name: "Clear", exact: true });
    await expect(clearProps).toBeVisible();
    await clearProps.click();
    await expect
      .poll(
        () => {
          const query = new URL(page.url()).searchParams.get("q");
          return query === null || query === "";
        },
        { timeout: 60000 }
      )
      .toBe(true);
    await expect(page.getByText(/Showing \d+ of \d+ issues/)).toBeVisible();
    await expect(page.getByText("Showing 1 of 1 issues")).toHaveCount(0);

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

    // Verify no horizontal overflow on issues list page
    await assertNoHorizontalOverflow(page);
  });

  test("should handle status group toggling in filters", async ({ page }) => {
    await page.goto("/issues");

    // Verify badges ARE visible by default (Open statuses)
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "Open" })
    ).toBeVisible();

    // Open Status Filter
    await page.getByTestId("filter-status").click();

    // The MultiSelect value defaults to all OPEN_STATUSES.
    // Clicking "Open" group header will DESELECT "new" and "confirmed".
    const newGroupHeader = page.getByTestId("filter-status-group-open");
    await expect(newGroupHeader).toBeVisible();
    await newGroupHeader.click();

    // Close the popover
    await page.keyboard.press("Escape");
    await page.waitForURL((url) => url.searchParams.has("status"));
    // After deselecting "Open" group (new, confirmed), we should only see
    // in_progress group issues: in_progress (3), need_parts (1), wait_owner (1) = 5 total
    await expect(page.getByText(/Showing \d+ of \d+ issues/)).toBeVisible();

    // Verify "Open" badge is hidden (deselected)
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
        .filter({ hasText: "Open" })
    ).toBeHidden();

    // Click again to re-select
    await page.getByTestId("filter-status").click();
    await newGroupHeader.click();
    await page.keyboard.press("Escape");

    // Verify "Open" badge is back
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "Open" })
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
        .filter({ hasText: "Open" })
    ).toBeHidden();
    await expect(
      page
        .getByTestId("filter-bar")
        .locator('[data-slot="badge"]')
        .filter({ hasText: "In Progress" })
    ).toBeHidden();
  });

  test('should show and activate "My machines" quick-select in Machine filter', async ({
    page,
  }) => {
    // Admin user owns: BK (Black Knight), GDZ (Godzilla), HD (Humpty Dumpty), MM (Medieval Madness)
    // Clicking "My machines" should filter to those four machines (sorted alphabetically by initials)
    await page.goto("/issues");

    // Open the Machine filter dropdown
    await page.getByTestId("filter-machine").click();

    // Verify "My machines" quick-select toggle is visible
    await expect(page.getByText("My machines")).toBeVisible();

    // Click "My machines" to select all owned machines
    await page.getByText("My machines").click();
    await page.keyboard.press("Escape");

    // URL should contain the admin's owned machine initials
    await page.waitForURL(/machine=/);
    const url = new URL(page.url());
    const machineParam = url.searchParams.get("machine") ?? "";
    expect(machineParam).toContain("BK");
    expect(machineParam).toContain("GDZ");
    expect(machineParam).toContain("HD");
    expect(machineParam).toContain("MM");
  });

  test("should export issues to CSV", async ({ page }) => {
    await page.goto("/issues");

    // Wait for issue list to load
    await expect(page.getByText(/Showing \d+ of \d+ issues/)).toBeVisible();

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent("download");

    // Click the export button
    await page.getByTestId("export-csv-button").click();

    // Verify download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^pinpoint-issues-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });
});
