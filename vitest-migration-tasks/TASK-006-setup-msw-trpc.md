# TASK-006: Setup MSW-tRPC Infrastructure

**Priority**: HIGH  
**Type**: Infrastructure Setup  
**Estimated Time**: 30-40 minutes  
**Status**: Not Started

## Objective

Set up MSW (Mock Service Worker) with tRPC integration for more maintainable API mocking in Vitest tests.

## Prerequisites

- TASK-000 completed (workspace cleanup)
- Basic understanding of tRPC structure in the codebase

## Why MSW-tRPC?

- **Type-safe mocking**: Automatically typed based on your tRPC router
- **Less boilerplate**: No need to manually mock every tRPC procedure
- **Realistic testing**: Mocks at the network level, not implementation
- **Reusable**: Same mocks can be used across multiple tests

## Setup Steps

### 1. Verify Dependencies

Check that these are installed (from package.json):
```json
{
  "devDependencies": {
    "msw": "^2.10.4",
    "msw-trpc": "^2.0.1"
  }
}
```

### 2. Create MSW Setup File

Create `src/test/msw/setup.ts`:
```typescript
import { setupServer } from 'msw/node';
import { createTRPCMsw } from 'msw-trpc';
import type { AppRouter } from '~/server/api/root';
import superjson from 'superjson';

// Create tRPC-specific MSW instance
export const trpcMsw = createTRPCMsw<AppRouter>({
  transformer: superjson,
  baseUrl: 'http://localhost:3000/api/trpc',
});

// Create MSW server instance
export const server = setupServer();
```

### 3. Create Handler Utilities

Create `src/test/msw/handlers.ts`:
```typescript
import { trpcMsw } from './setup';
import type { User, Organization, Issue } from '@prisma/client';

// Example handlers for common operations
export const handlers = {
  // User handlers
  userGetProfile: (user: Partial<User> = {}) =>
    trpcMsw.user.getProfile.query(() => ({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      ...user,
    })),

  // Organization handlers  
  organizationGetCurrent: (org: Partial<Organization> = {}) =>
    trpcMsw.organization.getCurrent.query(() => ({
      id: 'org-1',
      name: 'Test Organization',
      ...org,
    })),

  // Issue handlers
  issueGetById: (issue: Partial<Issue> = {}) =>
    trpcMsw.issue.core.getById.query(() => ({
      id: 'issue-1',
      title: 'Test Issue',
      organizationId: 'org-1',
      ...issue,
    })),

  // Error handlers
  errorUnauthorized: (procedure: string) =>
    trpcMsw[procedure].query(() => {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }),
};
```

### 4. Update Vitest Setup

Update `src/test/vitest.setup.ts`:
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './msw/setup';

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn', // Warn on unhandled requests
  });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test';
```

### 5. Create Example Test

Create `src/test/msw/example.vitest.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { server } from './setup';
import { handlers } from './handlers';
import { createTRPCClient } from '~/trpc/client';

describe('MSW-tRPC Example', () => {
  it('should mock user profile query', async () => {
    // Setup mock
    server.use(
      handlers.userGetProfile({
        id: 'custom-id',
        name: 'Custom User',
      })
    );

    // Make request
    const client = createTRPCClient();
    const user = await client.user.getProfile.query();

    // Assert
    expect(user.id).toBe('custom-id');
    expect(user.name).toBe('Custom User');
  });

  it('should handle errors', async () => {
    // Setup error mock
    server.use(
      trpcMsw.user.getProfile.query(() => {
        throw new TRPCError({ 
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      })
    );

    // Make request and expect error
    const client = createTRPCClient();
    await expect(client.user.getProfile.query()).rejects.toThrow('Not authenticated');
  });
});
```

## Verification

- [ ] MSW server starts without errors
- [ ] Example test passes
- [ ] Type safety works (autocomplete for procedures)
- [ ] Error handling works correctly
- [ ] No conflicts with existing tests

## Common Issues

1. **Import errors**: Ensure `msw/node` is imported, not `msw/browser`
2. **Transform errors**: Ensure superjson transformer matches tRPC config
3. **Type errors**: Import types from correct locations
4. **URL mismatch**: Ensure baseUrl matches your tRPC endpoint

## Benefits for Future Tests

With MSW-tRPC set up, tests become much simpler:
```typescript
// Instead of complex manual mocking
const mockTrpc = {
  user: {
    getProfile: {
      query: jest.fn().mockResolvedValue(userData)
    }
  }
};

// Simply use
server.use(handlers.userGetProfile(userData));
```

## Success Criteria

- MSW server initializes correctly
- tRPC procedures can be mocked with type safety
- Example test demonstrates query and error handling
- Setup is reusable across all tests

## Next Steps

After this setup:
1. Use MSW-tRPC in TASK-007 (migrate tRPC auth test)
2. Create more reusable handlers as needed
3. Consider creating factories for complex data

## Notes

This infrastructure investment will pay off significantly as more tests are migrated, especially complex tRPC interaction tests.