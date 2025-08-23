# Testing Architecture Patterns (Phase 3.3 Enhanced)

**Status**: ✅ **Enhanced with Phase 3.3 Findings** - Two validated archetype approaches established  
**Updated**: August 2025 with systematic implementation results  
**Current System**: 3-archetype testing with 2 proven integration approaches

---

## 🎯 Validated Architecture Approaches (Phase 3.3)

Two proven approaches for integration testing emerged from Phase 3.3 systematic implementation:

### **Archetype 5: tRPC Router Integration with Mocks**

✅ **Validated in**: Phase 3.3a (Issue Management), 3.3e (Service Layer)

- **Performance**: Fast execution (200-400ms per test)
- **Reliability**: 22/22 tests passing (`issue.comment.test.ts`)
- **Patterns**: SEED_TEST_IDS, simulated RLS behavior, comprehensive mocking
- **Best for**: Complex router logic, permission scenarios, rapid feedback

### **Archetype 3: PGlite Integration RLS-Enhanced**

✅ **Validated in**: Phase 3.3b (Machine/Location), 3.3c (Admin/Infrastructure)

- **Reality**: Real database operations with full constraints
- **Validation**: True organizational boundary enforcement
- **Patterns**: Worker-scoped memory safety, real constraint testing
- **⚠️ Requires**: Proper RLS context establishment (lessons learned from machine.owner test failures)
- **Best for**: Complex workflows, constraint validation, end-to-end verification

---

## 🚀 Phase 3.3 Implementation Results

### **Sub-Phase Success Summary**

**3.3a (Issue Management)**: ✅ **EXCELLENT**

- 4 router files converted to Archetype 5
- 100% test success rate with consistent SEED_TEST_IDS patterns
- Proven mock-based RLS simulation approach

**3.3b (Machine & Location)**: ✅ **GOOD** with lessons learned

- 2 router files converted to Archetype 3
- 87% test success rate (13/15 passing)
- Identified RLS context establishment challenges

**3.3c (Admin & Infrastructure)**: ✅ **EXCELLENT**

- Memory safety issues resolved
- Mock→tRPC conversions completed successfully
- Pattern standardization achieved

**3.3d (Model & Data Services)**: ⚠️ **MOSTLY COMPLETE**

- Router conversions completed with quality
- Pending validation items for integration enhancement

**3.3e (Service Layer & Routing)**: ✅ **EXCELLENT**

- Complete SEED_TEST_IDS standardization
- Service layer consistency established

### **Key Architectural Insights**

1. **Both Approaches Work**: Mocked and real PGlite patterns both proven effective
2. **RLS Context Critical**: Real PGlite requires careful organizational context setup
3. **Memory Safety Achieved**: Worker-scoped patterns prevent system lockups
4. **SEED_TEST_IDS Success**: Consistent test data architecture across all patterns

---

## 🎯 Current 3-Archetype System Enhanced

**👉 [INDEX.md](./INDEX.md)** - Complete archetype navigation with Phase 3.3 updates

### The Enhanced Architecture:

1. **[archetype-unit-testing.md](./archetype-unit-testing.md)** → `unit-test-architect`
   - ✅ **Phase 3.3e validated**: SEED_TEST_IDS standardization patterns

2. **[archetype-integration-testing.md](./archetype-integration-testing.md)** → `integration-test-architect`
   - ✅ **Phase 3.3 validated**: Two proven approaches (Archetype 5 + Archetype 3)
   - ✅ **Memory safety confirmed**: Worker-scoped patterns prevent lockups

3. **[archetype-security-testing.md](./archetype-security-testing.md)** → `security-test-architect`
   - ⚠️ **Needs enhancement**: RLS context establishment patterns from 3.3b lessons

### Phase 3.3 Proven Benefits:

- **Dual approach validation** - flexibility for different testing needs
- **Memory safety excellence** - zero dangerous patterns found
- **Agent specialization confirmed** - systematic implementation success
- **Real-world validation** - ~22 files successfully converted
- **Clear guidance established** - documented patterns for remaining ~284 files

