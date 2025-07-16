import { test, expect } from "@playwright/test";

test.describe("Dev Login Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start fresh for each test
    await page.goto("http://localhost:3001");
  });

  test("should authenticate user and show profile button after dev login", async ({
    page,
  }) => {
    // Step 1: Verify initial unauthenticated state
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();

    // Step 2: Expand dev login component
    const devLoginComponent = page
      .locator("div")
      .filter({ hasText: /^Dev Quick Login$/ });
    await expect(devLoginComponent).toBeVisible();
    await devLoginComponent.click();

    // Step 3: Verify test users are displayed
    await expect(
      page.getByRole("button", { name: "Roger Sharpe" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gary Stern" }),
    ).toBeVisible();
    await expect(page.locator("text=A")).toBeVisible(); // Admin role
    await expect(page.locator("text=M")).toBeVisible(); // Member role

    // Step 4: Monitor authentication flow
    const [authResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/auth/callback/credentials") &&
          res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Roger Sharpe" }).click(),
    ]);

    // Step 5: Verify authentication request succeeds
    expect(authResponse.status()).toBe(200);

    // Step 6: Wait for session to be established
    await page.waitForTimeout(2000);

    // Step 7: Verify successful authentication - user should see profile button
    // The "Sign In" link should be replaced with the user's name/profile button
    await expect(page.getByRole("link", { name: "Sign In" })).not.toBeVisible();

    // Should see user profile button or name in the navigation
    await expect(page.locator("text=Roger Sharpe")).toBeVisible();

    // Step 8: Verify dev login component updates to show logged-in state
    await expect(page.locator("text=Dev: Roger Sharpe")).toBeVisible();

    // Step 9: Test navigation to protected route works
    await page.goto("/profile");
    await expect(page.locator("text=Profile")).toBeVisible();
    await expect(
      page.locator("text=Error loading profile: UNAUTHORIZED"),
    ).not.toBeVisible();

    // Step 10: Verify admin user can see admin links
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Organization" }),
    ).toBeVisible();
  });

  test("documents the current authentication bug", async ({ page }) => {
    // This test documents the current broken behavior
    // It should be updated once the bug is fixed

    // Step 1: Navigate and expand dev login
    const devLoginComponent = page
      .locator("div")
      .filter({ hasText: /^Dev Quick Login$/ });
    await devLoginComponent.click();

    // Step 2: Click login and verify auth request succeeds
    const [authResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/auth/callback/credentials") &&
          res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Roger Sharpe" }).click(),
    ]);

    expect(authResponse.status()).toBe(200);
    await page.waitForTimeout(3000);

    // Step 3: Document the bug - session state doesn't update
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();

    // Step 4: Protected routes show unauthorized
    await page.goto("/profile");
    await expect(
      page.locator("text=Error loading profile: UNAUTHORIZED"),
    ).toBeVisible();

    // Step 5: Dev login component still shows login options (not logged-in state)
    await page.goto("/");
    await expect(devLoginComponent).toBeVisible();
    await expect(page.locator("text=Dev: Roger Sharpe")).not.toBeVisible();
  });
});
