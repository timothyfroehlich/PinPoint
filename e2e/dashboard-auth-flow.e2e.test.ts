/**
 * Dashboard Authentication Flow E2E Tests - Archetype 7
 * Full RSC application workflow testing with progressive enhancement
 * 
 * ARCHETYPE BOUNDARIES:
 * - Test complete user workflows across multiple pages and components
 * - Focus on RSC architecture patterns and progressive enhancement
 * - Use real browser automation with Playwright for authentic user interactions
 * - NO unit-level testing (those belong in other archetypes)
 * 
 * WHAT BELONGS HERE:
 * - Multi-step user workflows like signup, issue creation, machine setup
 * - Cross-page navigation and data persistence testing
 * - Authentication flows and organization switching
 * - Complete CRUD operations with UI feedback and validation
 * 
 * WHAT DOESN'T BELONG:
 * - Testing individual functions or components in isolation
 * - Database query testing without UI interaction
 * - Pure validation logic or utility function testing
 * - Mock-heavy testing that doesn't reflect real user experience
 * 
 * RSC ARCHITECTURE TESTING:
 * - Verify Server Components render immediately without loading states
 * - Test Client Islands hydrate properly and become interactive
 * - Ensure hybrid components integrate server data with client interactions
 * - Validate progressive enhancement degrades gracefully without JavaScript
 * 
 * PROGRESSIVE ENHANCEMENT:
 * - Test all workflows work without JavaScript enabled
 * - Verify forms submit through Server Actions when JS is disabled
 * - Ensure navigation works with full page loads
 * - Test fallback UI states when client-side features fail
 * 
 * SECURITY AND ISOLATION:
 * - Test organization boundaries are enforced in UI
 * - Verify authentication redirects work correctly
 * - Ensure unauthorized access attempts are properly handled
 * - Test session expiration and renewal workflows
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - Validate Server Components load within acceptable time limits
 * - Test cache invalidation works correctly after data changes
 * - Ensure smooth transitions between server and client states
 */

import { test, expect, Page } from "@playwright/test";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Test configuration
test.describe.configure({ mode: 'parallel' });

