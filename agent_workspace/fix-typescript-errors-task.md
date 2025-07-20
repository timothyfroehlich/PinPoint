# Task: Fix TypeScript Strictest Mode Errors

## Mission Statement

Fix all 72 TypeScript errors in the main repository caused by the implementation of strictest TypeScript configuration. Focus on test files, service mocking, and Prisma Accelerate integration issues. This is a critical blocking issue for development.

## Context

### Current State

- **72 TypeScript errors** preventing development
- Main branch has strictest TypeScript configuration implemented
- Errors primarily in test files and mock systems
- Betterer integration tracks TS errors to prevent regressions

### Key Problem Areas

1. **Test Authentication Mocking** (`src/server/api/__tests__/trpc-auth.test.ts`)
   - Session type mismatches: `Session` not assignable to `never`
   - Prisma Accelerate Promise types missing required properties
   - Mock return values don't match expected Accelerate types

2. **Service Factory Mocking** (`src/test/mockContext.ts`)
   - Service factory type conversions failing
   - DeepMockProxy incompatibilities with Jest mocks
   - Prisma $accelerate mock structure issues

3. **Service Test Files**
   - Prisma client method mocking incompatibilities
   - Private method access in tests
   - Type mismatches in service constructors

4. **Data Factory Issues**
   - Missing required properties in mock objects
   - Schema property mismatches (e.g., `serialNumber` vs expected structure)

## TypeScript Strictest Mode Guidelines

### Critical Patterns for `@tsconfig/strictest` Compliance

**NEVER use `any` type** - This is completely banned by ESLint rules.

**1. Prisma Accelerate Mock Pattern**

```typescript
// ❌ Bad: Missing Accelerate properties
mockPrisma.member.findFirst.mockResolvedValue(memberData);

// ✅ Good: Include Accelerate wrapper
mockPrisma.member.findFirst.mockResolvedValue(
  Promise.resolve(memberData) as any, // Only exception for complex Prisma types
);

// ✅ Better: Use proper Accelerate mock structure
const mockPrisma = {
  member: { findFirst: jest.fn() },
  $accelerate: {
    invalidate: jest.fn(),
    invalidateAll: jest.fn(),
  },
};
```

**2. Session Mock Handling**

```typescript
// ❌ Bad: Session not compatible with never
createCaller({ session: mockSession });

// ✅ Good: Proper context creation
const mockContext = createMockContext();
mockContext.session = mockSession;
const caller = createCaller(mockContext);
```

**3. Service Factory Mocking**

```typescript
// ❌ Bad: Type conversion failures
const mockFactory = { ... } as DeepMockProxy<ServiceFactory>;

// ✅ Good: Use proper Jest typing
const mockFactory: jest.Mocked<ServiceFactory> = {
  createNotificationService: jest.fn(),
  // ... other methods
};
```

**4. Mock Data Alignment**

```typescript
// ❌ Bad: Missing required properties
const mockMachine = { id: "123", serialNumber: "456" };

// ✅ Good: Include all required properties from schema
const mockMachine = {
  id: "123",
  name: "Test Machine",
  organizationId: "org-123",
  // ... all required properties
};
```

## Documentation References

- **TypeScript Strictest Guide**: `docs/developer-guides/typescript-strictest.md`
- **Testing Patterns**: `docs/developer-guides/testing-patterns.md`
- **Common Errors**: `docs/developer-guides/common-errors.md`
- **Betterer Workflow**: `docs/developer-guides/betterer-workflow.md`

## Implementation Strategy

### Phase 1: Test Infrastructure (Priority 1)

1. **Fix mockContext.ts** - Service factory and Prisma mock types
2. **Fix serviceHelpers.ts** - Generic service mock utilities
3. **Test these fixes work** with a simple test run

### Phase 2: Auth Test Fixes (Priority 1)

1. **Fix trpc-auth.test.ts** - Session handling and Accelerate mocks
2. **Ensure no regressions** in auth functionality
3. **Update test patterns** to be strictest-mode compliant

### Phase 3: Service Test Files (Priority 2)

1. **Fix collection service tests** - Mock return type issues
2. **Fix pinball map service tests** - Private method access, data structure mismatches
3. **Fix notification tests** - Missing schema properties

### Phase 4: Validation & Cleanup (Priority 2)

1. **Run full validation** - Ensure all 72 errors are resolved
2. **Update test documentation** - Document new patterns
3. **Verify Betterer compliance** - No new TS errors introduced

## Quality Requirements

- **Zero TypeScript errors**: `npm run typecheck` must pass completely
- **All tests passing**: `npm run test` must pass
- **Betterer compliance**: No new violations introduced
- **ESLint compliance**: `npm run lint` must pass
- **Pre-commit hooks**: `npm run pre-commit` must pass

## Success Criteria

1. **TypeScript compilation**: Zero errors across entire codebase
2. **Test execution**: All existing tests continue to pass
3. **Development readiness**: Main repository ready for feature development
4. **Documentation**: Updated test patterns for future reference

## Implementation Steps

### Step 1: Environment Setup

```bash
cd /home/froeht/Code/PinPoint-worktrees/fix-typescript-errors
npm run validate  # See current error count
```

### Step 2: Fix Core Mock Infrastructure

- Start with `src/test/mockContext.ts`
- Fix service factory typing issues
- Ensure Prisma mock includes $accelerate structure

### Step 3: Fix Authentication Tests

- Address `src/server/api/__tests__/trpc-auth.test.ts`
- Fix Session type compatibility
- Update Accelerate Promise mock patterns

### Step 4: Service Test Fixes

- Work through service test files systematically
- Fix Prisma method mocking patterns
- Address private method access issues

### Step 5: Validation

```bash
npm run typecheck     # Must show 0 errors
npm run test         # All tests must pass
npm run lint         # Must pass
npm run pre-commit   # Final validation
```

## Library Version Notes

- **Prisma**: Current version includes Accelerate integration
- **Jest**: Using `jest.fn<T>()` typed mocks (never `jest.fn() as any`)
- **tRPC**: v11 with stricter context typing
- **@tsconfig/strictest**: All rules active, including `exactOptionalPropertyTypes`

## Completion Instructions

When all TypeScript errors are resolved:

1. **Commit changes** with descriptive messages following project patterns
2. **Push branch** and create PR
3. **Notify orchestrator** - DO NOT clean up the worktree yourself
4. **Document any new patterns** discovered during implementation

## Emergency Procedures

If you encounter blocking issues:

- **Consult strictest mode docs** first: `docs/developer-guides/typescript-strictest.md`
- **Check existing patterns** in the codebase for similar fixes
- **Use `@ts-expect-error`** only as last resort with detailed comments
- **Never use `@ts-ignore`** - banned by ESLint

---

## Error Summary

**Total Errors**: 72
**Primary Files**:

- `src/server/api/__tests__/trpc-auth.test.ts` (24 errors)
- `src/test/mockContext.ts` (6 errors)
- `src/test/helpers/serviceHelpers.ts` (6 errors)
- `src/server/services/__tests__/` (multiple files, ~25 errors)
- Collection/service tests (remaining errors)

**Root Causes**:

1. Prisma Accelerate integration breaking mock patterns
2. Strictest mode requiring exact type matches
3. Service factory mocking incompatibilities
4. Missing required properties in mock data

This task is **critical path** for all other development work.
