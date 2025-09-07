/**
 * Authentication Redirect Tests
 * - Tests unauthenticated access to protected routes
 * - Uses non-authenticated browser project
 */
import { test, expect } from "@playwright/test";

test.describe("Authentication Redirects", () => {
  test("unauthenticated user accessing apc org issues page shows error boundary or redirects", async ({
    page,
  }) => {
    console.log("Testing unauthenticated access to protected route...");

    // Try to access the apc org's issues page without authentication
    await page.goto("http://apc.localhost:3000/issues");

    // Wait a moment for the page to load and process the authentication check
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log("Current URL after navigation:", currentUrl);

    // Check if we were redirected to the sign-in page
    if (currentUrl.includes("/auth/sign-in")) {
      console.log("✅ Redirected to sign-in page");
      // Verify we're on the sign-in page
      await expect(page.locator("h1")).toContainText(/Welcome back|Sign In/i);
    } else {
      console.log("❌ Not redirected, checking for error boundary...");

      // If not redirected, should show an error boundary
      // Check for error boundary indicators
      const errorBoundary = page
        .locator("[data-testid='error-boundary']")
        .or(
          page
            .locator("text=Authentication Error")
            .or(page.locator("text=Sign In")),
        );

      // Wait for either error boundary or sign-in button to appear
      await expect(errorBoundary.first()).toBeVisible({ timeout: 10000 });

      // Check if there's a Sign In button in the error boundary
      const signInButton = page.locator("button", { hasText: "Sign In" });
      if (await signInButton.isVisible().catch(() => false)) {
        console.log("✅ Sign In button found in error boundary");

        // Test that the Sign In button works
        await signInButton.click();
        await expect(page.locator("h1")).toContainText(/Welcome back|Sign In/i);
        console.log(
          "✅ Sign In button successfully redirected to sign-in page",
        );
      } else {
        // Look for any authentication-related error message
        const authErrorMessage = page.locator(
          "text=/authentication|access.*required|member.*access|unauthorized/i",
        );
        await expect(authErrorMessage.first()).toBeVisible();
        console.log("✅ Authentication error message displayed");
      }
    }
  });

  test("unauthenticated user accessing dashboard shows proper auth handling", async ({
    page,
  }) => {
    console.log("Testing unauthenticated access to dashboard...");

    // Try to access the dashboard without authentication
    await page.goto("http://apc.localhost:3000/dashboard");

    // Wait for the page to process
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log("Dashboard access URL:", currentUrl);

    // Should either redirect to sign-in or show error boundary
    const isOnSignIn = currentUrl.includes("/auth/sign-in");

    if (isOnSignIn) {
      console.log("✅ Dashboard access redirected to sign-in");
      await expect(page.locator("h1")).toContainText(/Welcome back|Sign In/i);
    } else {
      console.log(
        "❌ Not redirected from dashboard, checking for error boundary...",
      );

      // Look for authentication error handling
      const authHandling = page
        .locator("text=/authentication|sign.*in|member.*access/i")
        .or(page.locator("button", { hasText: /sign.*in/i }));

      await expect(authHandling.first()).toBeVisible({ timeout: 10000 });
      console.log("✅ Authentication error handling displayed");
    }
  });

  test("unauthenticated access to localhost redirects to apc subdomain", async ({
    page,
  }) => {
    console.log("Testing localhost redirect behavior...");

    // According to docs, localhost:3000 should redirect to apc.localhost:3000
    await page.goto("http://localhost:3000");

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    console.log("Final URL after localhost access:", finalUrl);

    // Should either be redirected to apc.localhost or to sign-in
    const isApcSubdomain = finalUrl.includes("apc.localhost:3000");
    const isSignIn = finalUrl.includes("/auth/sign-in");

    expect(isApcSubdomain || isSignIn).toBeTruthy();

    if (isApcSubdomain) {
      console.log("✅ Redirected to apc subdomain");
    } else if (isSignIn) {
      console.log("✅ Redirected to sign-in page");
    }
  });
});
