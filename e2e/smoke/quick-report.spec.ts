import { test, expect } from "../support/fixtures.js";
import { loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("report modes", () => {
  test("renders Multiple issues for a technician", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.technician.email,
      password: TEST_USERS.technician.password,
    });
    await page.goto("/report/multiple");
    await expect(
      page.getByRole("heading", { name: /report an issue/i })
    ).toBeVisible();
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Detailed report" })
    ).toBeVisible();
  });

  test("renders Multiple issues for a member", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report/multiple");
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });

  test("redirects a guest away from Multiple issues to Quick report", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await page.goto("/report/multiple");
    await expect(page).toHaveURL(/\/report$/);
    await expect(page.getByRole("textbox", { name: "Problem" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report multiple issues" })
    ).toHaveCount(0);
  });

  test("Quick report offers Multiple issues to a member", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report");
    await page.getByRole("link", { name: "Report multiple issues" }).click();
    await expect(page).toHaveURL(/\/report\/multiple$/);
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });
});
