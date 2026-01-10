# Testing Recommendations for Issue Dropdown Components

## Overview

This document outlines testing recommendations for the newly implemented rich dropdown components. While manual testing requires a running application with database, this guide helps ensure comprehensive test coverage once the environment is available.

## Unit Testing

### Component Testing (Recommended)

#### StatusSelect Component

```typescript
describe("StatusSelect", () => {
  it("should render with correct initial value", () => {
    // Test that component displays current status correctly
  });

  it("should show grouped statuses in dropdown", () => {
    // Verify "New", "In Progress", and "Closed" groups exist
  });

  it("should display tooltips on hover", () => {
    // Check tooltip content matches STATUS_CONFIG descriptions
  });

  it("should call onValueChange when option selected", () => {
    // Verify callback is triggered with correct value
  });

  it("should respect disabled prop", () => {
    // Ensure component is non-interactive when disabled
  });

  it("should display correct icon for each status", () => {
    // Verify Circle, CircleDot, and Disc icons appear appropriately
  });
});
```

#### SeveritySelect, PrioritySelect, ConsistencySelect

Similar test patterns as StatusSelect, without tooltip tests:

- Initial value rendering
- Icon display
- onValueChange callback
- Disabled state
- Option list completeness

### Integration Testing

#### Update Form Integration

```typescript
describe("Update Forms Integration", () => {
  it("should auto-submit form on status change", () => {
    // Verify form.requestSubmit() is called
  });

  it("should show loading indicator during submission", () => {
    // Check isPending state displays Loader2 icon
  });

  it("should display success message after update", () => {
    // Verify success feedback appears
  });

  it("should display error message on failure", () => {
    // Verify error handling works
  });

  it("should maintain selected value in state", () => {
    // Check useState updates correctly
  });
});
```

#### Unified Report Form Integration

```typescript
describe("Unified Report Form", () => {
  it("should update hidden input when select changes", () => {
    // Verify hidden input value matches select
  });

  it("should persist values in localStorage", () => {
    // Check form state persistence
  });

  it("should restore values from localStorage", () => {
    // Verify state restoration on mount
  });

  it("should submit all field values correctly", () => {
    // Check form submission includes all select values
  });
});
```

## E2E Testing (Playwright)

### Smoke Tests

```typescript
test.describe("Issue Dropdowns - Smoke", () => {
  test("should render status dropdown on issue page", async ({ page }) => {
    // Navigate to issue detail page
    // Verify status dropdown exists and is interactive
  });

  test("should update status successfully", async ({ page }) => {
    // Open dropdown, select new status
    // Verify API call and UI update
  });
});
```

### Comprehensive E2E Tests

```typescript
test.describe("Issue Dropdowns - Full Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Create test machine and issue
  });

  test("should display all status options with icons", async ({ page }) => {
    await page.goto("/m/MM/i/1");
    await page.getByTestId("issue-status-select").click();

    // Verify all 11 statuses appear
    const newStatuses = ["new", "confirmed"];
    const inProgressStatuses = [
      "in_progress",
      "need_parts",
      "need_help",
      "wait_owner",
    ];
    const closedStatuses = [
      "fixed",
      "wont_fix",
      "wai",
      "no_repro",
      "duplicate",
    ];

    for (const status of [
      ...newStatuses,
      ...inProgressStatuses,
      ...closedStatuses,
    ]) {
      await expect(page.getByTestId(`status-option-${status}`)).toBeVisible();
    }
  });

  test("should show tooltips for status options", async ({ page }) => {
    await page.goto("/m/MM/i/1");
    await page.getByTestId("issue-status-select").click();

    // Hover over first status option
    await page.getByTestId("status-option-new").hover();

    // Verify tooltip appears with description
    await expect(page.getByText("Just reported, needs triage")).toBeVisible();
  });

  test("should update severity with auto-submit", async ({ page }) => {
    await page.goto("/m/MM/i/1");

    // Click severity dropdown
    await page.getByTestId("issue-severity-select").click();

    // Select 'major'
    await page.getByTestId("severity-option-major").click();

    // Verify loading indicator appears
    await expect(
      page.locator('[data-form="update-severity"] .animate-spin')
    ).toBeVisible();

    // Verify severity updated in UI
    await expect(page.getByTestId("issue-severity-select")).toContainText(
      "Major"
    );
  });

  test("should submit report with all dropdown selections", async ({
    page,
  }) => {
    await page.goto("/report");

    // Fill form
    await page.getByLabel("Machine").selectOption("test-machine-id");
    await page.getByLabel("Issue Title").fill("Test issue");

    // Select severity
    await page.getByTestId("severity-select").click();
    await page.getByTestId("severity-option-major").click();

    // Select consistency
    await page.getByTestId("consistency-select").click();
    await page.getByTestId("consistency-option-frequent").click();

    // Submit
    await page.getByRole("button", { name: /submit/i }).click();

    // Verify redirect to success page
    await expect(page).toHaveURL(/\/report\/success/);
  });

  test("should maintain accessibility via keyboard navigation", async ({
    page,
  }) => {
    await page.goto("/m/MM/i/1");

    // Tab to status dropdown
    await page.keyboard.press("Tab");
    // ... navigate to dropdown
    await page.keyboard.press("Enter");

    // Arrow down to next option
    await page.keyboard.press("ArrowDown");

    // Select with Enter
    await page.keyboard.press("Enter");

    // Verify update occurred
  });
});
```

