import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("quick report page", () => {
  test("renders the grid for a technician", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.technician.email,
      password: TEST_USERS.technician.password,
    });
    await page.goto("/report/quick");
    await expect(
      page.getByRole("heading", { name: /quick report/i })
    ).toBeVisible();
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });

  test("renders the grid for a member", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report/quick");
    await expect(
      page.getByRole("heading", { name: /quick report/i })
    ).toBeVisible();
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });

  test("redirects a guest to the single report page", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await page.goto("/report/quick");
    await expect(page).toHaveURL(/\/report$/);
  });

  test("is linked from the single report page for a member", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report");
    await page.getByRole("link", { name: /quick report/i }).click();
    await expect(page).toHaveURL(/\/report\/quick$/);
  });
});
