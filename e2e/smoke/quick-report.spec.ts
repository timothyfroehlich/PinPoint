import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("quick report (Multiple tab)", () => {
  test("renders the grid on the Multiple tab for a technician", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.technician.email,
      password: TEST_USERS.technician.password,
    });
    await page.goto("/report/quick");
    await expect(
      page.getByRole("heading", { name: /report an issue/i })
    ).toBeVisible();
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
    // The Multiple tab is the active one on /report/quick.
    await expect(page.getByTestId("report-tab-multiple")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("renders the grid on the Multiple tab for a member", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report/quick");
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
    await expect(page.getByTestId("report-tab-multiple")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("redirects a guest away from the Multiple tab to the single report", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await page.goto("/report/quick");
    await expect(page).toHaveURL(/\/report$/);
    // Guests get the single form only — no tab chrome.
    await expect(page.getByTestId("report-tab-multiple")).toHaveCount(0);
  });

  test("the Multiple tab links from the single report page for a member", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report");
    await expect(page.getByTestId("report-tab-single")).toHaveAttribute(
      "aria-current",
      "page"
    );
    await page.getByTestId("report-tab-multiple").click();
    await expect(page).toHaveURL(/\/report\/quick$/);
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });
});