---

## Legacy Content (For Reference Only)

The content below is **deprecated** and **superseded** by the archetype system. Use the new system instead.

---

> **Context**: This document consolidates proven architecture patterns for testing PinPoint's multi-tenant, permission-based system. These patterns emerge from successful migrations and real-world testing challenges.

## Core Architecture Principles

### Multi-Tenancy Testing Patterns

**Critical Pattern**: Every test query must respect organization scoping.

```typescript
// ✅ Correct: Organization-scoped test data
const mockContext = {
  organization: { id: "org-1", name: "Test Org" },
  session: { user: { id: "user-1" } },
};

// Test data must include organizationId
const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  organizationId: "org-1", // Critical for multi-tenancy
  // ... other properties
};

// Mock database calls respect organization scoping
mockDb.issue.findMany.mockResolvedValue([mockIssue]);
```

**Anti-Pattern**: Tests that ignore organization boundaries

```typescript
// ❌ Wrong: Missing organization context
const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  // Missing organizationId - breaks multi-tenancy
};
```

### Permission-Based Testing Architecture

**Pattern**: Permission checks at the procedure level, not as afterthoughts.

```typescript
// ✅ Standard procedure pattern for testing
describe("Issue Router - Permission Testing", () => {
  beforeEach(() => {
    mockContext = createMockContext({
      organization: mockOrganization,
      session: mockSession,
      userPermissions: ["issue:view", "issue:create"],
    });
  });

  it("enforces permission requirements", async () => {
    // Test with insufficient permissions
    mockContext.userPermissions = ["issue:view"]; // Missing issue:create

    await expect(
      issueRouter.create.call(mockContext, validIssueData),
    ).rejects.toThrow("FORBIDDEN");
  });
});
```

**Key Components**:

1. **organizationProcedure**: Automatic organization membership validation
2. **issueEditProcedure**: Role-based access with resource ownership checks
3. **publicProcedure**: Unauthenticated but organization-scoped access

## Service Layer Testing Patterns

### Centralized Service Architecture

**Pattern**: Single responsibility services with clear testing interfaces.

```typescript
// Service implementation
export class NotificationService {
  constructor(
    private db: ExtendedPrismaClient,
    private emailService: EmailService,
  ) {}

  async createNotification(data: CreateNotificationInput) {
    // Implementation with proper organization scoping
  }
}

// Test pattern - Dependency injection friendly
describe("NotificationService", () => {
  let service: NotificationService;
  let mockDb: DeepMockProxy<ExtendedPrismaClient>;
  let mockEmailService: DeepMockProxy<EmailService>;

  beforeEach(() => {
    mockDb = mockDeep<ExtendedPrismaClient>();
    mockEmailService = mockDeep<EmailService>();
    service = new NotificationService(mockDb, mockEmailService);
  });

  it("creates notification with proper scoping", async () => {
    const input = {
      userId: "user-1",
      type: "issue_created",
      entityId: "issue-1",
      organizationId: "org-1", // Always scoped
    };

    await service.createNotification(input);

    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1", // Verify scoping
      }),
    });
  });
});
```

### Upload Authorization Pattern

**Pattern**: Centralized authorization with multi-tenant support.

```typescript
// Authorization utility testing
export function createUploadAuthTests() {
  return {
    async canUploadToIssue(
      userId: string,
      issueId: string,
      organizationId: string,
    ) {
      // Test helper that validates:
      // 1. User has upload permissions
      // 2. Issue belongs to user's organization
      // 3. Issue exists and is accessible
    },
  };
}

// Usage in tests
describe("Upload Authorization", () => {
  it("enforces multi-tenant upload boundaries", async () => {
    const result = await uploadAuth.canUploadToIssue(
      "user-1",
      "issue-from-different-org",
      "org-1",
    );

    expect(result).toBe(false);
  });
});
```

## Database Testing Patterns

### Comprehensive Query Method Mocking

