import { test, expect, type Page } from "../support/fixtures.js";
import {
  assertNoHorizontalOverflow,
  assertNoA11yViolations,
  setListFilterOptions,
} from "../support/actions.js";
import { seededIssue } from "../support/constants.js";
import { STORAGE_STATE } from "../support/auth-state.js";

/** The List View's announced result count (list-views §12.4). */
function resultCount(page: Page) {
  return page.getByRole("status").filter({ hasText: /^(Showing|No) / });
}

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
    // Wait for hydration before interacting with the search field: Enter
    // before React binds its handler submits nothing. Best-effort with a
    // timeout to handle Chromium HMR keeping the network busy in dev.
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => undefined);

    await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
    await assertNoA11yViolations(page);

    // 2. Search for Issue 1
    const searchInput = page.getByRole("searchbox", { name: "Search issues" });
    await searchInput.fill("Thing flips the bird");
    await searchInput.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 60000 })
      .toBe("Thing flips the bird");
    await expect(resultCount(page)).toHaveText("Showing 1 to 1 of 1 issue");
    const issues = page.getByRole("list", { name: "Issues" });
    await expect(issues.getByRole("link", { name: title1 })).toBeVisible();
    await expect(issues.getByRole("link", { name: title2 })).toBeHidden();

    // Clear the search
    await searchInput.fill("");
    await searchInput.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 60000 })
      .toBeNull();
    await expect(resultCount(page)).toHaveText(
      /^Showing 1 to \d+ of \d+ issues$/
    );

    // 3. Filter by Severity: Major (TAF-01 and TAF-02 are both Major)
    await setListFilterOptions(page, "Severity", ["Major"]);
    await expect(page).toHaveURL(/[?&]severity=major(?:&|$)/);
    await expect(issues.getByRole("link", { name: title1 })).toBeVisible();
    await expect(issues.getByRole("link", { name: title2 })).toBeVisible();
    // Every row left is Major.
    await expect(
      issues.getByRole("button", { name: /^Severity: (?!Major,)/ })
    ).toHaveCount(0);

    // Clear the Severity filter
    await setListFilterOptions(page, "Severity", ["Major"], {
      checked: false,
    });
    await expect(page).not.toHaveURL(/[?&]severity=/);

    // Verify no horizontal overflow on issues list page
    await assertNoHorizontalOverflow(page);
  });

  test('should show and activate "My machines" quick-select in Machine filter', async ({
    page,
  }) => {
    // Admin user owns: BK (Black Knight), GDZ (Godzilla), GDZ3 (Godzilla), HD (Humpty Dumpty), MM (Medieval Madness)
    // "My machines" selects all owned machines.
    await page.goto("/issues");

    await setListFilterOptions(page, "Machine", ["My machines"]);

    // URL should contain the admin's owned machine initials
    await page.waitForURL(/[?&]machine=/);
    const machineParam =
      new URL(page.url()).searchParams.get("machine")?.split(",") ?? [];
    expect(machineParam).toEqual(
      expect.arrayContaining(["BK", "GDZ", "HD", "MM"])
    );
  });

  test("an out-of-range page shows the last page", async ({ page }) => {
    // A page past the end shows the last page (list-views §6.3), rather
    // than an empty list with no way back.
    await page.goto("/issues?page=999");

    await expect(
      page.getByRole("list", { name: "Issues" }).getByRole("listitem").first()
    ).toBeVisible();
    // The last page ends at the total.
    await expect
      .poll(async () => {
        const text = (await resultCount(page).textContent()) ?? "";
        const match = /^Showing \d+ to (\d+) of (\d+) issues?$/.exec(text);
        return match !== null && match[1] === match[2];
      })
      .toBe(true);
    // The URL names the page shown, never the out-of-range one.
    await expect
      .poll(() => new URL(page.url()).searchParams.get("page"))
      .not.toBe("999");
  });

  test("should export issues to CSV", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("Mobile"),
      "Export sits in the desktop List Header (list-views §5.5); the phone header has none (§7.3)"
    );
    await page.goto("/issues");

    // Wait for issue list to load
    await expect(resultCount(page)).toHaveText(/^Showing \d+ to \d+ of \d+ /);

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent("download");

    await page.getByRole("button", { name: "Export to CSV" }).click();

    // Verify download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^pinpoint-issues-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });
});
