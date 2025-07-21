# Task 004: Complete Issue Detail Page Implementation

**Priority**: HIGH  
**Category**: Core Implementation  
**Status**: Not Started  
**Dependencies**: Tasks 001-003 (security fixes)

## Problem

The issue detail page exists but is incomplete. It needs:

- Full permission integration
- All UI components properly connected
- Status updates and comments functionality
- Mobile responsiveness
- Proper error handling and loading states

## Current State

- Basic page structure exists at `src/app/(features)/issues/[issueId]/`
- Tests have been written (currently failing)
- Permission system exists but not fully integrated
- Some components are stubbed or incomplete

## Solution

Complete the implementation following the test-driven development approach, ensuring all tests pass and permissions are properly enforced.

## Implementation Steps

### 1. Review Current State

- Check failing tests: `npm run test -- issues`
- Review E2E test requirements
- Understand expected UI elements and behaviors

### 2. Page Component (`src/app/(features)/issues/[issueId]/page.tsx`)

- Server component for data fetching
- Permission checking via auth context
- Error boundaries and loading states
- SEO metadata for public issues

### 3. Client Components (`src/components/issues/`)

Create/update with proper data-testid attributes:

- `IssueDetail.tsx` - Main detail display
  - `data-testid="issue-title"`
  - `data-testid="issue-status"`
  - `data-testid="issue-description"`
- `IssueComments.tsx` - Comment thread
  - `data-testid="public-comments"`
  - `data-testid="add-comment-form"`
- `IssueStatusControl.tsx` - Status changes
  - `data-testid="status-dropdown"`
  - Permission-based enabling
- `IssueActions.tsx` - Action buttons
  - `data-testid="edit-issue-button"`
  - `data-testid="close-issue-button"`
  - `data-testid="assign-issue-button"`

### 4. tRPC Integration

Update `src/server/api/routers/issue.ts`:

```typescript
// Use service factory pattern
const issueService = ctx.services.createIssueService();
const activityService = ctx.services.createIssueActivityService();
```

Key procedures:

- `getById` - Include permission filtering
- `update` - Validate permissions
- `addComment` - Track user identity
- `changeStatus` - Log activity

### 5. Permission Controls

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

### 6. Mobile Responsiveness

- Touch-friendly controls (44x44px minimum)
- Responsive Grid layout
- Mobile-first approach

## MUI v7.2.0 Patterns

```tsx
import Grid from "@mui/material/Grid2";
<Grid size={{ xs: 12, md: 8 }}>{/* content */}</Grid>;
```

## Testing Requirements

**Note**: Tests may not pass immediately during the implementation phase. Focus on:

- Ensuring your changes pass linting: `npm run lint`
- Checking TypeScript compilation: `npm run typecheck:files -- src/app/\(features\)/issues src/components/issues`
- Getting the basic functionality working first
- Adding data-testid attributes as you build components

Eventual requirements:

- Unit tests for new components
- Integration tests for tRPC procedures
- E2E tests working
- Full TypeScript compilation
- ESLint/Prettier checks pass

## Success Criteria

- [ ] Issue detail page displays correctly
- [ ] Your changes pass linting
- [ ] No TypeScript errors in your files
- [ ] data-testid attributes on all key elements
- [ ] Permission controls working correctly
- [ ] Mobile responsive design
- [ ] Optimistic updates with error handling
- [ ] Activity logging for all actions
- [ ] Public view working for non-authenticated users

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- Implementation guide: From `implementation-agent-task.md`
- **UI Architecture**: `docs/design-docs/ui-architecture-plan.md` - See "Issue Pages" section
- **Roles & Permissions Design**: `docs/design-docs/roles-permissions-design.md`
- **Frontend Phase 2**: `docs/design-docs/frontend-phase-2-issue-management.md`

### Architecture Documentation

- **Source Map**: `docs/architecture/source-map.md` - See "Issue Management System" section
- **Test Map**: `docs/architecture/test-map.md` - Issue test locations

### Code Locations

- Issue detail page: `src/app/(features)/issues/[issueId]/`
- Issue components: `src/components/issues/`
- tRPC procedures: `src/server/api/routers/issue.ts`
- Permission system: `src/lib/permissions/`
- Service factory: `src/server/services/`

### Test Files

- Unit tests: `src/server/api/routers/issue.test.ts`
- Integration tests: `src/integration-tests/issue-management.test.ts`
- E2E tests: `e2e/issues/issue-detail-public.spec.ts`

### UI Components to Create/Update

- `src/components/issues/IssueDetail.tsx`
- `src/components/issues/IssueComments.tsx`
- `src/components/issues/IssueStatusControl.tsx`
- `src/components/issues/IssueActions.tsx`

### Permission Patterns

- View issue: `hasPermission("issue:view")`
- Edit issue: `hasPermission("issue:edit")`
- Delete issue: `hasPermission("issue:delete")`
- Manage status: `hasPermission("issue:update_status")`
- Assign issue: `hasPermission("issue:assign")`
