# TASK-005: Migrate Auth Config Test

**Priority**: HIGH  
**Type**: Test Migration  
**Target File**: `src/server/auth/__tests__/config.test.ts`  
**Estimated Time**: 25-30 minutes  
**Status**: Not Started

## Objective

Migrate the NextAuth configuration test from Jest to Vitest. This test covers authentication configuration and provider mocking.

## Prerequisites

- TASK-000 completed (workspace cleanup)
- TASK-004 completed (understand async mocking)

## Migration Steps

### 1. Copy Test File

```bash
cp src/server/auth/__tests__/config.test.ts src/server/auth/__tests__/config.vitest.test.ts
```

### 2. Update Imports

Change from:
```typescript
import { describe, it, expect, jest } from '@jest/globals';
```

To:
```typescript
import { describe, it, expect, vi } from 'vitest';
```

### 3. Mock NextAuth Modules

Update module mocks for NextAuth:
```typescript
// Jest
jest.mock('next-auth', () => ({
  // mock implementation
}));

// Vitest
vi.mock('next-auth', () => ({
  // mock implementation
}));
```

### 4. Mock Environment Variables

Set up test environment:
```typescript
beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  // other env vars
});

afterAll(() => {
  // Clean up
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_URL;
});
```

### 5. Handle Provider Mocks

Mock OAuth providers if needed:
```typescript
vi.mock('next-auth/providers/google', () => ({
  default: vi.fn(() => ({
    id: 'google',
    name: 'Google',
    type: 'oauth',
  }))
}));
```

### 6. Test Callbacks and Events

Ensure callback mocks work:
```typescript
const mockSession = {
  user: { id: '1', email: 'test@example.com' },
  expires: '2024-12-31',
};

const callbacks = authConfig.callbacks;
const result = await callbacks.session({ session: mockSession, token: {} });
```

## Key Areas to Test

### 1. Provider Configuration
```typescript
it('should configure providers correctly', () => {
  expect(authConfig.providers).toHaveLength(expectedCount);
  expect(authConfig.providers[0]).toHaveProperty('id');
});
```

### 2. Callback Functions
```typescript
it('should handle session callback', async () => {
  const result = await authConfig.callbacks.session({
    session: mockSession,
    token: mockToken,
  });
  expect(result.user).toHaveProperty('id');
});
```

### 3. JWT Configuration
```typescript
it('should configure JWT correctly', () => {
  expect(authConfig.session?.strategy).toBe('jwt');
  expect(authConfig.jwt).toBeDefined();
});
```

## Common Issues

1. **Module resolution**: NextAuth imports might need special handling
2. **Async callbacks**: Ensure promises are handled correctly
3. **Type definitions**: NextAuth types might need explicit imports

## Environment Considerations

This test should run in Node environment (not jsdom):
```typescript
// This should be handled by vitest.config.ts environmentMatchGlobs
// But verify it runs in Node environment
```

## Verification

- [ ] All auth configuration tests pass
- [ ] Provider mocking works correctly
- [ ] Callback functions tested properly
- [ ] Environment variables handled correctly
- [ ] No Jest-specific syntax remains

## Success Criteria

- Auth configuration tests pass identically to Jest
- Mock providers work correctly
- Callbacks and events properly tested
- Clean TypeScript compilation
- Performance improvement documented

## Notes

This test is crucial for authentication system integrity. Ensure all edge cases are preserved during migration.