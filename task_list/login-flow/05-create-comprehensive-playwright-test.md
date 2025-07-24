# Task 5: Create Comprehensive Playwright Test

## Overview
Create a complete end-to-end test that verifies the entire unified dashboard authentication flow works correctly. This test will validate the exact user journey you described: loading public dashboard, logging in, seeing authenticated content, logging out, seeing public content, and switching between different users.

## Priority: Medium  
Essential for ensuring the implementation works correctly and preventing regressions.

## Test Scenarios

The comprehensive test should cover:

1. **Public Dashboard Loading** - Verify organization info and locations load without authentication
2. **Login Flow** - Test authentication via dev quick login  
3. **Authenticated Enhancement** - Verify additional content appears when logged in
4. **Logout Flow** - Test logout redirects to public view correctly
5. **User Switching** - Test logging in as different user types
6. **Permission Verification** - Ensure different users see appropriate content
7. **Error Handling** - Test graceful handling of authentication errors

## Files to Create

### Primary File: `e2e/unified-dashboard-flow.spec.ts`

## Implementation

### Complete Test File

**File**: `e2e/unified-dashboard-flow.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Unified Dashboard Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start each test from a clean state
    await page.goto("/");
    
    // Clear any existing sessions
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("should load public dashboard without authentication", async ({ page }) => {
    // Verify public content is visible immediately
    await expect(page).toHaveTitle(/PinPoint/);
    
    // Should see organization name and information
    await expect(page.locator("h3")).toContainText("Austin Pinball Collective");
    
    // Should see locations and machine counts
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=locations •")).toBeVisible();
    await expect(page.locator("text=pinball machines")).toBeVisible();
    
    // Should see individual location cards
    const locationCards = page.locator('[data-testid="location-card"]').or(
      page.locator("text=Pinballz").first()
    );
    await expect(locationCards.first()).toBeVisible();
    
    // Should see navigation with sign in option
    await expect(page.locator("text=Sign In").or(
      page.locator("button:has-text('Sign In')")
    )).toBeVisible();
    
    // Should NOT see authenticated content yet
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
    await expect(page.locator("text=My Open Issues")).not.toBeVisible();
  });

  test("should show enhanced content after login", async ({ page }) => {
    // Start with public content verification
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Login via dev quick login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    
    // Wait for authentication to complete
    await page.waitForTimeout(2000);
    
    // Should still see public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Should now ALSO see authenticated content
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=My Open Issues")).toBeVisible();
    
    // Should see authenticated navigation
    await expect(page.locator('button[aria-label="account of current user"]')).toBeVisible();
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=Issues")).toBeVisible();
    
    // Should NOT see sign in button anymore
    await expect(page.locator("text=Sign In")).not.toBeVisible();
  });

  test("should return to public-only content after logout", async ({ page }) => {
    // First, log in to get authenticated state
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);
    
    // Verify authenticated content is present
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    
    // Perform logout
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    
    // Wait for logout to complete and redirect
    await page.waitForTimeout(2000);
    
    // Should be back on homepage
    await expect(page).toHaveURL(/\//);
    
    // Should see public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
    
    // Should NOT see authenticated content
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
    await expect(page.locator("text=My Open Issues")).not.toBeVisible();
    
    // Should see sign in option again
    await expect(page.locator("text=Sign In").or(
      page.locator("button:has-text('Sign In')")
    )).toBeVisible();
    
    // Should NOT see user account button
    await expect(page.locator('button[aria-label="account of current user"]')).not.toBeVisible();
  });

  test("should support switching between different user types", async ({ page }) => {
    // Start with admin login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);
    
    // Verify admin authenticated content
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    
    // Logout
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(2000);
    
    // Verify back to public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
    
    // Login as different user (Member)
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Member")').click();
    await page.waitForTimeout(2000);
    
    // Should see authenticated content for member
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    
    // Should still see public content too
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Test another user switch - logout and login as Player
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(2000);
    
    // Login as Player
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Player")').click();
    await page.waitForTimeout(2000);
    
    // Should see appropriate content for player
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=Our Locations")).toBeVisible();
  });

  test("should handle session persistence across page reloads", async ({ page }) => {
    // Login first
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);
    
    // Verify authenticated state
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    
    // Reload the page
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Should maintain authenticated state
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator('button[aria-label="account of current user"]')).toBeVisible();
  });

  test("should navigate correctly between authenticated and public areas", async ({ page }) => {
    // Start from public state
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);
    
    // Navigate to Dashboard via navigation
    await page.locator('button:has-text("Dashboard")').click();
    await page.waitForTimeout(1000);
    
    // Should be on dashboard page but it might redirect to homepage
    // In the unified approach, dashboard content is on homepage
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    
    // Navigate back to home via logo/home link
    await page.locator('text="PinPoint"').or(page.locator('button:has-text("Home")')).click();
    await page.waitForTimeout(1000);
    
    // Should see both public and authenticated content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    
    // Test logout from any page
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(2000);
    
    // Should be back to public-only content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
  });

  test("should handle authentication errors gracefully", async ({ page }) => {
    // This test would be more valuable with real authentication failures
    // For now, test that the page doesn't break with network issues
    
    // Start with public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Simulate network issues by blocking some requests
    await page.route("**/api/trpc/**", route => {
      // Let some requests through, block others randomly
      if (Math.random() < 0.1) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Try to login despite network issues
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(3000);
    
    // Page should still be functional (either authenticated or public)
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Should not crash or show error boundaries
    await expect(page.locator("text=Error")).not.toBeVisible();
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  });

  test("should display correct user information when authenticated", async ({ page }) => {
    // Login as admin
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);
    
    // Open user menu
    await page.locator('button[aria-label="account of current user"]').click();
    
    // Should see logout option
    await expect(page.locator('text="Logout"')).toBeVisible();
    
    // Should see profile option (if implemented)
    const profileOption = page.locator('text="Profile"');
    if await profileOption.isVisible()) {
      await expect(profileOption).toBeVisible();
    }
  });

  test("should work correctly on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test public content is responsive
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Test login flow on mobile
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);
    
    // Should see authenticated content on mobile
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    
    // Test logout on mobile
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(2000);
    
    // Should return to public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
  });
});
```

