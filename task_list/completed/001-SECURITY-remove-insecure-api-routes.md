# Task 001: Remove Insecure API Routes

**Priority**: CRITICAL  
**Category**: Security  
**Status**: Not Started  
**Blocking**: All other tasks

## Problem

The `/api/issues/[issueId]` routes bypass all permission checks, allowing any authenticated user to view, edit, or delete any issue from any organization. This is a critical security vulnerability.

## Current State

```typescript
// src/app/api/issues/[issueId]/route.ts
export async function GET(): Promise<NextResponse> {
  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient();
  // No permission checks - just returns data
}
```

## Solution

Delete these routes entirely. The tRPC procedures already exist and include proper permission checks.

## Implementation Steps

1. Delete the insecure routes:

   ```bash
   rm -rf src/app/api/issues
   ```

2. Update any references to use tRPC instead (none found in production code)

3. Update E2E tests that mock these endpoints

4. Verify all issue operations still work through tRPC

## Affected Files

- `src/app/api/issues/[issueId]/route.ts` - DELETE
- `src/app/api/issues/[issueId]/route.test.ts` - DELETE
- `e2e/issues/issue-detail-public.spec.ts` - UPDATE to remove API mocking

## Testing

**Note**: Tests may not pass immediately during the implementation phase. Focus on:

- Ensuring your changes pass linting: `npm run lint`
- Checking TypeScript compilation for your changes: `npm run typecheck:files -- <your-files>`
- Manually testing that issue operations still work through the UI
- Verifying permission checks are enforced

## Success Criteria

- [ ] API routes deleted
- [ ] Your changes pass linting
- [ ] Issue operations work through tRPC
- [ ] Permission checks are enforced
- [ ] No TypeScript errors in modified files

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- Original analysis: `TASK_LIST.md#critical-api-routes-to-removefix`

### Architecture Documentation

- **Source Map**: `docs/architecture/source-map.md` - See "Issue Management System" section
- **Test Map**: `docs/architecture/test-map.md` - See E2E test locations
- **Current State**: `docs/architecture/current-state.md`

### Design Documents

- **Roles & Permissions**: `docs/design-docs/roles-permissions-design.md`
- **UI Architecture**: `docs/design-docs/ui-architecture-plan.md`

### Code Locations

- API routes to delete: `src/app/api/issues/`
- tRPC procedures (secure): `src/server/api/routers/issue.ts`
- E2E tests to update: `e2e/issues/issue-detail-public.spec.ts`
- Permission system: `src/lib/permissions/`
