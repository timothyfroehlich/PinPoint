# Task 003: Audit tRPC Procedures for Complete Permission Coverage

**Priority**: HIGH  
**Category**: Security  
**Status**: Not Started  
**Dependencies**: Task 001

## Problem

Not all tRPC procedures have proper permission checks. We need a comprehensive audit to ensure every procedure validates permissions before executing.

## Current State

- Some procedures have permission checks
- Others may be missing checks or have incomplete validation
- No comprehensive documentation of which permissions are required for each procedure

## Solution

Audit every tRPC procedure and ensure proper permission validation is in place.

## Implementation Steps

1. List all tRPC routers:

   ```bash
   ls -la src/server/api/routers/
   ```

2. For each router, check every procedure for:
   - Authentication requirement (publicProcedure vs protectedProcedure)
   - Permission checks using the permission system
   - Proper organization context validation

3. Document findings in a permission matrix

4. Fix any procedures missing permission checks

5. Add tests for permission validation

## Audit Checklist

For each procedure:

- [ ] Uses protectedProcedure for authenticated endpoints
- [ ] Validates organization membership
- [ ] Checks specific permissions (e.g., "edit_issue", "manage_team")
- [ ] Has tests for permission denial cases

## Key Areas to Audit

- `issue.ts` - Issue CRUD operations
- `organization.ts` - Organization management
- `user.ts` - User profile and settings
- `location.ts` - Location management
- `gameInstance.ts` - Game instance operations
- `member.ts` - Team member management

## Testing

**Note**: Tests may not pass immediately during the implementation phase. Focus on:

- Ensuring your changes pass linting: `npm run lint`
- Checking TypeScript compilation: `npm run typecheck:files -- src/server/api/routers`
- Writing tests for permission denial (they may not all pass yet)
- Testing manually with different user roles

## Success Criteria

- [ ] All procedures audited
- [ ] Permission matrix documented
- [ ] Missing permission checks added
- [ ] Your changes pass linting
- [ ] No TypeScript errors in modified files
- [ ] Permission tests written (even if not all passing)
- [ ] No unauthorized access possible

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- **Roles & Permissions Design**: `docs/design-docs/roles-permissions-design.md`

### Architecture Documentation

- **Source Map**: `docs/architecture/source-map.md` - Complete router listing
- **Test Map**: `docs/architecture/test-map.md` - Permission test coverage

### Permission System

- Permission definitions: `src/lib/permissions/`
- Permission constants: `src/lib/permissions/constants.ts`
- Permission checks: `src/lib/permissions/checks.ts`
- tRPC middleware: `src/server/api/trpc.ts` (protectedProcedure definition)

### Router Locations

- `src/server/api/routers/issue.ts` - Issue CRUD
- `src/server/api/routers/organization.ts` - Org management
- `src/server/api/routers/user.ts` - User profiles
- `src/server/api/routers/location.ts` - Location ops
- `src/server/api/routers/gameInstance.ts` - Game operations
- `src/server/api/routers/member.ts` - Team management
- `src/server/api/routers/upload.ts` - File uploads
- `src/server/api/routers/notification.ts` - Notifications

### Test Examples

- Permission test patterns: `src/server/api/routers/issue.test.ts`
- Integration tests: `src/integration-tests/role-permissions.test.ts`
