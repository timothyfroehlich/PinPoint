import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";

test.describe("Admin Help Page", () => {
  test("admin can navigate to admin help page from help page", async ({
    page,
  }, testInfo) => {
    // Login as admin
    await loginAs(page, testInfo, {
      email: "admin@test.com",
      password: "TestPassword123",
    });

    await page.goto("/help");

    // Click the Admin Help link
    await page.getByRole("link", { name: "Admin Help" }).click();

    // Should navigate to admin help page
    await expect(page).toHaveURL("/help/admin", { timeout: 10000 });

    // Verify admin help content renders
    await expect(
      page.getByRole("heading", { name: "Admin Help" })
    ).toBeVisible();
    await expect(page.getByText("Username-Only Accounts")).toBeVisible();
  });

  test("non-admin does not see admin help link", async ({ page }, testInfo) => {
    // Login as regular member
    await loginAs(page, testInfo);

    await page.goto("/help");

    // Should NOT see the Admin Help link
    await expect(
      page.getByRole("link", { name: "Admin Help" })
    ).not.toBeVisible();
  });
});
