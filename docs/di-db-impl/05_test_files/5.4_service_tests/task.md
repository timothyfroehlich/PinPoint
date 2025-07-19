# Phase 5.4: Service Tests

## Priority: MEDIUM - CAN BE DONE IN PARALLEL WITH OTHER TEST UPDATES

## Dependencies

- Phase 4 (Testing Infrastructure) must be completed

## Objective

Update service unit tests to ensure compatibility with DI pattern while maintaining direct instantiation for unit testing.

## Files to Update

### Existing Service Tests

1. `src/server/services/__tests__/collectionService.test.ts`
2. `src/server/services/__tests__/notificationService.test.ts`
3. `src/server/services/__tests__/pinballmapServiceV2.test.ts`
4. Additional service tests in the directory

### New Service Tests Needed

1. `src/server/services/__tests__/qrCodeService.test.ts` (NEW)
2. Service factory tests

## Key Principle

**Service unit tests can still directly instantiate services** - they're testing the service implementation, not the DI pattern.

## Patterns to Maintain

### 1. Direct Service Instantiation (KEEP)

```typescript
import { CollectionService } from "../collectionService";
import { mockDeep } from "jest-mock-extended";
import type { ExtendedPrismaClient } from "~/server/db";

describe("CollectionService", () => {
  let service: CollectionService;
  let mockDb: ExtendedPrismaClient;

  beforeEach(() => {
    mockDb = mockDeep<ExtendedPrismaClient>();
    service = new CollectionService(mockDb);
  });

  // ... tests
});
```

### 2. Remove Database Module Imports

**Before:**

```typescript
import { db } from "~/server/db";
jest.mock("~/server/db");
```

**After:**

```typescript
// No database module import needed
// Use mockDeep for database mocking
```

### 3. Add Service Factory Tests

Create `src/server/services/__tests__/factory.test.ts`:

```typescript
import { ServiceFactory } from "../factory";
import { mockDeep } from "jest-mock-extended";
import type { ExtendedPrismaClient } from "~/server/db";

describe("ServiceFactory", () => {
  let factory: ServiceFactory;
  let mockDb: ExtendedPrismaClient;

  beforeEach(() => {
    mockDb = mockDeep<ExtendedPrismaClient>();
    factory = new ServiceFactory(mockDb);
  });

  it("should create NotificationService", () => {
    const service = factory.createNotificationService();
    expect(service).toBeDefined();
    expect(service.createNotification).toBeDefined();
  });

  // ... test each factory method
});
```

### 4. QR Code Service Tests (NEW)

```typescript
import { QRCodeService } from "../qrCodeService";
import * as QRCode from "qrcode";

jest.mock("qrcode");
jest.mock("../../lib/image-storage/local-storage");

describe("QRCodeService", () => {
  let service: QRCodeService;
  let mockDb: ExtendedPrismaClient;

  beforeEach(() => {
    mockDb = mockDeep<ExtendedPrismaClient>();
    service = new QRCodeService(mockDb);

    (QRCode.toDataURL as jest.Mock).mockResolvedValue(
      "data:image/png;base64,xxx",
    );
  });

  it("should generate QR code for machine", async () => {
    mockDb.machine.findUnique.mockResolvedValue({
      id: "machine-1",
      qrCodeId: null,
      organization: { subdomain: "test" },
    });

    mockDb.qRCode.create.mockResolvedValue({
      id: "qr-1",
      machineId: "machine-1",
      url: "https://test.pinpoint.com/qr/qr-1",
    });

    const result = await service.generateQRCode("machine-1");

    expect(result.id).toBe("qr-1");
    expect(QRCode.toDataURL).toHaveBeenCalled();
  });
});
```

## Type Safety Checks

Ensure all services accept `ExtendedPrismaClient`:

```typescript
// This should compile
const mockDb: ExtendedPrismaClient = mockDeep<ExtendedPrismaClient>();
new ServiceName(mockDb);
```

## Testing Requirements

1. All service tests compile
2. Direct instantiation still works
3. Mock database properly typed
4. Service factory has tests
5. QR code service tested

## Acceptance Criteria

- [ ] Service tests updated to remove db imports
- [ ] Service factory has unit tests
- [ ] QR code service tests created
- [ ] All service tests pass
- [ ] Type safety maintained
