# Phase 5.2: Auth Tests

## Priority: MEDIUM - CAN BE DONE IN PARALLEL WITH OTHER TEST UPDATES

## Dependencies

- Phase 4 (Testing Infrastructure) must be completed
- Phase 3.2 (Auth refactoring) should be completed

## Objective

Update authentication-related test files to use factory pattern.

## Files to Update

### 1. `src/server/auth/__tests__/config.test.ts`

**Current Issues:**

- Imports auth config directly
- May import database

**Changes Required:**

```typescript
// Before
import { authConfig } from "~/server/auth/config";

// After
import { createAuthConfig } from "~/server/auth/config";
import { mockDeep } from "jest-mock-extended";
import type { ExtendedPrismaClient } from "~/server/db";

describe("Auth Config", () => {
  let mockDb: ExtendedPrismaClient;
  let authConfig: any;

  beforeEach(() => {
    mockDb = mockDeep<ExtendedPrismaClient>();
    authConfig = createAuthConfig(mockDb);
  });

  // ... tests
});
```

### 2. Upload Auth Tests (if exist)

**File:** `src/server/auth/__tests__/uploadAuth.test.ts`
**Changes:**

- Test with database parameter
- Mock database operations

### 3. Integration Tests

**Files that test auth flow:**

- May be in `__tests__` directories
- May be in e2e tests

**Changes:**

- Ensure auth provider uses mock database
- Update any auth flow tests

## Testing Patterns

### Testing Auth Config Factory

```typescript
it("should create config with database", () => {
  const config = createAuthConfig(mockDb);
  expect(config.adapter).toBeDefined();
  expect(config.providers).toHaveLength(2); // Google + Credentials
});
```

### Testing Callbacks

```typescript
it("should handle session callback", async () => {
  const config = createAuthConfig(mockDb);

  // Mock user with membership
  mockDb.user.findUnique.mockResolvedValue({
    id: "123",
    memberships: [{ organizationId: "org-1" }],
  });

  const session = await config.callbacks.session({
    session: { user: { id: "123" } },
    token: { id: "123" },
  });

  expect(session.user.organizationId).toBe("org-1");
});
```

### Testing Upload Auth

```typescript
describe("validateUploadAuth", () => {
  it("should validate with database", async () => {
    const mockDb = mockDeep<ExtendedPrismaClient>();
    mockDb.session.findUnique.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
    });

    const result = await validateUploadAuth(mockDb, "session-1", "org-1");

    expect(result.authenticated).toBe(true);
  });
});
```

## Special Considerations

- NextAuth may have internal caching
- PrismaAdapter behavior in tests
- Session/JWT handling

## Acceptance Criteria

- [ ] Auth config tests use factory
- [ ] No direct database imports
- [ ] Upload auth tests updated
- [ ] All auth tests pass
- [ ] Mock patterns documented
