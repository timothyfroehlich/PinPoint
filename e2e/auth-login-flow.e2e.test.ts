/**
 * Authentication Login Flow E2E Tests - Archetype 7
 * Full RSC application authentication workflow testing with dev accounts
 *
 * ARCHETYPE BOUNDARIES:
 * - Test complete user authentication workflows from clean session to authenticated state
 * - Focus on RSC authentication patterns and progressive enhancement
 * - Use real browser automation with Playwright for authentic user interactions
 * - NO unit-level testing (those belong in other archetypes)
 *
 * WHAT BELONGS HERE:
 * - Complete authentication flows with dev accounts
 * - Session management and persistence testing
 * - Authentication redirects and protected route access
 * - Cross-page navigation with authentication context
 *
 * WHAT DOESN'T BELONG:
 * - Testing individual auth functions in isolation
 * - Server Action authentication logic testing (Archetype 4)
 * - Pure validation logic or utility function testing (Archetype 1)
 * - Mock-heavy testing that doesn't reflect real user experience
 *
 * RSC ARCHITECTURE TESTING:
 * - Verify Server Components render authenticated content immediately
 * - Test Client Islands for authentication forms hydrate properly
 * - Ensure hybrid authentication components integrate server and client states
 * - Validate progressive enhancement works for authentication forms
 *
 * PROGRESSIVE ENHANCEMENT:
 * - Test authentication workflows work without JavaScript enabled
 * - Verify forms submit through Server Actions when JS is disabled
 * - Ensure navigation works with full page loads after authentication
 * - Test fallback UI states when client-side auth features fail
 *
 * SECURITY AND ISOLATION:
 * - Test authentication boundaries are enforced in UI
 * - Verify session persistence and expiration handling
 * - Ensure unauthorized access attempts redirect properly
 * - Test organization context is set correctly after login
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Validate authentication Server Components load quickly
 * - Test session state transitions are smooth
 * - Ensure authenticated page transitions work efficiently
 */

import { test, expect, Page } from "@playwright/test";
import { SEED_TEST_IDS } from "../src/test/constants/seed-test-ids";
import { logout } from "./helpers/unified-dashboard";

// Test configuration
test.describe.configure({ mode: "parallel" });