test.describe("Dashboard Authentication Flow (E2E Tests - Archetype 7)", () => {
  
  test.describe("Authentication and authorization", () => {
    test("dev login flow loads dashboard without authentication errors", async ({ page }) => {
      // Capture console errors to detect authentication failures
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Go directly to sign-in page (avoiding homepage import leak issues)
      await page.goto('/auth/sign-in');
      await expect(page.locator('h1')).toHaveText('Welcome back');

      // Perform dev login
      await page.click('button:has-text("Dev Login: Tim (Admin)")');
      
      // Should redirect to dashboard
      await page.waitForURL('/dashboard');
      
      // Verify dashboard loads completely
      await expect(page.locator('h1')).toHaveText('Dashboard');
      await expect(page.locator('text=Welcome back, Tim Froehlich')).toBeVisible();
      
      // Wait for all Suspense boundaries to resolve
      await page.waitForLoadState('networkidle');
      
      // Verify specific components that were failing load successfully
      // These were the Server Components with ignored organizationId parameters
      await expect(page.locator('text=Total Machines')).toBeVisible();
      await expect(page.locator('text=Recent Issues')).toBeVisible();
      
      // Critical: Verify no authentication errors occurred
      // Filter out expected Supabase refresh token errors (normal for dev)
      const authErrors = consoleErrors.filter(error => 
        error.includes('Authentication required') && 
        !error.includes('refresh_token_not_found')
      );
      
      expect(authErrors).toHaveLength(0);
      
      // Verify stats cards render (these call getOrganizationStats internally)
      const statsSection = page.locator('[data-testid="dashboard-stats"], .grid:has-text("Total Machines")');
      await expect(statsSection.first()).toBeVisible();
    });

    test("dashboard preserves authentication across page refreshes", async ({ page }) => {
      // Perform login
      await page.goto('/auth/sign-in');
      await page.click('button:has-text("Dev Login: Tim (Admin)")');
      await page.waitForURL('/dashboard');
      
      // Refresh the page
      await page.reload();
      
      // Should remain on dashboard (not redirect to sign-in)
      await expect(page.locator('h1')).toHaveText('Dashboard');
      await expect(page.locator('text=Welcome back, Tim Froehlich')).toBeVisible();
    });

    test("unauthenticated users cannot access dashboard directly", async ({ page }) => {
      // Clear any existing authentication
      await clearAuthentication(page);
      
      // Try to access dashboard without authentication
      await page.goto('/dashboard');
      
      // Should redirect to sign-in (protected route)
      await page.waitForURL('/auth/sign-in');
      await expect(page.locator('h1')).toHaveText('Welcome back');
    });

    test("requires authentication for protected routes", async ({ page }) => {
      // Clear authentication
      await clearAuthentication(page);
      
      // Try to access protected route
      await page.goto('/machines');
      
      // Should redirect to login
      await expect(page.url()).toContain('/auth/sign-in');
      await expect(page.locator('h1')).toContainText('Welcome back');
    });

    test("enforces organization boundaries", async ({ page }) => {
      // Login as primary org user
      await page.goto('/auth/sign-in');
      await page.click('button:has-text("Dev Login: Tim (Admin)")');
      await page.waitForURL('/dashboard');
      
      // Verify dashboard loads and shows user data
      await expect(page.locator('h1')).toHaveText('Dashboard');
      await expect(page.locator('text=Welcome back, Tim Froehlich')).toBeVisible();
      
      // Should not see competitor org data (test organization isolation)
      await expect(page.locator('body')).not.toContainText('Competitor Arcade');
    });
  });

  test.describe("Server Component rendering", () => {
    test.beforeEach(async ({ page }) => {
      // Ensure we're authenticated for Server Component tests
      await authenticateTestUser(page);
      await setOrganizationContext(page, SEED_TEST_IDS.ORGANIZATIONS.primary);
    });

    test("renders server-side content immediately", async ({ page }) => {
      await page.goto("/dashboard");

      // Server Components should render immediately without loading states
      await expect(page.locator('h1')).toHaveText('Dashboard');
      await expect(page.locator('text=Welcome back, Tim Froehlich')).toBeVisible();
      
      // Should not see client loading spinners for Server Component content
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    });

    test("displays organization-scoped data correctly", async ({ page }) => {
      await page.goto("/dashboard");

      // Verify server-rendered content shows user data correctly
      await expect(page.locator('text=Welcome back, Tim Froehlich')).toBeVisible();
      await expect(page.locator('h1')).toHaveText('Dashboard');
      
      // Should not show competitor org data
      await expect(page.locator("body")).not.toContainText("Competitor Arcade");
    });

    test("Server Components load stats without auth errors", async ({ page }) => {
      // This test specifically targets the bug we fixed
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto("/dashboard");

      // Wait for all Server Components to render
      await page.waitForLoadState('networkidle');
      
      // Verify the specific components that were causing auth errors
      await expect(page.locator('text=Total Machines')).toBeVisible();
      
      // The bug: Server Components with ignored organizationId parameters
      // should not cause authentication errors
      const authErrors = consoleErrors.filter(error => 
        error.includes('Authentication required') && 
        !error.includes('refresh_token_not_found')
      );
      
      expect(authErrors).toHaveLength(0);
    });
  });

  test.describe("Navigation and workflow continuity", () => {
    test.beforeEach(async ({ page }) => {
      await authenticateTestUser(page);
      await setOrganizationContext(page, SEED_TEST_IDS.ORGANIZATIONS.primary);
    });

    test("navigation works after successful authentication", async ({ page }) => {
      await page.goto('/dashboard');
      
      // Verify navigation works (proves auth context is properly propagated)
      await page.click('a[href="/machines"]');
      await page.waitForURL('/machines');
      await expect(page.locator('h1')).toHaveText('Machine Inventory');
      
      // Navigate to issues
      await page.click('a[href="/issues"]');
      await page.waitForURL('/issues');
      await expect(page.locator('h1')).toHaveText('Issues');
      
      // Navigate back to dashboard
      await page.click('a[href="/dashboard"]');
      await page.waitForURL('/dashboard');
      await expect(page.locator('h1')).toHaveText('Dashboard');
    });
  });

  test.describe("Progressive enhancement", () => {
    test("works without JavaScript (Server Components)", async ({ browser }) => {
      // Create context with JavaScript disabled
      const noJsContext = await browser.newContext({ javaScriptEnabled: false });
      const noJsPage = await noJsContext.newPage();

      // Create authenticated context first
      const jsContext = await browser.newContext();
      const jsPage = await jsContext.newPage();
      await authenticateTestUser(jsPage);
      await setOrganizationContext(jsPage, SEED_TEST_IDS.ORGANIZATIONS.primary);

      // Transfer cookies to no-JS context
      const cookies = await jsContext.cookies();
      await noJsContext.addCookies(cookies);
      
      await noJsPage.goto("/dashboard");

      // Server Components should still be visible and functional
      await expect(noJsPage.locator('h1')).toHaveText('Dashboard');
      await expect(noJsPage.locator('text=Welcome back, Tim Froehlich')).toBeVisible();

      await noJsContext.close();
      await jsContext.close();
    });

    test("navigation works without JavaScript", async ({ browser }) => {
      // Create context with JavaScript disabled
      const noJsContext = await browser.newContext({ javaScriptEnabled: false });
      const noJsPage = await noJsContext.newPage();

      // Create authenticated context first
      const jsContext = await browser.newContext();
      const jsPage = await jsContext.newPage();
      await authenticateTestUser(jsPage);
      await setOrganizationContext(jsPage, SEED_TEST_IDS.ORGANIZATIONS.primary);

      // Transfer cookies to no-JS context
      const cookies = await jsContext.cookies();
      await noJsContext.addCookies(cookies);
      
      await noJsPage.goto("/dashboard");

      // Click navigation link (should be full page navigation)
      await noJsPage.click('a[href="/machines"]');
      
      // Should navigate to new page
      await expect(noJsPage.url()).toContain("/machines");
      await expect(noJsPage.locator('h1')).toHaveText('Machine Inventory');

      await noJsContext.close();
      await jsContext.close();
    });
  });

  test.describe("Performance and caching", () => {
    test.beforeEach(async ({ page }) => {
      await authenticateTestUser(page);
      await setOrganizationContext(page, SEED_TEST_IDS.ORGANIZATIONS.primary);
    });

    test("Server Components load quickly", async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto("/dashboard");
      await expect(page.locator('h1')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // 3 second threshold
    });

    test("handles multiple concurrent requests without auth errors", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Navigate quickly between pages to test concurrent auth contexts
      await page.goto("/dashboard");
      await page.goto("/machines");
      await page.goto("/issues");
      await page.goto("/dashboard");
      
      // Wait for all requests to complete
      await page.waitForLoadState('networkidle');
      
      // Should not have authentication errors from concurrent requests
      const authErrors = consoleErrors.filter(error => 
        error.includes('Authentication required') && 
        !error.includes('refresh_token_not_found')
      );
      
      expect(authErrors).toHaveLength(0);
    });
  });
});

