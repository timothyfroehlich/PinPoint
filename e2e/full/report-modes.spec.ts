import { test, expect } from "../support/fixtures.js";
import { loginAs } from "../support/actions.js";
import { TEST_USERS, seededMachines } from "../support/constants.js";
import { getTestIssueTitle } from "../support/test-isolation.js";

const afm = seededMachines.attackFromMars;

test.describe("report mode handoffs", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
  });

  test("Quick report creates one issue from the short form", async ({
    page,
  }) => {
    const title = getTestIssueTitle("Quick report issue");
    await page.goto(`/report?machine=${afm.initials}`);
    await expect(
      page.getByRole("combobox", { name: "Machine" }).first()
    ).toContainText(afm.initials);
    await page.getByRole("textbox", { name: "Problem" }).fill(title);
    await page.getByRole("button", { name: "Report issue" }).click();

    await expect(page).toHaveURL(new RegExp(`/m/${afm.initials}/i/\\d+$`));
    await expect(
      page.getByRole("heading", { level: 1, name: title })
    ).toBeVisible();
  });

  test("Quick draft carries machine, problem, and frequency through Detailed and Multiple", async ({
    page,
  }) => {
    await page.goto("/report");
    await page.getByRole("combobox", { name: "Machine" }).first().click();
    await page.getByTestId(`machine-option-${afm.id}`).click();
    await page
      .getByRole("textbox", { name: "Problem" })
      .fill("Handoff test problem");
    await page.getByText("Frequent", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Frequent" })).toBeChecked();

    await page.getByRole("link", { name: "Add details" }).click();
    await expect(page).toHaveURL(/\/report\/detailed$/);
    await expect(
      page.getByRole("combobox", { name: "Select Machine" })
    ).toContainText(afm.initials);
    await expect(page.getByLabel("Issue Title *")).toHaveValue(
      "Handoff test problem"
    );
    await expect(page.getByTestId("issue-frequency-select")).toContainText(
      "Frequent"
    );

    await page.getByRole("link", { name: "Report multiple issues" }).click();
    await expect(page).toHaveURL(/\/report\/multiple$/);
    const firstRow = page.getByTestId("quick-row").first();
    await expect(
      firstRow.getByRole("textbox", { name: /Problem/ })
    ).toHaveValue("Handoff test problem");
    await expect(
      firstRow.getByRole("combobox", { name: "Machine" })
    ).toContainText(afm.initials);

    await page.getByRole("link", { name: "Detailed report" }).click();
    await expect(page.getByLabel("Issue Title *")).toHaveValue(
      "Handoff test problem"
    );
  });

  test("Multiple retains extra rows when returning to Detailed", async ({
    page,
  }) => {
    await page.goto("/report/multiple");
    const firstRow = page.getByTestId("quick-row").first();
    await firstRow.getByRole("combobox", { name: "Machine" }).click();
    await page.getByTestId(`machine-option-${afm.id}`).click();
    await firstRow
      .getByRole("textbox", { name: /Problem/ })
      .fill("First draft");

    await page.getByRole("button", { name: /add issue/i }).click();
    const secondRow = page.getByTestId("quick-row").nth(1);
    await secondRow
      .getByRole("textbox", { name: /Problem/ })
      .fill("Second draft");

    await page.getByRole("link", { name: "Detailed report" }).click();
    await expect(page).toHaveURL(/\/report\/detailed$/);
    await expect(page.getByLabel("Issue Title *")).toHaveValue("First draft");

    await page.getByRole("link", { name: "Report multiple issues" }).click();
    await expect(
      page
        .getByTestId("quick-row")
        .nth(1)
        .getByRole("textbox", { name: /Problem/ })
    ).toHaveValue("Second draft");
  });

  test("legacy Multiple URL redirects to its named route", async ({ page }) => {
    await page.goto("/report/quick");
    await expect(page).toHaveURL(/\/report\/multiple$/);
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });
});
