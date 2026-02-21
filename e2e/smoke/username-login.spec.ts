import { test, expect } from "@playwright/test";

test.describe("Username Account Login", () => {
  test("login with username (no @) redirects to dashboard", async ({
    page,
  }, testInfo) => {
    await page.goto("/login");

    // Type just the username, not the email
    await page.getByLabel("Email").fill("testuser");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Verify we're logged in
    const isMobile = testInfo.project.name.includes("Mobile");
    if (isMobile) {
      await expect(page.getByTestId("mobile-menu-trigger")).toBeVisible();
    } else {
      await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
    }
  });
});
