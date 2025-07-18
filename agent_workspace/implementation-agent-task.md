# Task: Implementation Agent - Issue Detail Page

## Mission Statement

Implement the Issue Detail page (/issues/{issueId}) to make all tests pass. Follow the existing codebase patterns, use the service factory pattern, and ensure all quality gates pass.

## Context

- Tests have been written by the test agent and are currently failing
- Must implement both public and authenticated views
- Permission-based UI elements must be properly controlled
- Follow designs in `/docs/design-docs/ui-architecture-plan.md`
- Use service factory pattern from context (`ctx.services`)

## Implementation Steps

### 1. Review Failing Tests

- Run `npm run test` to see all failing unit/integration tests
- Run `npx playwright test` to see E2E test scaffolds (will be skipped)
- Note the expected selectors documented in Playwright tests
- Prioritize implementation based on test failures

### 2. Page Component Implementation

Create/update `src/app/issues/[issueId]/page.tsx`:

- Server component for data fetching
- Permission checking via auth context
- Proper error boundaries and loading states
- SEO metadata for public issues

### 3. Client Components

Create modular components in `src/components/issues/` with data-testid attributes:

- `IssueDetail.tsx` - Main detail display
  - Add `data-testid="issue-title"`, `data-testid="issue-status"`, etc.
- `IssueComments.tsx` - Comment thread component
  - Add `data-testid="public-comments"`
- `IssueStatusControl.tsx` - Status change UI
  - Add `data-testid="status-dropdown"`
- `IssueActions.tsx` - Edit/Close/Assign buttons
  - Add `data-testid="edit-issue-button"`, `data-testid="close-issue-button"`

### 4. API Implementation

Update `src/server/api/routers/issue.ts`:

```typescript
// Use service factory pattern
const issueService = ctx.services.createIssueService();
const activityService = ctx.services.createIssueActivityService();
```

Key procedures to implement:

- `getById` - Include permission filtering
- `update` - Validate permissions before update
- `addComment` - Track user identity
- `changeStatus` - Log activity, send notifications

### 5. Permission Controls

Implement permission-based UI:

```tsx
<Button
  disabled={!hasPermission("edit_issue")}
  title={
    !hasPermission("edit_issue")
      ? `Requires ${getPermissionName("edit_issue")} permission`
      : ""
  }
>
  Edit Issue
</Button>
```

### 6. State Management

- Use Next.js App Router patterns
- Server components for initial data
- Client components for interactivity
- Optimistic updates with tRPC mutations
- Proper error handling and rollback

### 7. Styling with MUI v7.2.0

```tsx
import Grid from "@mui/material/Grid2"; // Grid2 in v7
<Grid size={{ xs: 12, md: 8 }}>{/* Issue content */}</Grid>;
```

### 8. Mobile Responsiveness

- Ensure touch-friendly controls (44x44px minimum)
- Responsive layout for all screen sizes
- Consider mobile-first design approach

### 9. Complete Playwright Tests

The test agent created E2E test scaffolds. You need to:

1. **Add data-testid attributes** to all interactive elements
2. **Update test selectors** in the Playwright tests to match your implementation
3. **Remove test.skip() and test.fixme()** flags as you complete each test
4. **Add authentication helpers** for tests that require login:
   ```typescript
   async function loginAsTechnician(page: Page) {
     // Implement login flow
   }
   ```
5. **Ensure all E2E tests pass** before considering the task complete

## Quality Requirements

- All tests must pass: `npm run test`
- All E2E tests must pass: `npx playwright test`
- TypeScript compilation: `npm run typecheck`
- Linting: `npm run lint`
- Pre-commit hooks: `npm run pre-commit`
- No usage of `any` type
- Follow existing code patterns

## Success Criteria

- [ ] All unit tests passing (green phase of TDD)
- [ ] All integration tests passing
- [ ] All Playwright E2E tests completed and passing
- [ ] Data-testid attributes added to all key elements
- [ ] Test.skip() and test.fixme() removed from all tests
- [ ] Authentication helpers implemented for E2E tests
- [ ] TypeScript compilation successful
- [ ] ESLint and Prettier checks pass
- [ ] Pre-commit hooks pass
- [ ] Issue detail page fully functional
- [ ] Permission controls working correctly
- [ ] Mobile responsive design implemented

## Common Pitfalls to Avoid

- Don't use direct database imports - use service factory
- Check Context7 for MUI v7.2.0 patterns (not v5/v6)
- Ensure proper error boundaries for better UX
- Don't forget loading states and skeletons
- Test with different permission levels

## Completion Instructions

When your task is complete:

1. Run `npm run validate` - must pass
2. Run `npm run test` - all tests must pass
3. Run `npx playwright test` - all E2E tests must pass
4. Run `npm run pre-commit` - must pass
5. Commit: `git commit -m "feat: implement issue detail page with full test coverage"`
6. Push: `git push`
7. Create PR: `gh pr create --title "feat: rebuild issue detail page" --body "Implements issue detail page with comprehensive test coverage"`
8. Wait for CI to pass
9. Notify the orchestrator - DO NOT clean up the worktree yourself
