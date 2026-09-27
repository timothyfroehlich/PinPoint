import { test, expect } from "../support/fixtures.js";
import {
  assertNoHorizontalOverflow,
  assertNoA11yViolations,
} from "../support/actions.js";
import { seededIssue } from "../support/constants.js";
import { STORAGE_STATE } from "../support/auth-state.js";

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
    const title1 = seededIssue("TAF").title;
    const title2 = seededIssue("TAF", 1).title;

    await page.goto("/issues");
    // Wait for hydration before interacting with the search form. In Mobile
    // Safari/WebKit, pressing Enter before React has bound the onSubmit handler
    // triggers a default browser form submit (the input has no `name` attr,
    // so ?q is never set in the URL). Best-effort with timeout to handle
    // Chromium HMR keeping the network busy indefinitely in dev.
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => undefined);

    await assertNoA11yViolations(page);

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

  test("should show bottom pagination on out-of-range page", async ({
    page,
  }) => {
    // Regression test for PP-o9g: bottom pagination used issues.length > 0 instead of
    // totalCount > 0, hiding navigation controls when landing on an empty out-of-range page.
    await page.goto("/issues?page=999");

    // The page is empty (no issues on page 999), but totalCount > 0 in seeded data.
    // Both top and bottom pagination controls must be visible so the user can navigate back.
    const bottomPrevPage = page.getByTestId("bottom-prev-page");
    await expect(bottomPrevPage).toHaveCount(1);
    await expect(bottomPrevPage).toBeVisible();
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
