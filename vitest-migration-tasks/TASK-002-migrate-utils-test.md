# TASK-002: Migrate OPDB Utils Test

**Priority**: HIGH  
**Type**: Test Migration  
**Target File**: `src/lib/opdb/__tests__/utils.test.ts`  
**Estimated Time**: 15-20 minutes  
**Status**: Partially Complete (imports already updated)

## Objective

Complete the migration of the OPDB utils test from Jest to Vitest. This test is already partially migrated but needs verification and completion.

## Prerequisites

- TASK-001 completed (Vitest setup) ✅
- Vitest can run with `npm run test:vitest`

## Current State

The file already has:
- ✅ Vitest imports (`import { describe, it, expect } from "vitest"`)
- ✅ No mocking required (pure functions)
- ✅ Listed in vitest.config.ts includes

## Steps to Complete

### 1. Verify Current Test Structure

Run the test to check current status:
```bash
npm run test:vitest -- src/lib/opdb/__tests__/utils.test.ts
```

### 2. Check for Any Remaining Jest Syntax

Search for any Jest-specific patterns:
- `jest.fn()` → Should be `vi.fn()`
- `jest.mock()` → Should be `vi.mock()`
- `jest.spyOn()` → Should be `vi.spyOn()`

### 3. Ensure Test Patterns Are Correct

The test should follow this structure:
```typescript
import { describe, it, expect } from "vitest";
import { functionToTest } from "../utils";

describe("OPDB Utils", () => {
  describe("functionName", () => {
    it("should do something", () => {
      expect(functionToTest(input)).toBe(expectedOutput);
    });
  });
});
```

### 4. Remove from Jest Test Suite

Once verified working in Vitest:
1. Check if the test is explicitly included in any Jest configurations
2. Add to Jest ignore patterns if needed

### 5. Performance Comparison

Record execution time:
- Jest: `npm test -- src/lib/opdb/__tests__/utils.test.ts --verbose`
- Vitest: `npm run test:vitest -- src/lib/opdb/__tests__/utils.test.ts`

## Verification

- [ ] Test runs successfully with Vitest
- [ ] All test cases pass (same as Jest)
- [ ] No Jest-specific syntax remains
- [ ] Test execution is faster in Vitest
- [ ] No TypeScript errors

## Common Issues

1. **Import errors**: Ensure path aliases work (`~/` imports)
2. **Type errors**: Vitest types should be automatically inferred
3. **Assertion differences**: Most Jest assertions work in Vitest

## Success Criteria

- Test passes in Vitest with identical behavior to Jest
- No runtime errors or warnings
- Performance improvement documented

## Notes

This is a simple pure function test - ideal first migration. No complex mocking or async operations.