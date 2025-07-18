# Task: Test Agent - Issue Detail Page

## Mission Statement

Create comprehensive tests for the Issue Detail page (/issues/{issueId}) rebuild following TDD principles. Write tests that will initially fail, covering all user journeys, permissions, and edge cases.

## Context

- Issue Detail page is a critical component showing detailed issue information
- Must handle both public and authenticated views with different permission levels
- Includes comments, status changes, internal notes, and permission-based controls
- Reference designs in `/docs/design-docs/ui-architecture-plan.md`
- Follow user journeys in `/docs/design-docs/cujs-list.md`

## Implementation Steps

### 1. Unit Tests Setup

Create test files for:

- `src/app/issues/[issueId]/page.test.tsx` - Page component tests
- `src/app/api/issues/[issueId]/route.test.ts` - API route tests
- Update `src/server/api/routers/__tests__/issue.test.ts` - tRPC router tests

### 2. Component Tests

Test the following scenarios:

- **Public View**: Unauthenticated user sees only public information
- **Member View**: Basic authenticated user capabilities
- **Technician View**: Status changes, assignments, comments
- **Admin View**: All controls enabled
- **Loading States**: Skeleton loaders, suspense boundaries
- **Error States**: 404, permission denied, network errors

### 3. API Tests

- GET issue details with permission filtering
- Update operations with permission checks
- Comment creation with identity tracking
- Status change validations
- Comment visibility (all public for beta)

### 4. Playwright E2E Test Scaffolds

**Important**: These tests will fail initially. Use `test.skip()` or `test.fixme()` to prevent CI failures. The implementation agent will complete these with proper selectors and remove the skip flags.

#### Public User Journey (`e2e/issues/issue-detail-public.spec.ts`)

```typescript
import { test, expect } from "@playwright/test";

test.describe("Issue Detail - Public User", () => {
  test.fixme("navigates from QR code to issue detail", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    await page.goto("/issues/test-issue-1");

    // Expected elements (add data-testid attributes during implementation)
    await expect(page.locator('[data-testid="issue-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="issue-status"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="issue-description"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="public-comments"]')).toBeVisible();

    // Should NOT see admin controls without permissions
    await expect(
      page.locator('[data-testid="edit-issue-button"]'),
    ).not.toBeVisible();
  });
});
```

#### Technician Journey (`e2e/issues/issue-detail-technician.spec.ts`)

```typescript
test.describe("Issue Detail - Technician", () => {
  test.skip("manages issue lifecycle", async ({ page }) => {
    // TODO: Implementation agent - complete authentication and selectors
    // await loginAsTechnician(page);
    // await page.goto('/issues/test-issue-1');
    // Document expected flow:
    // 1. Change status dropdown
    // 2. Add comment
    // 3. Assign to user
    // 4. Save changes
    // 5. Verify activity log updated
  });
});
```

#### Permission Tests (`e2e/issues/issue-detail-permissions.spec.ts`)

```typescript
test.describe("Issue Detail - Permissions", () => {
  // Use test.fixme to indicate these need implementation
  test.fixme("shows edit button only with edit_issue permission");
  test.fixme("shows close button only with close_issue permission");
  test.fixme("shows assign control only with assign_issue permission");
  test.fixme("displays permission tooltips on disabled buttons");
});
```

### 5. Test Data Factories

Create factory functions for:

- Issues with various states
- Comments (public and internal)
- Users with different roles
- Permission configurations

## Quality Requirements

- Tests must be isolated and not depend on database state
- Use proper mocking for external dependencies
- Follow existing test patterns in the codebase
- Include accessibility tests (aria labels, keyboard navigation)
- Test responsive behavior for mobile views

## Success Criteria

- [ ] All unit tests written and failing (red phase of TDD)
- [ ] Integration tests cover component interactions
- [ ] Playwright test scaffolds created with `test.skip()` or `test.fixme()`
- [ ] Test scenarios clearly documented for implementation agent
- [ ] Expected selectors documented (data-testid attributes)
- [ ] Test data factories created for reusability
- [ ] Tests committed with `--no-verify` flag
- [ ] Branch pushed to remote

## Handoff Notes for Implementation Agent

1. Playwright tests are scaffolded but will fail
2. Add `data-testid` attributes to components as documented
3. Complete authentication helpers for E2E tests
4. Remove `test.skip()` and `test.fixme()` as you implement
5. Ensure all E2E tests pass before marking complete

## Library Version Notes

- **MUI v7.2.0**: Check Context7 for latest component testing patterns
- **Playwright**: Use built-in test generators where helpful
- **Testing Library**: Follow user-centric testing approach

## Completion Instructions

When your task is complete:

1. Run `npm run test` to ensure tests execute (they should fail)
2. Run `npx playwright test` for E2E tests
3. Commit: `git commit -m "test: comprehensive tests for issue detail page" --no-verify`
4. Push: `git push -u origin task/rebuild-issue-detail-page`
5. Notify the orchestrator - DO NOT clean up the worktree yourself
