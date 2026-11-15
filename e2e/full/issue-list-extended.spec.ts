import { test, expect, type Locator, type Page } from "../support/fixtures.js";
import { setListFilterOptions } from "../support/actions.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import { seededIssue, seededMachines } from "../support/constants.js";
import { fillReportForm } from "../support/page-helpers.js";
import { getTestIssueTitle } from "../support/test-isolation.js";
import { STORAGE_STATE } from "../support/auth-state.js";

function searchField(page: Page): Locator {
  return page.getByRole("searchbox", { name: "Search issues" });
}

/** The List View's announced result count (list-views §12.4). */
function resultCount(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /^(Showing|No) / });
}

test.describe("Issue List Features - Extended", () => {
  // Admin holds every permission, so read-only rows prove no role can edit
  test.use({ storageState: STORAGE_STATE.admin });

  // Track issue title prefix for cleanup across tests that create issues
  let createdIssueTitlePrefix: string | undefined;

  test.beforeEach(() => {
    test.setTimeout(60000);
    createdIssueTitlePrefix = undefined;
  });

  test.afterEach(async () => {
    if (createdIssueTitlePrefix) {
      await cleanupTestEntities({
        issueTitlePrefix: createdIssueTitlePrefix,
      });
    }
  });

  test("rows are read-only links to the issue and its machine", async ({
    page,
  }) => {
    // Rows never change an issue (issues-list §3.11), even for an admin. The
    // whole row links to the issue, and the machine name to the machine
    // (§3.12).

    // Create a unique test issue to avoid parallel worker conflicts
    const issueTitle = getTestIssueTitle("Read-only Row Test");
    createdIssueTitlePrefix = issueTitle;
    const machine = seededMachines.addamsFamily;

    await page.goto(`/report/detailed?machine=${machine.initials}`);
    await fillReportForm(page, { title: issueTitle, priority: "low" });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
    const issuePath = new URL(page.url()).pathname;

    // Navigate to issues list and search for our unique issue
    await page.goto("/issues");
    await searchField(page).fill(issueTitle);
    await searchField(page).press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 15000 })
      .toBe(issueTitle);
    await expect(resultCount(page)).toHaveText("Showing 1 to 1 of 1 issue");

    const row = page
      .getByRole("list", { name: "Issues" })
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: issueTitle }) });
    await expect(row).toBeVisible();

    // No edit controls: the values are read-only text, and the only
    // interactive elements are the issue link and the machine link.
    await expect(row.getByRole("button")).toHaveCount(0);
    await expect(row.getByRole("combobox")).toHaveCount(0);
    await expect(row.getByRole("link")).toHaveCount(2);
    await expect(row.getByTestId("issue-priority")).toHaveText("Priority: Low");
    await expect(row.getByRole("img", { name: "Unassigned" })).toBeAttached();

    // The machine name opens the machine, not the issue.
    await row.getByRole("link", { name: machine.name }).click();
    await expect(page).toHaveURL(new RegExp(`/m/${machine.initials}$`));
    await page.goBack();
    await expect(row).toBeVisible();

    // A click anywhere on the row, away from the title, opens the issue: the
    // row's top-left corner is padding the title link's overlay covers.
    await row.click({ position: { x: 4, y: 4 } });
    await expect(page).toHaveURL(new RegExp(`${issuePath}$`));
  });

  test("a Severity Segment filters the list to its issues", async ({
    page,
  }) => {
    await page.goto("/issues");
    // Below 390px the stacked widgets start collapsed (widgets §2.4), so the
    // Mobile Safari project (375px) opens the section first.
    if ((page.viewportSize()?.width ?? 0) < 390) {
      const summary = page.getByRole("button", { name: /^Summary: / });
      // aria-expanded is set only once hydrated, so the click is not lost.
      await expect(summary).toHaveAttribute("aria-expanded", "false");
      await summary.click();
    }
    const severity = page.getByRole("region", { name: "Severity" });
    await expect(severity).toBeVisible();

    // Zero-count Segments are left out of the breakdown (widgets §5.5) and
    // pairs that do not fit roll into "N other" from the end (§5.6), so the
    // first pair on the line is a selectable Segment.
    const levelPattern = "(Unplayable|Major|Minor|Cosmetic)";
    const first = severity
      .getByRole("button", { name: new RegExp(`^\\d+ ${levelPattern}$`) })
      .first();
    await expect(first).toBeVisible();
    const label = ((await first.getAttribute("aria-label")) ?? "").replace(
      /^\d+ /,
      ""
    );
    const segment = severity.getByRole("button", {
      name: new RegExp(`^\\d+ ${label}$`),
    });
    await segment.click();

    await expect(page).toHaveURL(
      new RegExp(`[?&]severity=${label.toLowerCase()}(?:&|$)`)
    );
    await expect(segment).toHaveAttribute("aria-pressed", "true");
    // The widgets count open issues on On the Floor machines (issue-widgets
    // §2.2, §4.2), the list's default view, so the selected Segment's count
    // equals the filtered total. Poll both together, so a render that lands
    // between the reads (another worker's new issue) cannot split them.
    await expect
      .poll(
        async () => {
          const count = Number.parseInt(
            (await segment.getAttribute("aria-label")) ?? "",
            10
          );
          const showing = await resultCount(page).textContent();
          const noun = count === 1 ? "issue" : "issues";
          return showing?.endsWith(` of ${count} ${noun}`) ?? false;
        },
        { message: "the selected Segment's count equals the filtered total" }
      )
      .toBe(true);
  });

  test("should persist filters when navigating to issue detail and back", async ({
    page,
  }) => {
    // 1. Go to issues and apply a severity filter
    await page.goto("/issues");
    await setListFilterOptions(page, "Severity", ["Major"]);

    // Wait for URL to update with filter
    await page.waitForURL(/[?&]severity=major(?:&|$)/);

    // 2. Click on an issue title link to navigate to detail page
    const issueLink = page.getByRole("link", {
      name: seededIssue("TAF").title,
    });
    await issueLink.click();

    // Wait for navigation to issue detail
    await expect(page).toHaveURL(/\/m\/[A-Z]+\/i\/\d+/);

    // 3. Return to the filtered issue list. The issue detail page has no back
    // link of its own; AppHeader path persistence is covered by the Issues
    // link test below.
    await page.goBack();
    await expect(page).toHaveURL(/[?&]severity=major(?:&|$)/);

    // The list is still filtered: every row is Major.
    const issues = page.getByRole("list", { name: "Issues" });
    await expect(
      issues.getByRole("link", { name: seededIssue("TAF").title })
    ).toBeVisible();
    await expect(
      issues.getByTestId("issue-severity").filter({ hasNotText: "Major" })
    ).toHaveCount(0);
  });

  test("should return to the filtered list from the app's Issues link", async ({
    page,
  }) => {
    // 1. Go to issues and apply a search filter
    await page.goto("/issues");
    await searchField(page).fill("Thing");
    await searchField(page).press("Enter");
    await page.waitForURL(/[?&]q=Thing(?:&|$)/);

    // 2. Navigate to a different page in the same tab (dashboard)
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");

    // 3. The Issues link returns to the list this tab last showed
    // (list-views §11.1): the header link on desktop, the tab bar on phones.
    const issuesLink = page
      .getByRole("link", { name: "Issues", exact: true })
      .filter({ visible: true })
      .first();
    await expect(issuesLink).toHaveAttribute("href", /[?&]q=Thing(?:&|$)/);
    await issuesLink.click();
    await expect(page).toHaveURL(/[?&]q=Thing(?:&|$)/);

    // Verify search term is still in the input
    await expect(searchField(page)).toHaveValue("Thing");
  });
});