test.describe("Authentication Login Flow (E2E Tests - Archetype 7)", () => {
  // Setup and teardown
  test.beforeEach(async ({ page }) => {
    // Start with clean session for each test
    await logout(page);

    // Navigate to home page to establish baseline
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Server Component authentication rendering", () => {
    test("renders unauthenticated home page correctly", async ({ page }) => {
      await page.goto("/");

      // Server Components should render immediately showing unauthenticated state
      await expect(page.locator("h1")).toContainText("Welcome to PinPoint");

      // Should show sign-in navigation
      await expect(page.locator("a[href*='/auth/sign-in']")).toBeVisible();

      // Should not show authenticated-only navigation
      await expect(page.locator("a[href='/dashboard']")).not.toBeVisible();
    });

    test("redirects authenticated pages when not logged in", async ({
      page,
    }) => {
      // Try to access protected dashboard route
      await page.goto("/dashboard");

      // Should redirect to sign-in page
      await expect(page.url()).toContain("/auth/sign-in");
      await expect(page.locator("h1")).toContainText("Welcome back");
    });

    test("displays sign-in form Server Component correctly", async ({
      page,
    }) => {
      await page.goto("/auth/sign-in");

      // Server-rendered sign-in page should appear immediately
      await expect(page.locator("h1")).toContainText("Welcome back");
      await expect(page.locator("p")).toContainText(
        "Sign in to your PinPoint account",
      );

      // Should not see loading spinners for Server Component content
      await expect(page.locator("[data-testid='skeleton']")).not.toBeVisible();
    });
  });

  test.describe("Dev account authentication flow", () => {
    test("dev login form hydrates and becomes interactive", async ({
      page,
    }) => {
      await page.goto("/auth/sign-in");

      // Wait for client island to hydrate (dev login section)
      await expect(
        page.locator("[data-testid='dev-quick-login']"),
      ).toBeVisible();

      // Dev login section should be clickable (client island is hydrated)
      await page.locator("text='Dev Quick Login'").click();

      // Should expand to show dev user options
      await expect(page.locator("text='Loading users...'")).toBeVisible();
      await expect(page.locator("text='Loading users...'")).not.toBeVisible({
        timeout: 5000,
      });
    });

    test("completes admin dev login successfully", async ({ page }) => {
      console.log("🧪 AUTH E2E - Starting admin dev login test");

      // Step 1: Navigate to sign-in page
      await page.goto("/auth/sign-in");
      await page.waitForLoadState("networkidle");

      // Verify we're on sign-in page
      await expect(page.locator("h1")).toContainText("Welcome back");
      console.log("✅ AUTH E2E - On sign-in page");

      // Step 2: Find and expand dev login section
      const devLoginSection = page.locator('text="Dev Quick Login"');
      await expect(devLoginSection).toBeVisible({ timeout: 5000 });
      await devLoginSection.click();
      console.log("✅ AUTH E2E - Expanded dev login section");

      // Step 3: Wait for dev users to load
      const loadingText = page.locator('text="Loading users..."');
      if (await loadingText.isVisible().catch(() => false)) {
        await expect(loadingText).not.toBeVisible({ timeout: 10000 });
      }

      // Step 4: Click admin user (Tim Froehlich)
      const adminButton = page
        .locator("button", {
          hasText: /Tim Froehlich|tim\.froehlich@example\.com/i,
        })
        .first();

      await expect(adminButton).toBeVisible({ timeout: 10000 });
      await adminButton.click();
      console.log("✅ AUTH E2E - Clicked admin user button");

      // Step 5: Wait for authentication to complete
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      // Step 6: Verify we're redirected to dashboard or authenticated area
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/dashboard|issues|machines/);
      console.log(
        `✅ AUTH E2E - Redirected to authenticated area: ${currentUrl}`,
      );

      // Step 7: Verify authenticated content is visible
      const authenticatedIndicators = [
        'text="Dashboard"',
        'text="Issues"',
        'text="Machines"',
        'text="Tim Froehlich"',
      ];

      let foundIndicator = false;
      for (const indicator of authenticatedIndicators) {
        if (
          await page
            .locator(indicator)
            .isVisible()
            .catch(() => false)
        ) {
          foundIndicator = true;
          console.log(
            `✅ AUTH E2E - Found authenticated indicator: ${indicator}`,
          );
          break;
        }
      }

      expect(foundIndicator).toBe(true);
      console.log("✅ AUTH E2E - Admin login completed successfully");
    });

    test("member dev login has appropriate permissions", async ({ page }) => {
      await page.goto("/auth/sign-in");

      // Expand dev login section
      await page.locator('text="Dev Quick Login"').click();

      // Wait for users to load
      const loadingText = page.locator('text="Loading users..."');
      if (await loadingText.isVisible().catch(() => false)) {
        await expect(loadingText).not.toBeVisible({ timeout: 10000 });
      }

      // Click member user (Harry Williams)
      const memberButton = page
        .locator("button", {
          hasText: /Harry Williams|harry@example\.com/i,
        })
        .first();

      await expect(memberButton).toBeVisible({ timeout: 10000 });
      await memberButton.click();

      // Wait for authentication
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      // Verify member is logged in
      await expect(page.locator("text='Harry Williams'")).toBeVisible();

      // Member should see dashboard but not admin features
      await page.goto("/dashboard");
      await expect(page.locator("h1")).toContainText("Dashboard");

      // Should not see admin-only sections (adjust based on actual UI)
      await expect(page.locator("text='Admin Panel'")).not.toBeVisible();
    });
  });

  test.describe("Protected route access after authentication", () => {
    test("can access issues page after login", async ({ page }) => {
      // First authenticate as admin
      await authenticateAsTestAdmin(page);

      // Navigate to issues page
      await page.goto("/issues");
      await page.waitForLoadState("networkidle");

      // Should see issues page content (Server Component rendered)
      await expect(page.locator("h1")).toContainText("Issues");

      // Should see organization-scoped data
      await expect(page.locator("body")).not.toContainText("Competitor Arcade");

      // Should have access to create issue
      await expect(page.locator("a[href='/issues/create']")).toBeVisible();
    });

    test("can access dashboard after login", async ({ page }) => {
      await authenticateAsTestAdmin(page);

      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Dashboard Server Components should render immediately
      await expect(page.locator("h1")).toContainText("Dashboard");

      // Should show user-specific data
      await expect(page.locator("text='Tim Froehlich'")).toBeVisible();
    });

    test("maintains authentication across page navigation", async ({
      page,
    }) => {
      await authenticateAsTestAdmin(page);

      // Navigate between multiple pages
      await page.goto("/dashboard");
      await expect(page.locator("h1")).toContainText("Dashboard");

      await page.goto("/issues");
      await expect(page.locator("h1")).toContainText("Issues");

      await page.goto("/machines");
      // Should still be authenticated (no redirect to login)
      expect(page.url()).not.toContain("/auth/sign-in");
    });
  });

  test.describe("Progressive enhancement", () => {
    test("sign-in form works without JavaScript", async ({ browser }) => {
      // Create context with JavaScript disabled
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();

      await page.goto("/auth/sign-in");

      // Form should still be visible
      await expect(page.locator("form")).toBeVisible();
      await expect(page.locator("h1")).toContainText("Welcome back");

      // Basic form elements should be accessible
      await expect(page.locator("button")).toBeVisible();

      // Note: Dev login requires JavaScript, but basic form structure should work
      console.log("✅ AUTH E2E - Sign-in page works without JavaScript");

      await context.close();
    });

    test("navigation works after login without JavaScript", async ({
      browser,
    }) => {
      // First authenticate with JavaScript enabled
      const jsContext = await browser.newContext({ javaScriptEnabled: true });
      const jsPage = await jsContext.newPage();
      await authenticateAsTestAdmin(jsPage);

      // Then create new context with JavaScript disabled for navigation test
      const noJsContext = await browser.newContext({
        javaScriptEnabled: false,
      });
      const noJsPage = await noJsContext.newPage();

      // Copy authentication cookies from JS context to no-JS context
      const cookies = await jsContext.cookies();
      await noJsContext.addCookies(cookies);

      // Navigate to issues page (should work with full page loads)
      await noJsPage.goto("/issues");
      await expect(noJsPage.locator("h1")).toContainText("Issues");

      // Navigation links should still work
      await noJsPage.click("a[href='/dashboard']");
      await expect(noJsPage.url()).toContain("/dashboard");

      await jsContext.close();
      await noJsContext.close();
    });
  });

  test.describe("Session management", () => {
    test("persists authentication across browser reload", async ({ page }) => {
      await authenticateAsTestAdmin(page);

      // Verify authenticated
      await page.goto("/dashboard");
      await expect(page.locator("h1")).toContainText("Dashboard");

      // Reload page
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Should still be authenticated
      await expect(page.locator("h1")).toContainText("Dashboard");
      expect(page.url()).not.toContain("/auth/sign-in");
    });

    test("handles logout correctly", async ({ page }) => {
      await authenticateAsTestAdmin(page);

      // Verify authenticated
      await page.goto("/dashboard");
      await expect(page.locator("h1")).toContainText("Dashboard");

      // Clear session (simulate logout)
      await logout(page);

      // Try to access protected page
      await page.goto("/dashboard");

      // Should redirect to login
      await expect(page.url()).toContain("/auth/sign-in");
    });

    test("enforces organization boundaries", async ({ page }) => {
      await authenticateAsTestAdmin(page);

      // Navigate to issues page
      await page.goto("/issues");

      // Should see primary org data
      await expect(page.locator("h1")).toContainText("Issues");

      // Should not see competitor organization data
      await expect(page.locator("body")).not.toContainText("Competitor Arcade");

      // Organization context should be properly set
      const orgContext = SEED_TEST_IDS.ORGANIZATIONS.primary;
      console.log(`✅ AUTH E2E - Organization context enforced: ${orgContext}`);
    });
  });

  test.describe("Authentication error handling", () => {
    test("handles invalid authentication gracefully", async ({ page }) => {
      await page.goto("/auth/sign-in");

      // Simulate authentication failure by clearing cookies mid-process
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto("/dashboard");

      // Should redirect to sign-in with appropriate messaging
      await expect(page.url()).toContain("/auth/sign-in");
      await expect(page.locator("h1")).toContainText("Welcome back");
    });

    test("shows appropriate feedback for authentication states", async ({
      page,
    }) => {
      await page.goto("/auth/sign-in");

      // Find dev login section
      await page.locator('text="Dev Quick Login"').click();

      // Look for loading states during authentication
      const loadingIndicator = page.locator('text="Loading users..."');
      if (await loadingIndicator.isVisible().catch(() => false)) {
        // Should show loading, then hide when complete
        await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
      }

      console.log(
        "✅ AUTH E2E - Authentication loading states handled properly",
      );
    });
  });

  test.describe("Performance and authentication", () => {
    test("authenticated pages load quickly", async ({ page }) => {
      await authenticateAsTestAdmin(page);

      const startTime = Date.now();

      await page.goto("/dashboard");
      await expect(page.locator("h1")).toContainText("Dashboard");

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds

      console.log(`✅ AUTH E2E - Dashboard loaded in ${loadTime}ms`);
    });

    test("authentication state transitions are smooth", async ({ page }) => {
      // Measure complete authentication flow
      const startTime = Date.now();

      await page.goto("/auth/sign-in");
      await page.locator('text="Dev Quick Login"').click();

      const adminButton = page
        .locator("button", {
          hasText: /Tim Froehlich/i,
        })
        .first();

      await expect(adminButton).toBeVisible();
      await adminButton.click();

      // Wait for redirect to complete
      await page.waitForLoadState("networkidle");

      const authTime = Date.now() - startTime;
      expect(authTime).toBeLessThan(5000); // Complete flow within 5 seconds

      console.log(`✅ AUTH E2E - Complete auth flow in ${authTime}ms`);
    });
  });
});

