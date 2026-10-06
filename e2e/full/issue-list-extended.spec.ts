import { test, expect, type Locator } from "../support/fixtures.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import {
  TEST_USERS,
  seededIssue,
  seededMachines,
} from "../support/constants.js";
import { fillReportForm } from "../support/page-helpers.js";
import { getTestIssueTitle } from "../support/test-isolation.js";
import { STORAGE_STATE } from "../support/auth-state.js";

test.describe("Issue List Features - Extended", () => {
  // Use Admin to ensure permissions for all inline edits
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

  test("should inline-edit issues", async ({ page }) => {
    // Priority and assignee are menus on every row at every width: a pill on
    // line 1 and an avatar beside line 2 (phones) or in the right column.

    // Create a unique test issue to avoid parallel worker conflicts
    const issueTitle = getTestIssueTitle("Inline Edit Test");
    createdIssueTitlePrefix = issueTitle;
    const machineInitials = seededMachines.addamsFamily.initials;

    await page.goto(`/report/detailed?machine=${machineInitials}`);
    await fillReportForm(page, { title: issueTitle, priority: "low" });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);

    // Navigate to issues list and search for our unique issue
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 15000 })
      .toBe(issueTitle);
    await expect(page.getByText("Showing 1 of 1 issues")).toBeVisible();

    const issueRow = (): Locator =>
      page
        .getByRole("list", { name: "Issues" })
        .getByRole("listitem")
        .filter({ has: page.getByRole("link", { name: issueTitle }) });
    const row = issueRow();
    await expect(row).toBeVisible();

    // 1. Test Priority Inline Edit (Low -> High)
    await row.getByRole("button", { name: "Priority: Low, change" }).click();
    await page.getByRole("menuitemradio", { name: "High" }).click();

    // Verify optimistic update
    await expect(
      row.getByRole("button", { name: "Priority: High, change" })
    ).toBeVisible();

    // Verify persistence after reload
    await page.reload();
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 15000 })
      .toBe(issueTitle);

    const rowAfterReload = issueRow();
    await expect(
      rowAfterReload.getByRole("button", { name: "Priority: High, change" })
    ).toBeVisible();

    // 2. Test Assignee Inline Edit (Unassigned -> Admin)
    await rowAfterReload
      .getByRole("button", { name: "Unassigned, change assignee" })
      .click();
    await page
      .getByRole("menuitemradio", { name: TEST_USERS.admin.name })
      .click();

    // Verify assignee update
    await expect(page.getByText("Assignee updated")).toBeVisible();
    await expect(
      rowAfterReload.getByRole("button", {
        name: `Assigned to ${TEST_USERS.admin.name}, change assignee`,
      })
    ).toBeVisible();
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
          const showing = await page
            .getByText(/^Showing \d+ of \d+ issues$/)
            .textContent();
          return showing?.endsWith(` of ${count} issues`) ?? false;
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
    await page.getByTestId("filter-severity").click();
    await page.getByRole("option", { name: "Major" }).click();
    await page.keyboard.press("Escape");

    // Wait for URL to update with filter
    await page.waitForURL(/severity=major/);

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
});
