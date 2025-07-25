# Task 6: Update Existing Tests

## Overview
Update existing Playwright tests to work with the new unified dashboard approach. The current tests expect a login-only homepage and separate dashboard, but now we have a unified dashboard that shows public content to everyone and enhanced content to authenticated users.

## Priority: Low
Important for maintaining test suite integrity, but not critical for functionality.

## Current Test Issues

### Tests That Need Updates

1. **`e2e/dashboard.spec.ts`** - Expects login modal on homepage
2. **`e2e/auth-flow.spec.ts`** - Expects homepage to be login-only  
3. **Other E2E tests** - May expect specific authentication flows

### Problems with Current Tests

- **Dashboard Test**: Expects login modal immediately on homepage
- **Auth Flow Test**: Assumes homepage requires authentication
- **Navigation Tests**: May expect different navigation structure
- **Session Tests**: May not account for public content loading

## Files to Update

### 1. **Update**: `e2e/dashboard.spec.ts`
### 2. **Update**: `e2e/auth-flow.spec.ts` 
### 3. **Review**: Other test files for compatibility
### 4. **Create**: Updated test patterns/helpers

## Implementation Steps

### Step 1: Update Dashboard Test

**File**: `e2e/dashboard.spec.ts`

**Current State**: Tests for login modal on homepage
**Target State**: Tests for public dashboard content

```typescript
import { test, expect } from "@playwright/test";

test.describe("Dashboard Page", () => {
  test("should load public dashboard content", async ({ page }) => {
    await page.goto("/");

    // Should have PinPoint title
    await expect(page).toHaveTitle(/PinPoint/);
    
    // Should see organization information (public content)
    await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
    
    // Should see locations section
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Should see location and machine counts
    await expect(page.locator("text=locations •")).toBeVisible();
    await expect(page.locator("text=pinball machines")).toBeVisible();
    
    // Should see navigation with sign in option (not login modal)
    await expect(page.locator("text=Sign In").or(
      page.locator("button:has-text('Sign In')")
    )).toBeVisible();
  });

  test("should show enhanced content when authenticated", async ({ page }) => {
    await page.goto("/");
    
    // Verify public content loads first
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Login via dev quick login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);
    
    // Should still see public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Should now also see authenticated content
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=My Open Issues")).toBeVisible();
  });

  test("should handle loading states gracefully", async ({ page }) => {
    await page.goto("/");
    
    // Public content should load without authentication
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Should not show generic loading states for public content
    await expect(page.locator("text=Loading...")).not.toBeVisible();
  });
});
```

### Step 2: Update Auth Flow Test

**File**: `e2e/auth-flow.spec.ts`

Key changes needed:

```typescript
import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsRegularUser, logout } from "./helpers/auth";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await logout(page);
  });

  test("should load public content when not authenticated", async ({ page }) => {
    await page.goto("/");

    // Should see the public dashboard (not just login modal)
    await expect(page).toHaveTitle(/PinPoint/);

    // Should see public organization content
    await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Should see Dev Quick Login in development
    await expect(page.locator('text="Dev Quick Login"')).toBeVisible();

    // Should see sign in option in navigation
    await expect(page.locator("text=Sign In").or(
      page.locator("button:has-text('Sign In')")
    )).toBeVisible();

    // Should NOT see authenticated content
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
    await expect(page.locator("text=My Open Issues")).not.toBeVisible();
  });

  test("should authenticate as admin and show enhanced dashboard", async ({
    page,
  }) => {
    // Start with public content
    await page.goto("/");
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Use dev quick login for admin
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);

    // Should remain on homepage (unified dashboard)
    await expect(page).toHaveURL(/\//);
    await expect(page).toHaveTitle(/PinPoint/);

    // Should see public content (still visible)
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Should see enhanced authenticated content
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=My Open Issues")).toBeVisible();

    // Should see authenticated navigation
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();
    await expect(page.locator("button", { hasText: "Dashboard" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Issues" })).toBeVisible();
  });

  test("should handle logout properly", async ({ page }) => {
    // Login as admin first
    await page.goto("/");
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(2000);

    // Verify authenticated state
    await expect(page.locator("text=My Dashboard")).toBeVisible();

    // Perform logout via user menu
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();

    // Wait for logout to complete
    await page.waitForTimeout(2000);

    // Should be redirected to homepage with public content
    await expect(page).toHaveURL(/\//);
    await expect(page.locator("text=Our Locations")).toBeVisible();
    
    // Should NOT see authenticated content anymore
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
    
    // Should see sign in option again
    await expect(page.locator("text=Sign In").or(
      page.locator("button:has-text('Sign In')")
    )).toBeVisible();
  });

  // Update other tests similarly...
  test("should authenticate as member with standard permissions", async ({
    page,
  }) => {
    await page.goto("/");
    
    // Should see public content first
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Use dev quick login for member
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Member")').click();
    await page.waitForTimeout(2000);

    // Should remain on homepage with enhanced content
    await expect(page).toHaveURL(/\//);
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=Our Locations")).toBeVisible();
  });

  // Continue updating other tests with similar patterns...
});
```

### Step 3: Update Auth Helper Functions

**File**: `e2e/helpers/auth.ts`

Update helper functions to work with unified dashboard:

```typescript
import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator('text="Dev Quick Login"').click();
  await page.locator('button:has-text("Test Admin")').click();
  await page.waitForTimeout(2000);
}

export async function loginAsRegularUser(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator('text="Dev Quick Login"').click();
  await page.locator('button:has-text("Test Member")').click();
  await page.waitForTimeout(2000);
}

export async function loginAsPlayer(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator('text="Dev Quick Login"').click();
  await page.locator('button:has-text("Test Player")').click();
  await page.waitForTimeout(2000);
}

export async function logout(page: Page): Promise<void> {
  try {
    await page.goto("/");
    
    // Check if user menu exists (user is logged in)
    const userMenu = page.locator('button[aria-label="account of current user"]');
    if (await userMenu.isVisible({ timeout: 1000 })) {
      await userMenu.click();
      await page.locator('text="Logout"').click();
      await page.waitForTimeout(2000);
    }
  } catch (error) {
    // If logout fails, continue - user might already be logged out
    console.log("Logout helper: User might already be logged out");
  }
}

// New helper functions for unified dashboard
export async function verifyPublicDashboard(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  // Add assertions that public content is visible
}

export async function verifyAuthenticatedDashboard(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  // Add assertions that both public AND authenticated content is visible
}
```

### Step 4: Update Other E2E Tests

Review and update other test files as needed:

**Files to Check**:
- `e2e/location-browsing.spec.ts`
- `e2e/member-issue-flow.spec.ts`
- `e2e/qr-code-flow.spec.ts`
- `e2e/issues/*.spec.ts`

**Common Changes Needed**:

1. **Homepage Expectations**: Update tests that expect login modal on `/`
2. **Navigation Expectations**: Update tests that expect certain navigation states
3. **Authentication Flow**: Update tests that assume specific auth redirects
4. **Session Handling**: Update tests to work with unified dashboard

### Example Update Pattern

```typescript
// OLD WAY - expecting login modal
test("should show login modal on homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome to PinPoint")).toBeVisible();
});

// NEW WAY - expecting public dashboard
test("should show public dashboard on homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Our Locations")).toBeVisible();
  await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
});
```

## Test Migration Checklist

For each existing test file:

- [ ] **Update homepage expectations** - Look for public content, not login modal
- [ ] **Update authentication flow** - Tests should work with unified dashboard  
- [ ] **Update navigation tests** - Account for new navigation structure
- [ ] **Update logout tests** - Expect redirect to public homepage
- [ ] **Update session tests** - Handle public content loading
- [ ] **Update error handling** - Tests should gracefully handle auth failures
- [ ] **Update selectors** - Update any changed UI selectors
- [ ] **Update timeouts** - Adjust for new loading patterns

## Common Patterns to Replace

### Pattern 1: Login Modal Expectations
```typescript
// OLD
await expect(page.getByText("Welcome to PinPoint")).toBeVisible();
await expect(page.getByText("Enter your email")).toBeVisible();

// NEW  
await expect(page.locator("text=Our Locations")).toBeVisible();
await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
```

### Pattern 2: Dashboard Redirects
```typescript
// OLD
await loginAsAdmin(page);
await expect(page).toHaveURL(/\/dashboard/);

// NEW
await loginAsAdmin(page);
await expect(page).toHaveURL(/\//); // Stays on homepage
await expect(page.locator("text=My Dashboard")).toBeVisible();
```

### Pattern 3: Logout Expectations
```typescript
// OLD
await logout(page);
// Test expects to stay on same page with errors

// NEW
await logout(page);
await expect(page).toHaveURL(/\//); // Redirects to homepage
await expect(page.locator("text=Our Locations")).toBeVisible();
```

## Running Updated Tests

### Test All Updated Files
```bash
# Run specific updated tests
npx playwright test dashboard.spec.ts
npx playwright test auth-flow.spec.ts

# Run all e2e tests to check for regressions
npx playwright test

# Run with UI mode for debugging
npx playwright test --ui
```

### Debugging Test Failures

1. **Check selectors**: Ensure UI elements match test expectations
2. **Check timing**: Add appropriate waits for new loading patterns
3. **Check state**: Verify tests start from correct initial state
4. **Check assertions**: Update assertions to match new behavior

## Documentation References

- **Current Test Structure**: `e2e/dashboard.spec.ts:3-21`, `e2e/auth-flow.spec.ts:10-36`
- **Test Patterns**: `@docs/testing/index.md`, `@docs/e2e-testing-plan.md`
- **Authentication Testing**: `@docs/testing/troubleshooting.md`
- **UI Changes**: Task 2 and Task 4 documentation for UI structure changes

## Success Criteria

After updating tests:

- [ ] **All tests pass**: No failing tests due to unified dashboard changes
- [ ] **Tests are meaningful**: Tests actually verify the intended behavior  
- [ ] **Tests are stable**: No flaky tests due to timing or state issues
- [ ] **Coverage maintained**: Test coverage doesn't decrease significantly
- [ ] **Fast execution**: Tests run in reasonable time
- [ ] **Clear failures**: When tests fail, error messages are helpful

## Migration Strategy

1. **Run current tests**: Record which tests fail after implementing unified dashboard
2. **Update failing tests**: Fix test expectations to match new behavior
3. **Verify test logic**: Ensure tests still verify meaningful functionality
4. **Run full suite**: Ensure no regressions in other tests
5. **Update documentation**: Update test documentation if needed

## Rollback Plan

If test updates cause issues:

1. **Identify problematic tests**: Which tests are failing or flaky
2. **Temporary disable**: Comment out problematic tests temporarily
3. **Fix incrementally**: Update tests one at a time
4. **Verify each change**: Run tests after each update to isolate issues

## Next Steps

After completing test updates:

1. Run full test suite to ensure no regressions
2. Verify all tests pass consistently (run multiple times)
2. Update any test documentation or README files
3. Consider adding the new comprehensive test (Task 5) to CI/CD pipeline

This ensures the test suite remains valuable and catches regressions while supporting the new unified dashboard architecture.