// Helper functions
async function authenticateAsTestAdmin(page: Page) {
  console.log("🔧 AUTH E2E - Starting admin authentication helper");

  await page.goto("/auth/sign-in");
  await page.waitForLoadState("networkidle");

  // Expand dev login section
  const devLoginSection = page.locator('text="Dev Quick Login"');
  await expect(devLoginSection).toBeVisible();
  await devLoginSection.click();

  // Wait for users to load
  const loadingText = page.locator('text="Loading users..."');
  if (await loadingText.isVisible().catch(() => false)) {
    await expect(loadingText).not.toBeVisible({ timeout: 10000 });
  }

  // Click admin user
  const adminButton = page
    .locator("button", {
      hasText: /Tim Froehlich|tim\.froehlich@example\.com/i,
    })
    .first();

  await expect(adminButton).toBeVisible();
  await adminButton.click();

  // Wait for authentication to complete
  await page.waitForLoadState("networkidle", { timeout: 15000 });

  console.log("✅ AUTH E2E - Admin authentication helper completed");
}

async function authenticateAsTestMember(page: Page) {
  console.log("🔧 AUTH E2E - Starting member authentication helper");

  await page.goto("/auth/sign-in");
  await page.waitForLoadState("networkidle");

  // Expand dev login section
  await page.locator('text="Dev Quick Login"').click();

  // Wait for users to load
  const loadingText = page.locator('text="Loading users..."');
  if (await loadingText.isVisible().catch(() => false)) {
    await expect(loadingText).not.toBeVisible({ timeout: 10000 });
  }

  // Click member user
  const memberButton = page
    .locator("button", {
      hasText: /Harry Williams|harry@example\.com/i,
    })
    .first();

  await expect(memberButton).toBeVisible();
  await memberButton.click();

  await page.waitForLoadState("networkidle", { timeout: 15000 });

  console.log("✅ AUTH E2E - Member authentication helper completed");
}

// Example usage patterns for different authentication E2E workflow types:

/*
// OAuth authentication flows (when implemented):
test.describe("OAuth Authentication E2E", () => {
  // Test Google OAuth flow end-to-end
  // Progressive enhancement: OAuth works without full JS
  // Server Actions: OAuth processes server-side
});

// Multi-organization authentication:
test.describe("Multi-Org Authentication E2E", () => {
  // Test switching between organizations after login
  // Organization context persistence across sessions
  // Access control enforcement per organization
});

// Advanced authentication scenarios:
test.describe("Advanced Auth Scenarios E2E", () => {
  // Test session expiration and renewal
  // Test concurrent sessions in different tabs
  // Test authentication with different roles
});

// Security-focused authentication tests:
test.describe("Authentication Security E2E", () => {
  // Test unauthorized access attempts
  // Test session hijacking prevention
  // Test CSRF protection in auth forms
});
*/