**Critical Pattern**: Mock ALL query patterns used in production.

```typescript
// ❌ Incomplete: Only mocks common methods
mockDb.issue.findUnique.mockResolvedValue(mockIssue);

// ✅ Complete: Covers all production query patterns
export function setupIssueMocks(mockDb: DeepMockProxy<ExtendedPrismaClient>) {
  // Cover all query methods production code uses
  mockDb.issue.findMany.mockResolvedValue([mockIssue]);
  mockDb.issue.findUnique.mockResolvedValue(mockIssue);
  mockDb.issue.findFirst.mockResolvedValue(mockIssue); // Often missed!
  mockDb.issue.create.mockResolvedValue(mockIssue);
  mockDb.issue.update.mockResolvedValue(mockIssue);

  // Include database extensions
  mockDb.$accelerate = {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  };
}
```

**Discovery Pattern**: Audit production query patterns before creating mocks.

```bash
# Find all Prisma query patterns in codebase
grep -r "\.findFirst" src/server/
grep -r "\.findUnique" src/server/
grep -r "\.findMany" src/server/
```

### Mock Data Structure Completeness

**Pattern**: Mock data should match complete production object shape.

```typescript
// ✅ Complete mock structure
export const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  description: "Test Description",
  status: mockStatus, // Include relations
  priority: mockPriority, // Include relations
  comments: [], // Include expected arrays
  attachments: [], // Include expected arrays
  organizationId: "org-1", // Multi-tenancy
  createdAt: new Date(),
  updatedAt: new Date(),
  // Include ALL properties production code expects
};
```

**Anti-Pattern**: Partial mocks that break when production code evolves.

```typescript
// ❌ Incomplete: Missing expected properties
const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  // Missing: comments, attachments, relations
  // Will break when production code accesses these
};
```

## Permission System Testing Patterns

### Permission Evolution Tracking

**Pattern**: Keep test permissions synchronized with evolving system.

```typescript
// Permission evolution example:
// V1: ["issues:read", "issues:write"]
// V2: ["issue:view", "issue:create", "issue:edit"]

// ✅ Updated test permissions
export const PERMISSION_SCENARIOS = {
  ADMIN: [
    "issue:view",
    "issue:create",
    "issue:edit",
    "machine:view",
    "machine:create",
    "machine:edit",
    "user:manage",
    "org:admin",
  ],
  USER: ["issue:view", "issue:create"],
  VIEWER: ["issue:view"],
};

// Test permission validation
describe("Permission System Evolution", () => {
  it("validates current permission names", () => {
    const validPermissions = getAllValidPermissions();
    PERMISSION_SCENARIOS.ADMIN.forEach((permission) => {
      expect(validPermissions).toContain(permission);
    });
  });
});
```

### React Component Permission Testing

**Pattern**: Use VitestTestWrapper with permission scenarios.

```typescript
// Component testing with permissions
describe('IssueCreateButton', () => {
  it('shows create button for users with issue:create permission', () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view", "issue:create"]}>
        <IssueCreateButton />
      </VitestTestWrapper>
    );

    expect(screen.getByRole('button', { name: /create issue/i })).toBeInTheDocument();
  });

  it('disables create button without issue:create permission', () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view"]}>
        <IssueCreateButton />
      </VitestTestWrapper>
    );

    const button = screen.getByRole('button', { name: /create issue/i });
    expect(button).toBeDisabled();
    // Should show tooltip explaining why disabled
  });
});
```

## MSW-tRPC Integration Patterns

### Type-Safe API Mocking Architecture

**Pattern**: Real tRPC client with HTTP layer mocking.

```typescript
// MSW-tRPC setup for testing
export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: getTestBaseUrl() })], // Links-based config
  transformer: {
    input: superjson,
    output: superjson,
  },
});

// Handler creation pattern
const handlers = [
  trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.data({
        id: "membership-1",
        role: {
          name: "Admin",
          permissions: ["issue:create", "issue:view"],
        },
        organization: { id: "org-1", name: "Test Org" },
      }),
    );
  }),
];
```

