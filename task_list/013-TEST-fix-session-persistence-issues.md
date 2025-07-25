# Task 013: Fix Session Persistence Issues with Dashboard Visibility

**Priority**: MEDIUM  
**Category**: Testing  
**Status**: 🔧 PENDING  
**Dependencies**: None (newly identified issue)

## Problem

Two e2e tests are failing due to session persistence issues where "My Dashboard" content is not showing after authentication. The authentication appears to succeed, but the authenticated dashboard content is not rendered consistently.

## Current State Analysis

**Failing Tests:**

1. `unified-dashboard-flow.spec.ts:170` - "should handle session persistence across page reloads"
2. `unified-dashboard-flow.spec.ts:194` - "should navigate correctly between authenticated and public areas"

**Error Pattern:**

```
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
Locator: locator('text=My Dashboard')
Expected: visible
Received: <element(s) not found>
```

**Authentication Flow:**

- Dev Quick Login works (button clicks succeed)
- Session appears to be established (no auth errors)
- But authenticated dashboard content ("My Dashboard") doesn't render

## Root Cause Investigation Needed

1. **Session State vs UI State**
   - Authentication succeeds but UI doesn't update to show authenticated content
   - Possible race condition between session establishment and UI rendering
   - May need longer wait times or different wait conditions

2. **Page Reload Timing**
   - Dev login triggers `window.location.reload()` in DevLoginCompact.tsx:50
   - Tests may be checking for content before reload completes
   - Need to wait for reload and re-rendering to finish

3. **Unified Dashboard Logic**
   - Dashboard shows different content based on authentication state
   - May be a timing issue with session detection in dashboard component
   - Could be SSR vs client-side hydration timing issue

## Implementation Steps

### Phase 1: Diagnosis

1. **Analyze Dashboard Component**
   - Find the component that renders "My Dashboard" content
   - Check how it detects authentication state
   - Identify session vs UI state synchronization

2. **Review Wait Conditions**
   - Current tests use `page.waitForTimeout(3000)` after login
   - May need to wait for specific UI state changes instead
   - Add proper wait conditions for authenticated content

3. **Test Reload Timing**
   - Verify that `window.location.reload()` completes before test continues
   - Check if tests need to wait for navigation events
   - Ensure page load state is fully settled

### Phase 2: Fix Implementation

1. **Enhanced Wait Strategies**

   ```typescript
   // Instead of fixed timeout, wait for authenticated content
   await expect(page.locator('text="My Dashboard"')).toBeVisible({
     timeout: 10000,
   });

   // Or wait for page reload to complete
   await page.waitForLoadState("networkidle");
   ```

2. **Session State Verification**
   - Add verification that session is properly established
   - Check for session-related elements beyond just dashboard content
   - Ensure authentication state is consistent

3. **UI State Synchronization**
   - Address any race conditions between session and UI updates
   - Add proper loading states or fallbacks
   - Ensure SSR/hydration doesn't cause content flashing

### Phase 3: Validation

1. **Test Reliability**
   - Run failing tests multiple times to verify fixes
   - Test across different browsers and conditions
   - Ensure no regressions in working auth tests

## Success Criteria

- [ ] "My Dashboard" content appears consistently after authentication
- [ ] Session persistence tests pass reliably (>99% success rate)
- [ ] Page reload scenarios work correctly
- [ ] No regressions in other authentication flows
- [ ] Tests complete within reasonable timeouts

## Expected Files to Modify

- Dashboard/homepage component (location TBD)
- `e2e/unified-dashboard-flow.spec.ts` (wait conditions)
- `e2e/helpers/unified-dashboard.ts` (helper functions)
- Possibly authentication-related components

## Testing Strategy

1. **Isolated Testing**: Run only the 2 failing tests repeatedly
2. **Wait Condition Testing**: Experiment with different wait strategies
3. **Session Debugging**: Add logging to understand session timing
4. **Cross-browser Validation**: Ensure fixes work in all browsers

## References

- **Failing Tests**: `e2e/unified-dashboard-flow.spec.ts:170,194`
- **Dev Login Component**: `src/app/_components/DevLoginCompact.tsx:50`
- **Authentication Flow**: Session establishment after `window.location.reload()`
- **Dashboard Logic**: Component that renders "My Dashboard" (needs identification)

## Context from E2E Test Analysis

From recent test run:

- Authentication mechanism works (no login failures)
- Issue is specifically with authenticated content visibility
- Affects 2 tests in unified-dashboard-flow.spec.ts
- Not affecting auth-flow.spec.ts tests (which all pass)
- Appears to be timing/synchronization issue rather than auth failure
