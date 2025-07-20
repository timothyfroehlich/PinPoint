# TypeScript Strictest Mode Migration Tracker

## Overview

This document tracks the progress of migrating PinPoint to TypeScript's strictest mode using `@tsconfig/strictest`. It serves as a single source of truth for coordinating work across multiple developers, branches, and automated tools.

## Current Status

**Branch**: `implement-strictest-typescript`  
**Last Updated**: 2025-01-20

### Error Counts

| Metric                  | Count | Target |
| ----------------------- | ----- | ------ |
| TypeScript Errors       | 121   | 0      |
| ESLint Warnings (Total) | 111   | 0      |
| Type-Safety Warnings    | 46    | 0      |
| 'any' Usage             | 26    | 0      |

### Error Breakdown

- **TS2345** (42): Argument type mismatches
- **TS2322** (14): Type assignment errors
- **TS2341** (11): Private property access
- **TS2375** (9): exactOptionalPropertyTypes violations
- **TS2353** (9): Unknown object properties

## Error Count History

| Date       | Commit   | TS Errors | ESLint Warnings | 'any' Count | Notes                                 |
| ---------- | -------- | --------- | --------------- | ----------- | ------------------------------------- |
| 2025-01-20 | Round 4B | ~119      | ~111            | 26          | Fixed pinballmapService.ts (2 errors) |
| 2025-01-19 | Current  | 121       | 111 (46 type)   | 26          | Baseline after major fixes            |
| 2025-01-19 | 8a0bfb6  | 211       | 100+            | Unknown     | Before strictest implementation       |
| 2025-01-19 | PR #120  | 5         | 4               | Unknown     | Open PR claiming 98% reduction        |

## Migration Progress by Component

### ✅ Completed (0 errors)

- Production source files (no 'any' usage)
- Core API routes
- Authentication system
- Service layer (mostly complete)

### 🚧 In Progress

- **Test Infrastructure** (76/121 errors)
  - `trpc-auth.test.ts` (34 errors)
  - `pinballmapServiceV2.test.ts` (17 errors)
  - `mockContext.ts` (10 errors)
  - `multi-tenant-security.test.ts` (10 errors)

### ⚠️ Needs Attention

- Test files with 'any' usage (3 files, 26 instances)
- Mock type definitions
- Prisma client test mocks

## Lessons Learned

### 1. Typing Jest Mocks

```typescript
// ❌ Bad: Using any
const mockFn = jest.fn() as jest.Mock<any>;

// ✅ Good: Properly typed
const mockFn = jest.fn<ReturnType, [Parameters]>();
```

### 2. exactOptionalPropertyTypes Fixes

```typescript
// ❌ Bad: Assigning undefined to optional property
const obj: { prop?: string } = { prop: value || undefined };

// ✅ Good: Use nullish coalescing or conditional
const obj: { prop?: string } = { prop: value ?? null };
// or
const obj: { prop?: string } = value ? { prop: value } : {};
```

### 3. Prisma Mock Patterns

```typescript
// ❌ Bad: Incomplete mock
const mockPrisma = { user: { findUnique: jest.fn() } };

// ✅ Good: Include $accelerate for ExtendedPrismaClient
const mockPrisma = {
  user: { findUnique: jest.fn() },
  $accelerate: {
    invalidate: jest.fn(),
    invalidateAll: jest.fn(),
  },
};
```

### 4. Test Context Types

- Always import types from the actual source, not test utilities
- Use `ExtendedPrismaClient` from `~/server/db`, not local type definitions
- Mock only the methods you actually use in tests

### 5. Null Safety with Optional Chaining

```typescript
// ❌ Bad: Accessing properties without null check
const userId = ctx.session.user.id; // Error: session possibly null

// ✅ Good: Use optional chaining and early return
if (!ctx.session?.user?.id) {
  throw new Error("User not found");
}
const userId = ctx.session.user.id; // Now safe
```

### 6. Type Compatibility with exactOptionalPropertyTypes

```typescript
// ❌ Bad: undefined not assignable to string | null
const data = {
  description: input.description, // string | undefined vs string | null
};

// ✅ Good: Conditional assignment for compatible types
const data: { description?: string | null } = {};
if (input.description) {
  data.description = input.description;
}
```

### 7. Spread Operator with Potentially Undefined Values

