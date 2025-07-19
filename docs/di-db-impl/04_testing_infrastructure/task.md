# Phase 4: Testing Infrastructure Updates

## Priority: HIGH - REQUIRED BEFORE PHASE 5

## Dependencies

- Phase 1 and 2 must be completed first
- Can be done in parallel with Phase 3

## Objective

Update testing infrastructure to support dependency injection pattern and remove real database connections from tests.

## Files to Modify

### 1. `src/test/mockContext.ts`

**Major Changes Required:**

- Add mock service factory to context
- Update type definitions
- Create mock services

```typescript
import { mockDeep, type DeepMockProxy } from "jest-mock-extended";
import type { ExtendedPrismaClient } from "~/server/db";
import type { ServiceFactory } from "~/server/services/factory";

// Mock individual services
const mockNotificationService = {
  createNotification: jest.fn(),
  // ... other methods
};

const mockCollectionService = {
  // ... methods
};

// ... other mock services

// Mock service factory
const createMockServiceFactory = (): DeepMockProxy<ServiceFactory> => {
  return {
    createNotificationService: jest.fn(() => mockNotificationService),
    createCollectionService: jest.fn(() => mockCollectionService),
    createPinballMapService: jest.fn(() => mockPinballMapService),
    createIssueActivityService: jest.fn(() => mockIssueActivityService),
    createCommentCleanupService: jest.fn(() => mockCommentCleanupService),
    createQRCodeService: jest.fn(() => mockQRCodeService),
  } as any;
};

export interface MockContext {
  db: DeepMockProxy<ExtendedPrismaClient>;
  services: DeepMockProxy<ServiceFactory>;
  session: Session | null;
  organization?: Organization | null;
  headers: Headers;
  // ... other context properties
}

export function createMockContext(): MockContext {
  const mockDb = mockDeep<ExtendedPrismaClient>();
  const mockServices = createMockServiceFactory();

  // ... existing mock setup

  return {
    db: mockDb,
    services: mockServices,
    session: null,
    organization: undefined,
    headers: new Headers(),
  };
}
```

### 2. `src/test/setup.ts`

**Changes:**

- Remove DATABASE_URL environment variable setting
- Add mock for database module
- Ensure no real connections possible

```typescript
// Remove this line:
// process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test:test@localhost:5432/test_db";

// Add database module mock
jest.mock("~/server/db", () => ({
  createPrismaClient: jest.fn(),
}));

jest.mock("~/server/db/provider", () => ({
  DatabaseProvider: jest.fn().mockImplementation(() => ({
    getClient: jest.fn(),
    disconnect: jest.fn(),
    reset: jest.fn(),
  })),
  getGlobalDatabaseProvider: jest.fn(),
}));
```

### 3. Create `src/test/helpers/serviceHelpers.ts` (NEW)

**Purpose:** Helper functions for service testing

```typescript
import type { ServiceFactory } from "~/server/services/factory";

export function mockServiceMethod<T extends keyof ServiceFactory>(
  services: any,
  serviceName: T,
  methodName: string,
  implementation?: Function,
) {
  const service = services[serviceName]();
  service[methodName] = jest.fn(implementation);
  return service[methodName];
}

// Helper to reset all service mocks
export function resetAllServiceMocks(services: any) {
  Object.keys(services).forEach((key) => {
    if (typeof services[key] === "function") {
      jest.clearAllMocks();
    }
  });
}
```

### 4. Update Test Examples

Create example test patterns for common scenarios:

```typescript
// Example: Testing a router that uses services
describe("exampleRouter", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("should use service from factory", async () => {
    // Setup
    const mockService = {
      someMethod: jest.fn().mockResolvedValue({ id: "123" }),
    };
    ctx.services.createSomeService.mockReturnValue(mockService);

    // Execute
    const caller = appRouter.createCaller(ctx);
    const result = await caller.example.someEndpoint();

    // Assert
    expect(ctx.services.createSomeService).toHaveBeenCalled();
    expect(mockService.someMethod).toHaveBeenCalled();
  });
});
```

## Testing Requirements

1. Mock context includes service factory
2. No real database connections in tests
3. Service mocks work correctly
4. Existing tests can be migrated easily

## Migration Guide for Existing Tests

1. Replace service instantiation assertions
2. Use service factory mocks instead of constructor mocks
3. Update any database module mocks

## Acceptance Criteria

- [ ] MockContext includes service factory
- [ ] Database module is properly mocked
- [ ] No DATABASE_URL in test setup
- [ ] Helper functions created
- [ ] Example test patterns documented
- [ ] All test utilities compile correctly