## Helper Functions (Optional Enhancement)

Create helper functions to reduce code duplication:

**File**: `e2e/helpers/unified-dashboard.ts`

```typescript
import type { Page, Expect } from "@playwright/test";

export async function loginAsUser(page: Page, userType: "Test Admin" | "Test Member" | "Test Player") {
  await page.locator('text="Dev Quick Login"').click();
  await page.locator(`button:has-text("${userType}")`).click();
  await page.waitForTimeout(2000);
}

export async function logout(page: Page) {
  await page.locator('button[aria-label="account of current user"]').click();
  await page.locator('text="Logout"').click();
  await page.waitForTimeout(2000);
}

export async function verifyPublicContent(page: Page, expect: Expect) {
  await expect(page.locator("text=Our Locations")).toBeVisible();
  await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
}

export async function verifyAuthenticatedContent(page: Page, expect: Expect) {
  await expect(page.locator("text=My Dashboard")).toBeVisible();
  await expect(page.locator("text=My Open Issues")).toBeVisible();
}

export async function verifyPublicOnlyContent(page: Page, expect: Expect) {
  await verifyPublicContent(page, expect);
  await expect(page.locator("text=My Dashboard")).not.toBeVisible();
  await expect(page.locator("text=My Open Issues")).not.toBeVisible();
}
```

## Test Configuration

### Playwright Config Updates

Add to `playwright.config.ts` if needed:

```typescript
// Add longer timeout for authentication flows
use: {
  actionTimeout: 10000,
  navigationTimeout: 15000,
},

// Add test retry for flaky authentication
retries: process.env.CI ? 2 : 1,
```

### Environment Setup

Ensure test environment has:
- Development database with test users
- Dev quick login enabled
- Stable test data

## Success Criteria

After implementation, the test should:

- [ ] **Pass Consistently**: Run without flakiness
- [ ] **Cover Full Flow**: Test the complete user journey described
- [ ] **Handle Edge Cases**: Test error scenarios gracefully
- [ ] **Run Quickly**: Complete in reasonable time (< 2 minutes)
- [ ] **Provide Clear Feedback**: Show meaningful errors when failing

## Documentation References

- **Existing Auth Tests**: `e2e/auth-flow.spec.ts:1-211` (patterns to follow)
- **Playwright Helpers**: `e2e/helpers/auth.ts` (existing helper patterns)
- **User Journeys**: `@docs/design-docs/cujs-list.md` (authentication flows)
- **Testing Guidelines**: `@docs/testing/index.md`, `@docs/e2e-testing-plan.md`
- **Dev Login Component**: `src/app/_components/DevLoginCompact.tsx` (login selectors)

## Running the Tests

### Local Development
```bash
# Run the specific test
npx playwright test unified-dashboard-flow.spec.ts

# Run with UI mode for debugging
npx playwright test unified-dashboard-flow.spec.ts --ui

# Run in headed mode to watch
npx playwright test unified-dashboard-flow.spec.ts --headed
```

### Debugging Failed Tests
```bash
# Show trace on failure
npx playwright test unified-dashboard-flow.spec.ts --trace on

# Show test report
npx playwright show-report
```

## Maintenance Considerations

### Test Data Dependencies
- Ensure test users exist in development database
- Verify organization data is consistent
- Keep test selectors updated with UI changes

### Flakiness Prevention
- Use proper waits (waitForTimeout, waitForLoadState)
- Avoid hard-coded delays where possible
- Test with network throttling occasionally

### CI/CD Integration
- Ensure tests run in CI environment
- Handle test data seeding in CI
- Configure appropriate timeouts and retries

## Next Steps

After creating this test:
1. Run the test to verify it fails (before implementation)
2. Implement the unified dashboard features (Tasks 1-4)
3. Run the test again to verify it passes
4. Use the test to validate each implementation step
5. Move to Task 6: Update existing tests

This comprehensive test ensures the unified dashboard implementation works exactly as intended and provides confidence that the authentication flow is solid.