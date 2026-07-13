import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("bulk report page", () => {
  test("renders the grid for a technician", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.technician.email,
      password: TEST_USERS.technician.password,
    });
    await page.goto("/report/bulk");
    await expect(
      page.getByRole("heading", { name: /bulk report/i })
    ).toBeVisible();
    await expect(page.getByTestId("bulk-report-grid")).toBeVisible();
  });

  test("forbids a member", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report/bulk");
    await expect(
      page.getByText(/don.t have permission|forbidden/i)
    ).toBeVisible();
  });

  test("is linked from the single report page for a technician", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.technician.email,
      password: TEST_USERS.technician.password,
    });
    await page.goto("/report");
    await page.getByRole("link", { name: /bulk report/i }).click();
    await expect(page).toHaveURL(/\/report\/bulk$/);
  });
});