// Helper functions
async function authenticateTestUser(page: Page) {
  // Navigate to sign-in and perform dev login
  await page.goto('/auth/sign-in');
  await page.click('button:has-text("Dev Login: Tim (Admin)")');
  await page.waitForURL('/dashboard');
}

async function setOrganizationContext(page: Page, orgId: string) {
  await page.evaluate((orgId) => {
    localStorage.setItem('selectedOrgId', orgId);
  }, orgId);
}

async function clearAuthentication(page: Page) {
  // Use only safe Playwright APIs to clear authentication
  
  // 1. Clear all cookies using Playwright API
  await page.context().clearCookies();
  
  // 2. Clear browser storage (avoid document.cookie which causes SecurityError)
  await page.evaluate(() => {
    try {
      // Only access storage, not cookies
      if (typeof Storage !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Try to clear IndexedDB databases
      if ('indexedDB' in window) {
        try {
          const dbs = ['supabase-auth-token', 'supabase-session', 'keyval-store'];
          dbs.forEach(dbName => {
            try {
              indexedDB.deleteDatabase(dbName);
            } catch (e) {
              // Ignore individual DB deletion errors
            }
          });
        } catch (e) {
          // Ignore IndexedDB errors
        }
      }
    } catch (e) {
      console.log("Storage clearing failed:", e);
    }
  });
  
  // 3. Navigate to sign-out endpoint if it exists, then to home
  try {
    await page.goto("/auth/signout", { waitUntil: "domcontentloaded", timeout: 2000 });
    await page.waitForTimeout(500);
  } catch (e) {
    // Sign-out endpoint may not exist, that's ok
  }
  
  // 4. Navigate to home page to trigger auth redirect
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000); // Give time for auth redirect to happen
}