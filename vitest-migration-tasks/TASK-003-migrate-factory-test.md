# TASK-003: Migrate Service Factory Test

**Priority**: HIGH  
**Type**: Test Migration  
**Target File**: `src/server/services/__tests__/factory.test.ts`  
**Estimated Time**: 20-25 minutes  
**Status**: Partially Complete (imports and mocks updated)

## Objective

Complete the migration of the service factory test from Jest to Vitest. This test demonstrates basic mocking patterns in Vitest.

## Prerequisites

- TASK-001 completed (Vitest setup) ✅
- TASK-002 completed (understand basic migration) ✅

## Current State

The file already has:
- ✅ Vitest imports (`import { describe, it, expect, vi } from "vitest"`)
- ✅ Mock conversions (`vi.mock()` instead of `jest.mock()`)
- ✅ Listed in vitest.config.ts includes

## Steps to Complete

### 1. Verify Mock Setup

Ensure all mocks are properly configured:
```typescript
vi.mock("../notificationService");
vi.mock("../collectionService");
// etc...
```

### 2. Check Mock Implementations

If any mocks need specific implementations:
```typescript
vi.mock("../notificationService", () => ({
  NotificationService: vi.fn().mockImplementation(() => ({
    // mock methods if needed
  }))
}));
```

### 3. Update beforeEach Hooks

Ensure mocks are cleared properly:
```typescript
beforeEach(() => {
  vi.clearAllMocks(); // instead of jest.clearAllMocks()
  factory = new ServiceFactory(mockDb);
});
```

### 4. Verify Type Assertions

Check that TypeScript types work correctly with Vitest mocks:
```typescript
expect(NotificationService).toHaveBeenCalledWith(mockDb);
```

### 5. Test Environment

This is a Node.js test (not jsdom). Verify it runs in correct environment:
```bash
npm run test:vitest -- src/server/services/__tests__/factory.test.ts
```

## Verification

- [ ] All service creation tests pass
- [ ] Mock assertions work correctly
- [ ] No Jest-specific syntax remains
- [ ] TypeScript types are satisfied
- [ ] Test runs in Node environment

## Common Issues

1. **Mock not working**: Ensure `vi.mock()` is at top level, not inside describe blocks
2. **Type errors**: May need to cast mocked constructors
3. **Environment issues**: Should run in Node, not jsdom

## Code Patterns

### Jest Pattern:
```typescript
jest.mock("../service");
expect(Service).toHaveBeenCalledWith(arg);
```

### Vitest Pattern:
```typescript
vi.mock("../service");
expect(Service).toHaveBeenCalledWith(arg);
```

## Success Criteria

- All factory method tests pass
- Mock verification works correctly
- No behavioral changes from Jest version
- Clean TypeScript compilation

## Notes

This test validates the factory pattern and constructor mocking - important pattern for service tests.