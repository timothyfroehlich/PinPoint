# Phase 5.3: Router Tests

## Priority: MEDIUM - CAN BE DONE IN PARALLEL WITH OTHER TEST UPDATES

## Dependencies

- Phase 4 (Testing Infrastructure) must be completed
- Phase 3.3 (Router refactoring) should be completed

## Objective

Update all tRPC router test files to use service factory from context.

## Files to Update

### Core Router Tests

1. `src/server/api/routers/__tests__/notification.test.ts`
2. `src/server/api/routers/__tests__/collection.test.ts`
3. `src/server/api/routers/__tests__/trpc-auth.test.ts`
4. `src/server/api/__tests__/multi-tenant-security.test.ts`

### Additional Router Tests (check for existence)

- Issue router tests
- Comment router tests
- Machine router tests
- Model router tests
- Location router tests
- Organization router tests
- PinballMap router tests
- QRCode router tests (NEW)

## Common Patterns to Update

### 1. Service Instantiation in Tests

**Before:**

```typescript
import { NotificationService } from "~/server/services/notificationService";

it("should create notification", async () => {
  const mockService = new NotificationService(ctx.db);
  // ...
});
```

**After:**

```typescript
it("should create notification", async () => {
  const mockService = {
    createNotification: jest.fn().mockResolvedValue({ id: "123" }),
  };

  ctx.services.createNotificationService.mockReturnValue(mockService);

  const caller = appRouter.createCaller(ctx);
  await caller.notification.create({
    /* ... */
  });

  expect(ctx.services.createNotificationService).toHaveBeenCalled();
  expect(mockService.createNotification).toHaveBeenCalled();
});
```

### 2. Multi-tenant Security Tests

**Special attention needed:**

- Uses database directly for setup
- May need to mock organization/membership queries

**Update pattern:**

```typescript
// Setup organization in context
ctx.organization = mockOrganization;

// Mock membership check
ctx.db.membership.findFirst.mockResolvedValue(mockMembership);
```

### 3. Testing Service Errors

```typescript
it("should handle service errors", async () => {
  const mockService = {
    someMethod: jest.fn().mockRejectedValue(new Error("Service error")),
  };

  ctx.services.createSomeService.mockReturnValue(mockService);

  const caller = appRouter.createCaller(ctx);

  await expect(caller.route.method()).rejects.toThrow("Service error");
});
```

## QR Code Router Tests (NEW)

Create tests for the new QR code functionality:

```typescript
describe("qrCodeRouter", () => {
  it("should generate QR code", async () => {
    const mockQRService = {
      generateQRCode: jest.fn().mockResolvedValue({
        id: "qr-123",
        url: "https://example.com/qr/123",
      }),
    };

    ctx.services.createQRCodeService.mockReturnValue(mockQRService);

    // ... test implementation
  });
});
```

## Testing Checklist for Each Router

1. [ ] Remove service imports (unless needed for types)
2. [ ] Update service instantiation to use factory
3. [ ] Mock service methods appropriately
4. [ ] Verify factory method calls
5. [ ] Ensure type safety maintained

## Special Considerations

- Some routers may have complex permission checks
- Service composition (services using other services)
- Transaction handling in tests

## Acceptance Criteria

- [ ] All router tests use service factory
- [ ] No `new Service()` patterns in tests
- [ ] Service factory mocks verified
- [ ] All router tests pass
- [ ] QR code router tests added