```typescript
// ❌ Bad: Spreading potentially undefined value
return items.map((item) => ({
  ...(item.user ?? {}), // Error: can't spread potentially undefined
  role: item.role.name,
}));

// ✅ Good: Guard against undefined before spreading
return items.map((item) => {
  if (!item.user) {
    throw new Error("User data missing");
  }
  return {
    ...item.user,
    role: item.role.name,
  };
});
```

## Branch Coordination

### Active Branches

- **implement-strictest-typescript** (current) - Main work branch
- **feat/strict-type-linting** - Contains strict ESLint config (needs cherry-pick)
- **fix-typescript-errors** - Contains critical fixes (needs merge)

### Open PRs

- **PR #120**: "Implement Strictest TypeScript Configuration" (claims 5 errors remaining)

### GitHub Issues (Open)

- **#89**: Remove explicit `any` types from test files
- **#107**: Convert ESLint warnings to errors (final step)
- **#99**: Fix type-aware warnings in Database Layer
- **#98**: Fix type-aware warnings in Test Infrastructure
- **#103**: Fix type-aware warnings in Issue Management

### Recently Merged (2025-01-19)

- PR #119, #110, #109, #117, #113-118: Various type-safety fixes by copilot-swe-agent

## ESLint Baseline Configuration (IMPLEMENTED)

**Date**: 2025-01-19  
**Status**: ✅ Active

### Baseline Strategy

Created a **hybrid baseline approach** to allow continued development while maintaining strict type safety for production code:

1. **Production Code**: Strict type-safety rules as **errors**
2. **Test Files**: Type-safety rules as **warnings** during migration
3. **Deprecated APIs**: Fixed immediately (Zod v3 compatibility)

### Configuration Details

- **Strict Files**: All production code in `src/app/`, `src/server/` (non-test)
- **Baseline Files**: Test files, mockContext.ts, setup.ts
- **Rules Relaxed**: `no-explicit-any`, `no-unsafe-*`, `unbound-method`, etc.

### Benefits

- ✅ **Immediate development continuity** - no blocking lint errors
- ✅ **Progressive improvement** - warnings visible in IDE for gradual fixes
- ✅ **Strict new code** - production code must follow strictest rules
- ✅ **Visibility** - all issues tracked as warnings, not hidden

## Betterer Integration (IMPLEMENTED)

**Status**: ✅ Implemented (2025-01-20)

### Overview

Betterer is now integrated to track TypeScript migration progress and prevent regressions. It monitors TypeScript strict mode errors and prevents any PR that would increase error counts.

### Configuration

- **File**: `.betterer.ts`
- **Baseline**: 121 TypeScript strict mode errors
- **Tracking**: `typescript('./tsconfig.json', { strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true })`

### CI Integration

- **Job**: `betterer` in `.github/workflows/ci.yml`
- **Command**: `npm run betterer:check`
- **Behavior**: Fails CI if error count increases
- **Reporting**: Progress reports in PR comments

### Usage

```bash
# Check for regressions (CI)
npm run betterer:check

# Update baseline after improvements
npm run betterer:update

# Watch mode during development
npm run betterer:watch
```

### Benefits

- **Prevents regressions**: No new TypeScript errors can be introduced
- **Tracks progress**: Clear metrics on improvement
- **Automated enforcement**: CI blocks problematic PRs
- **Team visibility**: PR comments show migration progress

## Production Code Migration Plan

### Error Summary

- **Total Errors**: 121 (88 in tests, 33 in production)
- **Production Code**: 33 TypeScript errors requiring fixes before feature development
- **Test Code**: 88 TypeScript errors (non-blocking, tracked by Betterer)

### Production Code Error Categories

1. **exactOptionalPropertyTypes violations** (16 errors)
   - Properties with `undefined` values not compatible with optional properties
   - Affects: collectionService, notificationService, issueActivityService, routers

2. **Type mismatches** (12 errors)
   - ExtendedPrismaClient type incompatibility in factory.ts
   - Mock type conversion errors in test utilities

3. **Missing properties** (3 errors)
   - issue.status.ts accessing non-existent properties

4. **Unused variables** (2 errors)
   - Minor cleanup needed

### Dependency-Based Migration Order

#### Phase 1: Core Infrastructure (Bottom Layer) ✅

1. **src/server/db.ts** (0 errors)
   - Defines ExtendedPrismaClient type
   - No dependencies on other app code
   - Used by: ALL service and auth files

2. **src/server/auth/types.ts** (0 errors)
   - Defines PrismaRole type
   - Used by: auth/permissions.ts

#### Phase 2: Authentication Layer

