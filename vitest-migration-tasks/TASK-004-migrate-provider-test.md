# TASK-004: Migrate Database Provider Test

**Priority**: HIGH  
**Type**: Test Migration  
**Target File**: `src/server/db/__tests__/provider.test.ts`  
**Estimated Time**: 25-30 minutes  
**Status**: Not Started

## Objective

Migrate the database provider test from Jest to Vitest. This test demonstrates Prisma client mocking patterns.

## Prerequisites

- TASK-000 completed (workspace cleanup)
- TASK-002 completed (basic migration understanding)
- TASK-003 completed (mock patterns understanding)

## Migration Steps

### 1. Copy Test File

Create Vitest version alongside Jest version:
```bash
cp src/server/db/__tests__/provider.test.ts src/server/db/__tests__/provider.vitest.test.ts
```

### 2. Update Imports

Change from:
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
```

To:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

### 3. Update Mock Creation

Change from:
```typescript
const mockPrismaClient = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
  // ... other methods
};
```

To:
```typescript
const mockPrismaClient = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  // ... other methods
};
```

### 4. Update Module Mocks

If mocking PrismaClient constructor:
```typescript
// Jest
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient)
}));

// Vitest
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaClient)
}));
```

### 5. Handle Async Operations

Ensure async tests work correctly:
```typescript
it('should connect to database', async () => {
  await provider.connect();
  expect(mockPrismaClient.$connect).toHaveBeenCalled();
});
```

### 6. Update Mock Resets

In beforeEach:
```typescript
beforeEach(() => {
  vi.clearAllMocks(); // instead of jest.clearAllMocks()
});
```

## Common Patterns to Update

### Spy Creation
```typescript
// Jest
const spy = jest.spyOn(object, 'method');

// Vitest
const spy = vi.spyOn(object, 'method');
```

### Mock Implementation
```typescript
// Jest
mockFn.mockImplementation(() => 'value');

// Vitest
mockFn.mockImplementation(() => 'value'); // Same API
```

### Mock Return Values
```typescript
// Jest
mockFn.mockResolvedValue(data);

// Vitest
mockFn.mockResolvedValue(data); // Same API
```

## Verification

- [ ] Test file runs with `npm run test:vitest -- provider.vitest.test.ts`
- [ ] All test cases pass
- [ ] Mock assertions work correctly
- [ ] No TypeScript errors
- [ ] Performance improvement noted

## Common Issues

1. **Prisma types**: May need to import types differently
2. **Accelerate extension**: Mock the $accelerate property if used
3. **Transaction mocking**: Ensure transaction mock returns properly

## Success Criteria

- Database provider initialization tests pass
- Connection/disconnection tests work
- Transaction handling tests pass
- Error scenarios properly tested
- No behavioral changes from Jest version

## Notes

This test is important for understanding how to mock Prisma clients in Vitest, a common pattern in the codebase.