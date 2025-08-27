/**
 * {{WORKFLOW_NAME}} E2E Tests - Archetype 7
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

test.describe("{{WORKFLOW_NAME}} (E2E Tests - Archetype 7)", () => {
  
  // Setup and teardown
  test.beforeEach(async ({ page }) => {
    // Navigate to test starting point
    await page.goto("/{{BASE_ROUTE}}");
    
    // Ensure we're authenticated as test user
    await authenticateTestUser(page);
    
    // Set organization context
    await setOrganizationContext(page, SEED_TEST_IDS.ORGANIZATIONS.primary);
  });

  test.describe("Server Component rendering", () => {
    test("renders server-side content immediately", async ({ page }) => {
      await page.goto("/{{ROUTE}}");

      // Server Components should render immediately without loading states
      await expect(page.locator("{{SERVER_COMPONENT_SELECTOR}}")).toBeVisible();
      await expect(page.locator("{{SERVER_DATA_SELECTOR}}")).toContainText("{{EXPECTED_SERVER_TEXT}}");
      
      // Should not see client loading spinners for Server Component content
      await expect(page.locator("{{LOADING_SPINNER_SELECTOR}}")).not.toBeVisible();
    });

    test("displays organization-scoped data correctly", async ({ page }) => {
      await page.goto("/{{ROUTE}}");

      // Verify server-rendered content shows correct org data
      await expect(page.locator("{{ORG_DATA_SELECTOR}}")).toContainText("{{ORG_SPECIFIC_TEXT}}");
      
      // Should not show competitor org data
      await expect(page.locator("body")).not.toContainText("{{COMPETITOR_ORG_TEXT}}");
    });

    test("handles server errors gracefully", async ({ page }) => {
      // Navigate to route that might cause server error
      await page.goto("/{{ERROR_PRONE_ROUTE}}");

      // Should show error boundary, not crash the page
      await expect(page.locator("{{ERROR_BOUNDARY_SELECTOR}}")).toBeVisible();
      await expect(page.locator("{{ERROR_MESSAGE_SELECTOR}}")).toContainText("{{ERROR_MESSAGE}}");
    });
  });

  test.describe("Client Island interactions", () => {
    test("client islands hydrate and become interactive", async ({ page }) => {
      await page.goto("/{{ROUTE}}");

      // Wait for client islands to hydrate
      await expect(page.locator("{{CLIENT_ISLAND_SELECTOR}}")).toBeVisible();
      
      // Test interactivity
      await page.click("{{INTERACTIVE_ELEMENT_SELECTOR}}");
      await expect(page.locator("{{INTERACTION_RESULT_SELECTOR}}")).toBeVisible();
    });

    test("client islands receive server props correctly", async ({ page }) => {
      await page.goto("/{{ROUTE}}");

      // Verify client island has access to server-passed data
      const dataAttribute = await page.getAttribute("{{CLIENT_ISLAND_SELECTOR}}", "data-{{SERVER_PROP}}");
      expect(dataAttribute).toBe("{{EXPECTED_SERVER_VALUE}}");
    });

    test("form submissions work with JavaScript enabled", async ({ page }) => {
      await page.goto("/{{FORM_ROUTE}}");

      // Fill and submit form through client island
      await page.fill("{{FORM_INPUT_SELECTOR}}", "{{TEST_INPUT_VALUE}}");
      await page.click("{{SUBMIT_BUTTON_SELECTOR}}");

      // Should show optimistic update or immediate feedback
      await expect(page.locator("{{SUCCESS_FEEDBACK_SELECTOR}}")).toBeVisible();
      
      // Should redirect or update content
      await expect(page.locator("{{RESULT_SELECTOR}}")).toContainText("{{SUCCESS_TEXT}}");
    });
  });

  test.describe("Progressive enhancement", () => {
    test("works without JavaScript (Server Actions)", async ({ page }) => {
      // Disable JavaScript
      await page.setJavaScriptEnabled(false);
      await page.goto("/{{FORM_ROUTE}}");

      // Form should still be visible and functional
      await expect(page.locator("{{FORM_SELECTOR}}")).toBeVisible();
      
      // Submit form (this will be a full page submission)
      await page.fill("{{FORM_INPUT_SELECTOR}}", "{{TEST_INPUT_VALUE}}");
      await page.click("{{SUBMIT_BUTTON_SELECTOR}}");

      // Should redirect to success page or show success state
      await expect(page.url()).toContain("{{SUCCESS_URL_FRAGMENT}}");
      await expect(page.locator("{{SUCCESS_CONTENT_SELECTOR}}")).toBeVisible();
    });

    test("navigation works without JavaScript", async ({ page }) => {
      await page.setJavaScriptEnabled(false);
      await page.goto("/{{ROUTE}}");

      // Click navigation link (should be full page navigation)
      await page.click("{{NAV_LINK_SELECTOR}}");
      
      // Should navigate to new page
      await expect(page.url()).toContain("{{TARGET_URL_FRAGMENT}}");
      await expect(page.locator("{{TARGET_CONTENT_SELECTOR}}")).toBeVisible();
    });

    test("fallback UI displays when JavaScript fails", async ({ page }) => {
      await page.goto("/{{ROUTE}}");
      
      // Block JavaScript after initial load to simulate runtime failure
      await page.addInitScript(() => {
        // Simulate JS runtime error after hydration
        setTimeout(() => {
          throw new Error("Simulated JS failure");
        }, 1000);
      });

      await page.reload();
      
      // Server-rendered content should still be visible
      await expect(page.locator("{{SERVER_CONTENT_SELECTOR}}")).toBeVisible();
      
      // Interactive elements should show fallback state
      await expect(page.locator("{{FALLBACK_UI_SELECTOR}}")).toBeVisible();
    });
  });

  test.describe("Complete user workflows", () => {
    test("{{PRIMARY_WORKFLOW}} end-to-end", async ({ page }) => {
      // Step 1: Navigate to starting point
      await page.goto("/{{WORKFLOW_START_ROUTE}}");
      await expect(page.locator("{{START_PAGE_SELECTOR}}")).toBeVisible();

      // Step 2: Server Component displays initial data
      await expect(page.locator("{{INITIAL_DATA_SELECTOR}}")).toContainText("{{INITIAL_DATA_TEXT}}");

      // Step 3: User interaction through client island
      await page.click("{{ACTION_BUTTON_SELECTOR}}");
      await page.fill("{{INPUT_SELECTOR}}", "{{WORKFLOW_INPUT_VALUE}}");
      
      // Step 4: Submit through Server Action
      await page.click("{{SUBMIT_SELECTOR}}");
      
      // Step 5: Verify success and navigation
      await expect(page.url()).toContain("{{SUCCESS_ROUTE_FRAGMENT}}");
      await expect(page.locator("{{SUCCESS_MESSAGE_SELECTOR}}")).toContainText("{{SUCCESS_MESSAGE}}");

      // Step 6: Verify data persistence (server-side)
      await page.reload();
      await expect(page.locator("{{PERSISTED_DATA_SELECTOR}}")).toContainText("{{WORKFLOW_INPUT_VALUE}}");
    });

    test("{{CRUD_WORKFLOW}} with organization scoping", async ({ page }) => {
      // Create
      await page.goto("/{{ENTITY_ROUTE}}/new");
      await page.fill("{{TITLE_INPUT}}", "{{TEST_ENTITY_TITLE}}");
      await page.click("{{CREATE_BUTTON}}");
      
      await expect(page.locator("{{SUCCESS_MESSAGE}}")).toBeVisible();
      
      // Read - verify in list
      await page.goto("/{{ENTITY_ROUTE}}");
      await expect(page.locator("{{ENTITY_LIST}}")).toContainText("{{TEST_ENTITY_TITLE}}");
      
      // Update
      await page.click("{{EDIT_LINK_FOR_ENTITY}}");
      await page.fill("{{TITLE_INPUT}}", "{{UPDATED_ENTITY_TITLE}}");
      await page.click("{{UPDATE_BUTTON}}");
      
      await expect(page.locator("{{SUCCESS_MESSAGE}}")).toBeVisible();
      
      // Verify update
      await page.goto("/{{ENTITY_ROUTE}}");
      await expect(page.locator("{{ENTITY_LIST}}")).toContainText("{{UPDATED_ENTITY_TITLE}}");
      await expect(page.locator("{{ENTITY_LIST}}")).not.toContainText("{{TEST_ENTITY_TITLE}}");
      
      // Delete
      await page.click("{{DELETE_BUTTON_FOR_ENTITY}}");
      await page.click("{{CONFIRM_DELETE}}");
      
      // Verify deletion
      await expect(page.locator("{{ENTITY_LIST}}")).not.toContainText("{{UPDATED_ENTITY_TITLE}}");
    });

    test("{{MULTI_STEP_WORKFLOW}} with validation", async ({ page }) => {
      await page.goto("/{{WORKFLOW_START_ROUTE}}");

      // Step 1: Invalid input should show validation
      await page.fill("{{STEP1_INPUT}}", "{{INVALID_VALUE}}");
      await page.click("{{STEP1_NEXT}}");
      
      await expect(page.locator("{{VALIDATION_ERROR}}")).toContainText("{{VALIDATION_MESSAGE}}");
      
      // Step 1: Correct input should proceed
      await page.fill("{{STEP1_INPUT}}", "{{VALID_VALUE}}");
      await page.click("{{STEP1_NEXT}}");
      
      await expect(page.locator("{{STEP2_CONTENT}}")).toBeVisible();
      
      // Step 2: Complete workflow
      await page.selectOption("{{STEP2_SELECT}}", "{{OPTION_VALUE}}");
      await page.click("{{STEP2_NEXT}}");
      
      // Final step: Review and confirm
      await expect(page.locator("{{REVIEW_CONTENT}}")).toContainText("{{VALID_VALUE}}");
      await expect(page.locator("{{REVIEW_CONTENT}}")).toContainText("{{OPTION_VALUE}}");
      
      await page.click("{{CONFIRM_BUTTON}}");
      
      // Success
      await expect(page.locator("{{COMPLETION_MESSAGE}}")).toBeVisible();
    });
  });

  test.describe("Security and authentication", () => {
    test("requires authentication for protected routes", async ({ page }) => {
      // Clear authentication
      await clearAuthentication(page);
      
      // Try to access protected route
      await page.goto("/{{PROTECTED_ROUTE}}");
      
      // Should redirect to login
      await expect(page.url()).toContain("/auth/sign-in");
      await expect(page.locator("{{LOGIN_FORM_SELECTOR}}")).toBeVisible();
    });

    test("enforces organization boundaries", async ({ page }) => {
      // Switch to competitor org context
      await setOrganizationContext(page, SEED_TEST_IDS.ORGANIZATIONS.competitor);
      
      // Try to access primary org data
      await page.goto("/{{ORG_SPECIFIC_ROUTE}}");
      
      // Should not see primary org data
      await expect(page.locator("body")).not.toContainText("{{PRIMARY_ORG_DATA}}");
      
      // Should see appropriate org data or access denied message
      const hasCompetitorData = await page.locator("body").textContent();
      expect(hasCompetitorData).toMatch(/{{COMPETITOR_ORG_DATA}}|{{ACCESS_DENIED_MESSAGE}}/);
    });

    test("handles session expiration gracefully", async ({ page }) => {
      await page.goto("/{{ROUTE}}");
      
      // Simulate session expiration
      await expireSession(page);
      
      // Try to perform authenticated action
      await page.click("{{AUTHENTICATED_ACTION_BUTTON}}");
      
      // Should redirect to login or show auth error
      await expect(page.locator("{{AUTH_REQUIRED_MESSAGE}}")).toBeVisible();
    });
  });

  test.describe("Performance and caching", () => {
    test("Server Components load quickly", async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto("/{{ROUTE}}");
      await expect(page.locator("{{SERVER_COMPONENT_SELECTOR}}")).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan({{PERFORMANCE_THRESHOLD_MS}});
    });

    test("cache invalidation works correctly", async ({ page }) => {
      // Load page and verify initial data
      await page.goto("/{{ROUTE}}");
      await expect(page.locator("{{DATA_SELECTOR}}")).toContainText("{{INITIAL_DATA}}");
      
      // Perform action that should invalidate cache
      await page.click("{{CACHE_INVALIDATING_ACTION}}");
      await expect(page.locator("{{SUCCESS_FEEDBACK}}")).toBeVisible();
      
      // Verify data is updated (cache was invalidated)
      await expect(page.locator("{{DATA_SELECTOR}}")).toContainText("{{UPDATED_DATA}}");
    });

    test("handles slow network conditions", async ({ page }) => {
      // Simulate slow network
      await page.setOfflineMode(false);
      await page.setExtraHTTPHeaders({});
      
      // Add network delay simulation if supported by your setup
      await page.goto("/{{ROUTE}}");
      
      // Should show appropriate loading states
      await expect(page.locator("{{SERVER_CONTENT_SELECTOR}}")).toBeVisible();
      
      // Client islands should still become interactive
      await expect(page.locator("{{CLIENT_ISLAND_SELECTOR}}")).toBeVisible();
    });
  });
});

// Helper functions
async function authenticateTestUser(page: Page) {
  // Implementation depends on your auth system
  await page.evaluate(() => {
    // Set test authentication cookies/tokens
    document.cookie = `auth-token=test-token-${Date.now()}; path=/`;
  });
}

async function setOrganizationContext(page: Page, orgId: string) {
  await page.evaluate((orgId) => {
    localStorage.setItem('selectedOrgId', orgId);
  }, orgId);
}

async function clearAuthentication(page: Page) {
  await page.evaluate(() => {
    document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function expireSession(page: Page) {
  await page.evaluate(() => {
    document.cookie = 'auth-token=expired; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });
}

// Example usage patterns for different E2E workflow types:

/*
// Authentication workflows:
test.describe("User Authentication E2E", () => {
  // Test sign-up, sign-in, password reset, session management
  // Progressive enhancement: forms work without JS
  // Server Actions: authentication processes server-side
});

// Data management workflows:
test.describe("Issue Management E2E", () => {
  // Test create, read, update, delete with Server Components and Server Actions
  // Organization scoping throughout workflow
  // Real-time updates through client islands
});

// Complex multi-step processes:
test.describe("Machine Setup Wizard E2E", () => {
  // Test multi-step form with validation at each step
  // Server-side state management between steps
  // Progressive enhancement for each step
});

// Search and filtering workflows:
test.describe("Machine Search E2E", () => {
  // Test server-side search with URL parameters
  // Client island search input with real-time feedback
  // Filter combinations and result management
});

// Permission-based workflows:
test.describe("Admin Dashboard E2E", () => {
  // Test role-based UI differences
  // Admin actions through Server Actions
  // Security boundary enforcement
});
*/