3. **src/server/auth/permissions.ts** (2 errors)
   - Type conversion issues with PrismaRole
   - Depends on: db.ts, auth/types.ts
   - Fix: Proper type conversion for role mapping
   - Run after fixing: `npm run betterer:update`

#### Phase 3: Service Factory (Critical Path)

4. **src/server/services/factory.ts** (6 errors)
   - ExtendedPrismaClient type mismatch
   - Depends on: db.ts, all service classes
   - Used by: trpc.base.ts, api routes, tests
   - Fix: Update createServiceFactory generic types
   - Run after fixing: `npm run betterer:update`

#### Phase 4: Individual Services

5. **src/server/services/collectionService.ts** (2 errors)
   - exactOptionalPropertyTypes issues
   - Fix: Use conditional assignment pattern
   - Run after fixing: `npm run betterer:update`

6. **src/server/services/notificationService.ts** (1 error)
   - exactOptionalPropertyTypes issue
   - Fix: Conditional property assignment
   - Run after fixing: `npm run betterer:update`

7. **src/server/services/issueActivityService.ts** (3 errors)
   - exactOptionalPropertyTypes + unused variable
   - Fix: Remove unused var, conditional assignments
   - Run after fixing: `npm run betterer:update`

8. **src/server/services/pinballmapService.ts** ✅ (0 errors - COMPLETED)
   - ✅ Fixed exactOptionalPropertyTypes issue: Changed direct assignment of `opdbId: pmMachine.opdb_id` to conditional assignment `...(pmMachine.opdb_id && { opdbId: pmMachine.opdb_id })`
   - ✅ All TypeScript errors resolved (2 fixes confirmed by Betterer)

#### Phase 5: API Routers

9. **src/server/api/routers/collection.ts** (1 error)
10. **src/server/api/routers/issue.status.ts** (2 errors)
11. **src/server/api/routers/model.opdb.ts** (2 errors)
12. **src/server/api/routers/notification.ts** (1 error)
13. **src/server/api/routers/organization.ts** (1 error)
    - All have exactOptionalPropertyTypes issues
    - Fix: Apply conditional assignment pattern
    - Run after each: `npm run betterer:update`

#### Phase 6: Test Infrastructure (Can be deferred)

14. **src/test/helpers/serviceHelpers.ts** (6 errors)
15. **src/test/mockContext.ts** (6 errors)
    - Complex type conversion issues
    - Non-blocking for feature development

### When to Resume Feature Development

**You can resume feature development after completing Phase 5**

Requirements met:

- ✅ All production code errors fixed (Phases 1-5)
- ✅ Betterer prevents new errors
- ✅ Test warnings don't block development
- ✅ CI passes for production code

### Migration Strategy Per File

1. Fix one file at a time
2. Run `npm run validate:agent` after each fix
3. Run `npm run betterer:update` to save progress
4. Commit with message: `fix(typescript): resolve errors in [filename]`
5. Move to next file in dependency order

### Estimated Timeline

- **Phase 1-2**: ✅ Already complete
- **Phase 3**: 1 hour (critical, blocks everything)
- **Phase 4**: 2 hours (4 service files)
- **Phase 5**: 1 hour (5 router files)
- **Total**: 4 hours to unblock feature development

## Outstanding Work

### Immediate Priority (Blocking Feature Development)

1. Fix 33 production TypeScript errors (Phases 2-5 above)
2. Run `npm run betterer:update` after each phase

### Post-Feature Development Priority

1. Fix 88 test file TypeScript errors
2. Remove all 'any' usage from test files (26 instances)
3. Fix unbound-method warnings (48 instances)
4. Convert test file warnings back to errors (file by file)

### Final Steps

1. Verify PR #120 changes are incorporated
2. Final validation with `npm run validate:full:agent`
3. Merge to main with all production errors resolved

## Best Practices Going Forward

### For New Code

- Never use `any` type
- Enable all strict checks from the start
- Write tests with proper types from the beginning

### For Migration

- Fix errors file by file, not globally
- Run `npm run quick:agent` after changes
- Keep PR sizes manageable
- Document type utilities and patterns

### Tools and Scripts

- `npm run typecheck` - Check TypeScript errors
- `npm run lint` - Check ESLint warnings
- `npm run validate:agent` - Full validation before commit
- `npm run debug:typecheck` - Detailed TypeScript output

## Notes

- Most errors are in test files, indicating production code is largely clean
- The project already uses `@tsconfig/strictest` base configuration
- ESLint type-aware rules are warnings (not errors) for migration purposes
- All 'any' usage is confined to test files with explicit disable comments
