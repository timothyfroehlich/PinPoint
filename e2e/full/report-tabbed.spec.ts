import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS, seededMachines } from "../support/constants.js";

/**
 * Tabbed report page (PP-idrb) — the browser journeys jsdom can't cover: the
 * Single ↔ Multiple tab navigation preserving entry #1, the "2+ rows disables
 * Single" lock, and deep-linking straight to the Multiple tab.
 */

const afm = seededMachines.attackFromMars;

test.describe("tabbed report page", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
  });

  test("entry #1 typed on the Single tab appears in the grid's first row", async ({
    page,
  }) => {
    await page.goto("/report");
    await expect(page.getByTestId("report-tab-single")).toHaveAttribute(
      "aria-current",
      "page"
    );

    // Fill machine + title on the detailed Single form.
    await page.getByRole("combobox", { name: "Select Machine" }).click();
    await page.getByTestId(`machine-option-${afm.id}`).click();
    await page.getByLabel("Issue Title *").fill("Synced from single");

    // Switch to Multiple — the shared draft survives the sibling-route nav.
    await page.getByTestId("report-tab-multiple").click();
    await expect(page).toHaveURL(/\/report\/quick$/);

    const firstRow = page.getByTestId("quick-row").first();
    await expect(
      firstRow.getByRole("textbox", { name: /Problem/ })
    ).toHaveValue("Synced from single");
    // The machine synced too — its picker shows the selected machine.
    await expect(
      firstRow.getByRole("combobox", { name: "Machine" })
    ).toContainText(afm.initials);
  });

  test("2+ content rows disable the Single tab; removing one re-enables it", async ({
    page,
  }) => {
    await page.goto("/report/quick");

    const firstRow = page.getByTestId("quick-row").first();
    await firstRow.getByRole("combobox", { name: "Machine" }).click();
    await page.getByTestId(`machine-option-${afm.id}`).click();
    await firstRow.getByRole("textbox", { name: /Problem/ }).fill("Row one");

    await page.getByRole("button", { name: /add issue/i }).click();
    const secondRow = page.getByTestId("quick-row").nth(1);
    await secondRow.getByRole("combobox", { name: "Machine" }).click();
    await page.getByTestId(`machine-option-${afm.id}`).click();
    await secondRow.getByRole("textbox", { name: /Problem/ }).fill("Row two");

    // Single is now a disabled control; tapping it reveals the reason instead of
    // navigating.
    const singleTab = page.getByTestId("report-tab-single");
    await expect(singleTab).toHaveAttribute("aria-disabled", "true");
    // The tab is aria-disabled (advisory) but not natively disabled — real users
    // can still tap it to reveal the reason. Playwright's actionability refuses
    // aria-disabled targets, so force the click to exercise that tap-to-explain path.
    await singleTab.click({ force: true });
    await expect(
      page.getByText(/remove the extras to go back to a single report/i)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/report\/quick$/);

    // Discard the second row (has content → confirm) → Single re-enables.
    await secondRow.getByRole("button", { name: /discard/i }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Discard" })
      .click();
    await expect(
      page.getByRole("link", { name: /single issue/i })
    ).toBeVisible();
  });

  test("deep-linking /report/quick opens on the Multiple tab", async ({
    page,
  }) => {
    await page.goto("/report/quick");
    await expect(page.getByTestId("report-tab-multiple")).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });
});
