# Backend Test Fix Task - Mock-Based Testing

## Context

You are working on the PinPoint project, a multi-tenant issue tracking system. The backend tests need to be fixed to work with the new schema, but importantly, **all tests should use mocked dependencies** rather than hitting a real database.

## Current Issues

1. Some tests incorrectly use `new PrismaClient()` directly, attempting to connect to a database
2. Tests are failing due to outdated schema references (GameTitle → Model, GameInstance → Machine)
3. Missing mocks for new schema fields and relationships

## Your Task

### 1. Fix All Backend Unit Tests

Update tests in these directories to use proper mocking:

- `src/server/api/routers/__tests__/`
- `src/server/services/__tests__/`
- `src/server/auth/__tests__/`
- `src/lib/` (if any have database dependencies)

### 2. Move Integration Tests

Move this test to a new integration test directory:

- `src/server/api/__tests__/notification.schema.test.ts` → `src/integration-tests/notification.schema.test.ts`

This is the ONLY test that should hit a real database because it's specifically testing schema constraints.

### 3. Follow Proper Mocking Patterns

#### Good Pattern (from pinballmapService.test.ts):

```typescript
import { PrismaClient } from "@prisma/client";

// Mock Prisma
jest.mock("@prisma/client");
const MockedPrismaClient = PrismaClient as jest.MockedClass<
  typeof PrismaClient
>;

describe("MyService", () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;

    // Mock specific methods
    mockPrisma.user.create = jest.fn().mockResolvedValue(mockUser);
    mockPrisma.issue.findMany = jest.fn().mockResolvedValue([]);
  });
});
```

#### For tRPC Router Tests:

```typescript
import { createMockContext } from "~/test/mockContext";
import { appRouter } from "~/server/api/root";

const ctx = createMockContext();
const caller = appRouter.createCaller(ctx);

// Mock the Prisma calls
ctx.prisma.issue.create.mockResolvedValue(mockIssue);

// Test the router
const result = await caller.issue.create({
  /* input */
});
```

### 4. Create Mock Context Helper

Create `src/test/mockContext.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
  session?: { user: { id: string } };
  organization?: { id: string; name: string };
};

export function createMockContext(): MockContext {
  return {
    prisma: mockDeep<PrismaClient>(),
    session: undefined,
    organization: undefined,
  };
}

export function resetMockContext(ctx: MockContext) {
  mockReset(ctx.prisma);
}
```

You'll need to install: `npm install --save-dev jest-mock-extended`

### 5. Update Existing Tests

For each test file:

1. **Remove all `new PrismaClient()` usage**
2. **Use mocked Prisma client**
3. **Update schema references**:
   - `GameTitle` → `Model`
   - `GameInstance` → `Machine`
   - Add required fields like `organizationId`, `statusId`, `priorityId`
4. **Mock return values with correct shape**:

```typescript
const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  description: "Test description",
  organizationId: "org-1",
  machineId: "machine-1",
  statusId: "status-1",
  priorityId: "priority-1",
  createdById: "user-1",
  assignedToId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  resolvedAt: null,
  consistency: null,
  checklist: null,
};
```

### 6. Skip Frontend Tests

For now, remove or skip:

- Any tests in `src/app/` directories
- Playwright tests (`*.spec.ts`)
- Component tests

### 7. Update Test Scripts

In `package.json`, add:

```json
{
  "scripts": {
    "test:unit": "jest --testPathIgnorePatterns=integration-tests",
    "test:integration": "jest --testMatch='**/integration-tests/**/*.test.ts'",
    "test": "npm run test:unit"
  }
}
```

## Example Test Transformations

### Before (Bad - Hits Database):

```typescript
describe("IssueService", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  it("creates issue", async () => {
    const issue = await prisma.issue.create({
      data: { title: "Test" },
    });
    expect(issue.title).toBe("Test");
  });
});
```

### After (Good - Mocked):

```typescript
describe("IssueService", () => {
  let mockPrisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>();
  });

  it("creates issue", async () => {
    const mockIssue = {
      id: "1",
      title: "Test",
      // ... all required fields
    };

    mockPrisma.issue.create.mockResolvedValue(mockIssue);

    // Call your service function that uses prisma
    const result = await createIssue(mockPrisma, { title: "Test" });

    expect(mockPrisma.issue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "Test" }),
    });
    expect(result.title).toBe("Test");
  });
});
```

## Commands to Use

```bash
# Run unit tests only (no database)
npm run test:unit

# Run specific test
npm test -- src/server/services/__tests__/notificationService.test.ts

# Check types
npm run typecheck

# Run all checks
npm run pre-commit
```

## Important Notes

1. **NO DATABASE CONNECTIONS** in unit tests - only mocks
2. If a test MUST test database behavior, it goes in `integration-tests/` and should be clearly justified
3. All async operations must be properly mocked with `mockResolvedValue` or `mockRejectedValue`
4. Use typed mocks: `jest.fn<typeof prisma.issue.create>()`
5. Focus on testing business logic, not Prisma itself

## Success Criteria

- All unit tests pass without database connection
- Only schema constraint tests remain in integration folder
- Test coverage meets thresholds: 50% global, 60% server/, 70% lib/
- Tests run fast (< 10 seconds for entire suite)
- No `PrismaClient` instantiation in unit tests
