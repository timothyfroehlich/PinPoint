# Dependency Injection Implementation - Completion Task

## Status: 95% Complete ✅

The dependency injection refactoring has been successfully implemented and merged. This task covers the final cleanup to reach 100% completion.

## What's Been Completed ✅

- ✅ Core database module refactored to factory pattern
- ✅ Service factory implementation with all services
- ✅ tRPC context updated with DI pattern
- ✅ All API routes updated to use DatabaseProvider
- ✅ Auth configuration converted to factory pattern
- ✅ Most tRPC routers updated to use ctx.services
- ✅ Testing infrastructure updated with proper mocks
- ✅ Most test files updated to remove direct db imports

## Remaining Tasks (~5% of work)

### 1. Fix Missing Router Updates

**Priority: HIGH**

One router was missed in the initial implementation:

- **File**: `src/server/api/routers/location.ts`
- **Issue**: Still has direct service imports instead of using `ctx.services`
- **Pattern**: Update `new ServiceName(ctx.db)` → `ctx.services.createServiceName()`

### 2. Complete Test File Updates

**Priority: MEDIUM**

A few test files still need final updates:

- Check for any remaining direct `db` imports in test files
- Ensure all service instantiation tests use proper patterns
- Verify QR code service tests are properly integrated

### 3. Validate Implementation

**Priority: HIGH**

Before marking complete, run validation checks:

```bash
# Type checking
npm run typecheck

# Lint checking
npm run lint

# Test suite
npm run test

# Quick validation
npm run quick
```

### 4. Search for Remaining Issues

**Priority: MEDIUM**

Search for any stragglers:

```bash
# Find any remaining direct db imports
rg "from.*~/server/db" --type ts src/

# Find direct service instantiations
rg "new.*Service\(" --type ts src/

# Check for missed patterns
rg "import.*db.*from" --type ts src/
```

## Acceptance Criteria

- [ ] All TypeScript compilation passes (`npm run typecheck`)
- [ ] All lint checks pass (`npm run lint`)
- [ ] All tests pass (`npm run test`)
- [ ] No direct database imports outside of provider
- [ ] All services use factory pattern consistently
- [ ] Location router updated to use `ctx.services`
- [ ] All test files properly mock services

## Implementation Notes

### Location Router Pattern

**Before:**

```typescript
import { SomeService } from "~/server/services/someService";

// In procedures
const service = new SomeService(ctx.db);
```

**After:**

```typescript
// Remove import, use factory
const service = ctx.services.createSomeService();
```

### Test File Pattern

**Before:**

```typescript
import { db } from "~/server/db";
jest.mock("~/server/db");
```

**After:**

```typescript
// Remove db import entirely
// Use mock context with service factory
```

## Time Estimate

- **Location router fix**: 15 minutes
- **Test file cleanup**: 30 minutes
- **Validation & fixes**: 30 minutes
- **Total**: ~1-2 hours

## Success Metrics

When complete, the codebase should have:

- ✅ Zero direct database imports (except provider)
- ✅ All tests pass without real DB connection
- ✅ TypeScript compilation succeeds
- ✅ Service factory pattern used consistently
- ✅ Proper cleanup in all API routes

## Notes

This is the final 5% of a comprehensive dependency injection refactoring. The architecture is solid and the patterns are well-established. This completion task just needs to clean up the few remaining stragglers.
