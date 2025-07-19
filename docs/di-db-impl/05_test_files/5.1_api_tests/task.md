# Phase 5.1: API Route Tests

## Priority: MEDIUM - CAN BE DONE IN PARALLEL WITH OTHER TEST UPDATES

## Dependencies

- Phase 4 (Testing Infrastructure) must be completed

## Objective

Update all API route test files to use new DI patterns.

## Files to Update

### 1. `src/app/api/dev/__tests__/users.test.ts`

**Current Issues:**

- May import `db` directly
- May mock database module

**Changes Required:**

- Remove direct database imports
- Use DatabaseProvider mocks if testing route directly
- Update any database-related assertions

### 2. Health Route Tests (if exists)

**File:** `src/app/api/health/__tests__/` (check if exists)
**Changes:**

- Mock DatabaseProvider
- Test connection handling

### 3. Upload Route Tests (if exist)

**Files to check:**

- `src/app/api/upload/issue/__tests__/`
- `src/app/api/upload/organization-logo/__tests__/`

**Changes:**

- Update uploadAuth mocks to accept db parameter
- Mock DatabaseProvider for route tests

### 4. QR Code Route Tests (if exist)

**File:** `src/app/api/qr/[qrCodeId]/__tests__/`
**Note:** New functionality from merge

## Common Patterns

### Mocking DatabaseProvider

```typescript
import { DatabaseProvider } from "~/server/db/provider";

jest.mock("~/server/db/provider");

describe("API Route", () => {
  let mockDb: any;
  let mockProvider: any;

  beforeEach(() => {
    mockDb = {
      $queryRaw: jest.fn(),
      // ... other methods
    };

    mockProvider = {
      getClient: jest.fn(() => mockDb),
      disconnect: jest.fn(),
    };

    (DatabaseProvider as jest.Mock).mockImplementation(() => mockProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

### Testing Upload Auth

```typescript
import * as uploadAuth from "~/server/auth/uploadAuth";

jest.mock("~/server/auth/uploadAuth");

// In test
(uploadAuth.validateUploadAuth as jest.Mock).mockResolvedValue({
  authenticated: true,
  // ... other properties
});
```

## Testing Requirements

1. All API route tests compile
2. Database mocks work correctly
3. No real database connections
4. Upload functionality tested

## Acceptance Criteria

- [ ] All API route tests updated
- [ ] DatabaseProvider properly mocked
- [ ] No direct db imports
- [ ] Tests pass
- [ ] New patterns documented
