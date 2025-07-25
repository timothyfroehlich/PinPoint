# Task 011: Add Retry Logic for Flaky Authentication Tests

**Priority**: MEDIUM  
**Category**: Testing  
**Status**: 🔧 PENDING  
**Dependencies**: Tasks 009-010 (Auth consistency and mobile viewport fixes)

## Problem

Authentication tests are occasionally flaky due to timing issues, network conditions, or browser state inconsistencies. While the auth system works reliably in manual testing, automated tests sometimes fail due to race conditions or environmental factors beyond our control.

## Current State Analysis

From previous e2e test analysis:

- Authentication generally works but occasionally fails in CI environments
- Timing issues around session establishment and page reloads
- Network conditions can affect authentication API calls
- Browser state cleanup between tests isn't always perfect
- Tests expect immediate authentication state but may need wait conditions

## Root Cause Analysis

### Common Flaky Test Patterns

1. **Timing Issues**: Authentication involves page reloads and async state updates
2. **Network Variability**: Dev Quick Login API calls may be slower in CI
3. **Session Persistence**: Browser session state may not persist consistently
4. **Page Load States**: Tests may run before authentication completes fully

### Specific Failure Scenarios

- Authentication appears successful but session state not yet available
- Page reloads during auth don't complete before test continues
- Network requests timeout in slow CI environments
- Browser clearing sessions between test runs inconsistently

## Implementation Steps

### Phase 1: Enhanced Wait Strategies

1. **Smart Authentication Waits**

   ```typescript
   const waitForAuthentication = async (page: Page, timeout = 10000) => {
     await page.waitForFunction(
       () => {
         // Wait for session to be available and user menu to appear
         const userMenu = document.querySelector(
           'button[aria-label="account of current user"]',
         );
         const devLogin = document.querySelector('text="Dev Quick Login"');
         return userMenu && !devLogin;
       },
       { timeout },
     );
   };
   ```

2. **Network-Aware Waits**
   - Wait for authentication API calls to complete
   - Ensure session establishment before proceeding
   - Add retry logic for failed network requests
   - Monitor authentication-related network activity

3. **State Verification**
   - Verify authentication state before continuing with tests
   - Check for both UI changes and underlying session state
   - Ensure user permissions are loaded and available
   - Validate organization context is properly set

### Phase 2: Retry Mechanisms

1. **Authentication Helper Retries**

   ```typescript
   const loginWithRetry = async (
     page: Page,
     userType: "Test Admin" | "Test Member" | "Test Player",
     maxRetries = 3,
   ) => {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         await logout(page); // Clean state
         await page.goto("/");
         await page.locator('text="Dev Quick Login"').click();
         await page.locator(`button:has-text("${userType}")`).click();

         // Enhanced wait with timeout
         await waitForAuthentication(page);

         // Verify success
         await expect(page.locator('text="My Dashboard"')).toBeVisible({
           timeout: 5000,
         });
         return; // Success
       } catch (error) {
         if (attempt === maxRetries) throw error;
         console.log(`Auth attempt ${attempt} failed, retrying...`);
         await page.waitForTimeout(1000 * attempt); // Exponential backoff
       }
     }
   };
   ```

2. **Test-Level Retry Configuration**
   - Configure Playwright retry settings specifically for auth tests
   - Add custom retry logic for authentication-dependent operations
   - Implement exponential backoff for retry delays
   - Log retry attempts for debugging

3. **Session Recovery**
   - Add session recovery mechanisms for failed auth states
   - Clear and re-establish sessions on retry attempts
   - Verify session integrity before test operations
   - Handle partial authentication states gracefully

### Phase 3: Robust Test Patterns

1. **Idempotent Test Setup**
   - Ensure tests can be run multiple times safely
   - Clear all state thoroughly between test attempts
   - Make authentication setup repeatable and reliable
   - Handle edge cases in session management

2. **Environment-Aware Configuration**

   ```typescript
   // Adjust timeouts based on environment
   const getTimeouts = () => {
     if (process.env.CI) {
       return { auth: 15000, navigation: 10000 };
     }
     return { auth: 8000, navigation: 5000 };
   };
   ```

3. **Enhanced Error Reporting**
   - Capture detailed error information on auth failures
   - Take screenshots on authentication retry attempts
   - Log network activity during authentication
   - Provide actionable error messages for debugging

## Success Criteria

- [ ] Authentication tests have < 1% flake rate in CI
- [ ] Retry logic gracefully handles temporary failures
- [ ] Tests provide clear error messages when auth fails
- [ ] No increase in total test execution time due to retries
- [ ] Retry logic works across all user types (Admin, Member, Player)
- [ ] CI environment has reliable authentication test execution

## Expected Files to Modify

- `e2e/helpers/auth.ts` (enhanced retry logic)
- `e2e/helpers/unified-dashboard.ts` (robust wait strategies)
- `e2e/auth-flow.spec.ts` (retry-aware test patterns)
- `playwright.config.ts` (retry configuration)
- `e2e/helpers/test-utils.ts` (new utilities for retry patterns)

## Testing Strategy

### Retry Logic Validation

1. **Simulated Failure Testing**
   - Temporarily introduce artificial delays/failures
   - Verify retry logic activates correctly
   - Test exponential backoff behavior
   - Ensure max retry limits are respected

2. **CI Environment Testing**
   - Run tests multiple times in CI to verify reliability
   - Test with network throttling to simulate slow conditions
   - Verify retry logic works under CI resource constraints
   - Monitor test execution time impact

### Performance Impact Assessment

- Measure baseline test execution time before changes
- Ensure retries don't significantly increase successful test time
- Optimize retry delays to balance reliability vs speed
- Monitor overall test suite execution time

## Implementation Phases

### Phase 1: Core Retry Infrastructure (High Priority)

- Enhanced wait strategies for authentication
- Basic retry logic in auth helpers
- Improved error handling and reporting

### Phase 2: Advanced Retry Patterns (Medium Priority)

- Environment-aware configuration
- Exponential backoff strategies
- Session recovery mechanisms

### Phase 3: Optimization and Monitoring (Low Priority)

- Performance optimization of retry logic
- Advanced logging and metrics
- CI-specific configuration tuning

## References

- **Playwright Retry Documentation**: https://playwright.dev/docs/test-retries
- **Auth Helpers**: `e2e/helpers/auth.ts`
- **Current Auth Tests**: `e2e/auth-flow.spec.ts`
- **CI Configuration**: `.github/workflows/` (CI environment context)
- **Network Conditions**: Playwright network emulation docs

## Context from Previous Analysis

From the e2e test cleanup session:

- Authentication works reliably in manual testing
- Automated tests occasionally fail due to timing/environmental factors
- Need retry mechanisms that don't mask real authentication issues
- Focus on making CI test execution more reliable while maintaining fast feedback
