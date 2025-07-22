# TASK-007: Migrate tRPC Auth Test with MSW-tRPC

**Priority**: HIGH  
**Type**: Test Migration (Complex)  
**Target File**: `src/server/api/__tests__/trpc-auth.test.ts`  
**Estimated Time**: 40-50 minutes  
**Status**: Not Started

## Objective

Migrate the tRPC authentication test from Jest to Vitest using MSW-tRPC for cleaner, more maintainable mocking.

## Prerequisites

- TASK-000 through TASK-005 completed
- TASK-006 completed (MSW-tRPC setup) ⚠️ CRITICAL

## Current Test Analysis

This test likely covers:
- Authentication middleware
- Protected procedures
- Organization context
- Permission checking

## Migration Steps

### 1. Copy Test File

```bash
cp src/server/api/__tests__/trpc-auth.test.ts src/server/api/__tests__/trpc-auth.vitest.test.ts
```

### 2. Update Imports

Change from:
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';
import { createMockContext } from '~/test/mockContext';
```

To:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { server } from '~/test/msw/setup';
import { handlers } from '~/test/msw/handlers';
import { trpcMsw } from '~/test/msw/setup';
```

### 3. Replace Manual Mocks with MSW-tRPC

Instead of manual mocking:
```typescript
// Old Jest way
const mockCtx = createMockContext();
mockCtx.session = {
  user: { id: '1', email: 'test@example.com' },
  expires: '2024-12-31',
};
```

Use MSW-tRPC:
```typescript
// New Vitest + MSW way
beforeEach(() => {
  server.use(
    // Mock authenticated user
    handlers.userGetProfile({
      id: 'user-1',
      email: 'test@example.com',
    }),
    
    // Mock organization context
    handlers.organizationGetCurrent({
      id: 'org-1',
      name: 'Test Organization',
    })
  );
});
```

### 4. Test Protected Procedures

Test authentication requirements:
```typescript
it('should reject unauthenticated requests', async () => {
  // Override handler for this test
  server.use(
    trpcMsw.user.getProfile.query(() => {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    })
  );

  // Test the actual client
  const client = createTRPCClient({ 
    headers: {} // No auth headers 
  });
  
  await expect(client.user.getProfile.query())
    .rejects
    .toThrow('UNAUTHORIZED');
});
```

### 5. Test Organization Procedures

Test organization-scoped access:
```typescript
it('should allow access to organization data for members', async () => {
  server.use(
    trpcMsw.organization.getMembers.query(() => [
      { id: 'member-1', name: 'Member 1' },
      { id: 'member-2', name: 'Member 2' },
    ])
  );

  const client = createAuthenticatedClient('user-1', 'org-1');
  const members = await client.organization.getMembers.query();
  
  expect(members).toHaveLength(2);
});
```

### 6. Test Permission-Based Procedures

Test specific permissions:
```typescript
it('should enforce permission requirements', async () => {
  // Mock a user without required permission
  server.use(
    trpcMsw.issue.core.create.mutation(() => {
      throw new TRPCError({ 
        code: 'FORBIDDEN',
        message: 'Missing required permission: issue:create',
      });
    })
  );

  const client = createAuthenticatedClient('user-1', 'org-1');
  
  await expect(
    client.issue.core.create.mutate({
      title: 'New Issue',
      organizationId: 'org-1',
    })
  ).rejects.toThrow('Missing required permission');
});
```

### 7. Create Test Helpers

Add helpers for common scenarios:
```typescript
// Helper to create authenticated client
function createAuthenticatedClient(userId: string, orgId: string) {
  return createTRPCClient({
    headers: {
      authorization: `Bearer test-token-${userId}`,
      'x-organization-id': orgId,
    },
  });
}

// Helper to mock session
function mockAuthenticatedUser(user: Partial<User> = {}) {
  return server.use(
    handlers.userGetProfile({
      id: 'user-1',
      email: 'test@example.com',
      ...user,
    })
  );
}
```

## Key Patterns to Implement

### 1. Middleware Testing
```typescript
describe('protectedProcedure', () => {
  it('should allow authenticated users', async () => {
    mockAuthenticatedUser();
    // Test protected endpoint
  });

  it('should reject unauthenticated users', async () => {
    // No auth mock
    // Expect UNAUTHORIZED
  });
});
```

### 2. Organization Context
```typescript
describe('organizationProcedure', () => {
  it('should validate organization membership', async () => {
    mockAuthenticatedUser();
    mockOrganizationMembership();
    // Test org-scoped endpoint
  });
});
```

### 3. Permission Checking
```typescript
describe('permission-based procedures', () => {
  it('should check specific permissions', async () => {
    mockUserWithPermissions(['issue:read', 'issue:create']);
    // Test permission-required endpoint
  });
});
```

## Common Issues

1. **Session mocking**: Ensure session structure matches production
2. **Async handling**: Remember to await all async operations
3. **Error matching**: TRPCError codes should match exactly
4. **Type safety**: Leverage TypeScript for procedure names

## Verification

- [ ] All authentication tests pass
- [ ] Middleware behavior unchanged
- [ ] Permission checks work correctly
- [ ] Organization scoping works
- [ ] MSW-tRPC provides better DX than manual mocks

## Success Criteria

- All test cases from Jest version pass in Vitest
- Code is cleaner and more maintainable with MSW-tRPC
- Type safety is preserved or improved
- Test execution is faster
- No manual tRPC mocking required

## Notes

This is the most complex test migration, demonstrating the full power of MSW-tRPC. The patterns established here will be reused across many other test files.