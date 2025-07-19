# Phase 5: Update Individual Test Files

## Priority: MEDIUM - CAN BE DONE INCREMENTALLY

## Dependencies

- All previous phases must be completed

## Objective

Update all test files to use the new dependency injection patterns and remove direct database usage.

## Files to Update

### Test Files with Direct Database Imports

1. `src/server/api/__tests__/multi-tenant-security.test.ts`
2. `src/server/auth/__tests__/config.test.ts`
3. `src/app/api/dev/__tests__/users.test.ts`

### Test Files Using Service Instantiation

1. `src/server/api/routers/__tests__/collection.test.ts`
2. `src/server/api/routers/__tests__/notification.test.ts`
3. `src/server/api/routers/__tests__/trpc-auth.test.ts`
4. `src/server/services/__tests__/*.test.ts` (all service tests)

### Test Files That May Need Updates

- Any test importing from `~/server/db`
- Any test creating service instances
- Any test mocking database or services

## Common Patterns to Update

### 1. Remove Direct Database Imports

**Before:**

```typescript
import { db } from "~/server/db";
// or
jest.mock("~/server/db");
```

**After:**

```typescript
// Remove import entirely
// Mocking handled by test setup
```

### 2. Update Service Instantiation Tests

**Before:**

```typescript
const service = new CollectionService(mockDb);
```

**After:**

```typescript
const service = ctx.services.createCollectionService();
// or if testing service directly:
const service = new CollectionService(mockDb); // This is OK for unit tests
```

### 3. Update Service Mock Patterns

**Before:**

```typescript
jest.mock("~/server/services/notificationService");
const mockService = new NotificationService(ctx.db);
```

**After:**

```typescript
ctx.services.createNotificationService.mockReturnValue({
  createNotification: jest.fn(),
  // ... other methods
});
```

### 4. Fix Auth Config Tests

**Before:**

```typescript
import { authConfig } from "~/server/auth/config";
```

**After:**

```typescript
import { createAuthConfig } from "~/server/auth/config";
const authConfig = createAuthConfig(mockDb);
```

## Test Categories and Strategies

### Unit Tests (Services)

- Can still instantiate services directly with mock db
- No changes needed if not importing db module

### Integration Tests (Routers)

- Must use mock context with service factory
- Update all service instantiation patterns
- Remove any direct db imports

### API Route Tests

- Mock DatabaseProvider if used
- Ensure proper cleanup in tests

## Special Considerations

### QR Code Tests

- New service added in merge
- Ensure QRCodeService is included in mock factory
- Add appropriate test cases

### Database Connection Tests

- Health check endpoint tests
- May need special handling for connection testing

## Testing Order

1. Fix broken imports first
2. Update service instantiation patterns
3. Fix individual test assertions
4. Add new tests for DI patterns

## Acceptance Criteria

- [ ] All tests compile without errors
- [ ] No direct database imports in tests
- [ ] Service factory mocks used consistently
- [ ] All tests pass
- [ ] Coverage maintained or improved
- [ ] New patterns documented in test files