## Visual Regression Testing

### Key Screenshots to Capture

1. **Status Dropdown - Closed State**
   - Verify icon and label display

2. **Status Dropdown - Open State**
   - Verify all groups and separators
   - Check icon colors and alignment

3. **Status Dropdown - Hover State**
   - Verify tooltip appearance and content

4. **Multiple Dropdowns in Form**
   - Unified report form with all selects
   - Issue detail page with all update forms

5. **Loading States**
   - Spinner position during auto-submit

6. **Responsive Views**
   - Mobile viewport
   - Tablet viewport
   - Desktop viewport

## Manual Testing Checklist

### StatusSelect

- [ ] All 11 statuses appear in correct groups
- [ ] Icons match expected types (Circle, CircleDot, Disc)
- [ ] Colors match STATUS_CONFIG definitions
- [ ] Tooltips show on hover with correct descriptions
- [ ] Group separators are visible
- [ ] Group headers display correctly
- [ ] Selection updates trigger value
- [ ] Disabled state works properly

### SeveritySelect

- [ ] All 4 severity levels display
- [ ] AlertTriangle icon appears for each
- [ ] Colors progress from light to dark amber
- [ ] Selection triggers form submission
- [ ] Icon visible in closed trigger state

### PrioritySelect

- [ ] All 3 priority levels display
- [ ] TrendingUp icon appears for each
- [ ] Colors match purple gradient
- [ ] Selection triggers form submission
- [ ] Only visible for admin/member roles in report form

### ConsistencySelect

- [ ] All 3 consistency options display
- [ ] Repeat icon appears for each
- [ ] Colors match cyan gradient
- [ ] Selection triggers form submission

### Form Integration

- [ ] Auto-submit works on update forms
- [ ] Loading indicators display during submission
- [ ] Success/error messages appear appropriately
- [ ] Values persist in localStorage (report form)
- [ ] Hidden inputs maintain correct values
- [ ] Form validation works with new components

### Accessibility

- [ ] Keyboard navigation works (Tab, Arrow keys, Enter)
- [ ] Screen reader announces options correctly
- [ ] Focus indicators are visible
- [ ] ARIA labels are present
- [ ] Tooltips accessible via keyboard
- [ ] Color contrast meets WCAG standards

### Cross-Browser Testing

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Performance Considerations

- Monitor render time with large option lists
- Check tooltip performance on rapid hover
- Verify no memory leaks with multiple selects
- Test form submission performance with auto-submit

## Accessibility Standards Compliance

### WCAG 2.1 Level AA Requirements

- Color contrast ratios for all text
- Keyboard accessibility
- Focus indicators
- Screen reader compatibility
- Touch target sizes (minimum 44x44px)
- No keyboard traps
- Semantic HTML structure

## Notes for QA Team

1. **Database Required**: Full testing requires running app with Supabase connection
2. **Test Data**: Need at least one machine and one issue in test database
3. **User Roles**: Test with guest, member, and admin accounts
4. **Edge Cases**: Try with very long status/severity labels (localization)
5. **Network Conditions**: Test with slow 3G to verify loading states
6. **Error Scenarios**: Test with server errors to verify error handling

## Regression Testing

After implementing, verify these existing features still work:

- Issue creation flow
- Issue filtering by status
- Status badges throughout app
- Machine status calculations
- Dashboard statistics
- Notification triggers for status changes
- API endpoint responses