**Architecture Benefits**:

- Real tRPC client ensures accurate behavior
- HTTP mocking is more reliable than object mocking
- Full type checking in test environment
- Reusable across all component tests

## Systematic Testing Approaches

### Error Pattern Analysis Strategy

**Pattern**: Categorize failures by type rather than fixing randomly.

```typescript
// Test categorization approach
describe("System Validation", () => {
  describe("Database Query Patterns", () => {
    // Group tests by query type issues
  });

  describe("Permission Boundary Tests", () => {
    // Group tests by permission failures
  });

  describe("Multi-Tenant Isolation", () => {
    // Group tests by organization scoping
  });
});
```

**Priority Framework**:

1. Fix highest-impact issues first (core functionality vs edge cases)
2. Group similar errors and fix in batches
3. Test fixes incrementally to avoid regressions

### Progressive Validation Technique

**Pattern**: Fix core functionality first, then expand to edge cases.

```typescript
// Validation approach
describe("Issue Router - Progressive Validation", () => {
  describe("Core CRUD Operations", () => {
    it("creates issue with proper organization scoping", () => {});
    it("reads issue with permission validation", () => {});
    it("updates issue with ownership checks", () => {});
    it("deletes issue with authorization", () => {});
  });

  describe("Edge Cases", () => {
    // Only after core functionality validated
    it("handles missing attachments gracefully", () => {});
    it("validates complex permission combinations", () => {});
  });
});
```

## Mock Configuration Evolution

### Centralized Default Setup

**Pattern**: Comprehensive default mocks with test-specific overrides.

```typescript
// Centralized mock configuration
export function createMockContext(
  overrides: Partial<MockContext> = {},
): MockContext {
  const mockDb = mockDeep<ExtendedPrismaClient>();

  // Set up ALL common database operations as defaults
  setupIssueMocks(mockDb);
  setupUserMocks(mockDb);
  setupOrganizationMocks(mockDb);
  setupPermissionMocks(mockDb);

  const baseContext = {
    db: mockDb,
    organization: mockOrganization,
    session: mockSession,
    userPermissions: ["issue:view", "issue:create"],
  };

  return { ...baseContext, ...overrides };
}

// Test-specific overrides
it("handles missing issue", () => {
  const mockContext = createMockContext();
  mockContext.db.issue.findFirst.mockResolvedValue(null); // Override default
  // Test logic
});
```

**Benefits**:

- Reduces boilerplate in individual tests
- Ensures consistent mock behavior
- Makes test intent clearer
- Enables systematic testing approach

## Architecture Quality Metrics

### Real-World Results from PinPoint

**Test Coverage Success**:

- Issue router tests: ✅ Fixed and passing
- tRPC authentication: ✅ Working correctly
- Comment system: ✅ Functional
- Permission validation: ✅ Backend operational

**Performance Metrics**:

- Test execution: 7-65x faster than Jest equivalents
- Mock setup time: Reduced by centralized configuration
- Developer productivity: Improved by consistent patterns

**Quality Improvements**:

- Security: Permission-first design prevents authorization gaps
- Maintainability: Centralized patterns reduce duplication
- Reliability: Comprehensive mocking prevents test flakes

## Related Documentation

- **[Migration Guide](./migration-guide.md)** - Vitest migration strategies
- **[Mocking Patterns](./mocking-patterns.md)** - Detailed mocking techniques
- **[Troubleshooting](./troubleshooting.md)** - Debugging approaches
- **[Testing Guide](./GUIDE.md)** - Main testing documentation

## Summary

These architecture patterns enable:

- **Security-first testing** with comprehensive permission validation
- **Multi-tenant safety** through organization scoping in all tests
- **Performance gains** through modern tooling and centralized configuration
- **Maintainable test suites** with consistent patterns and clear intent

The patterns documented here emerge from real migration experience and proven results in production testing scenarios.
