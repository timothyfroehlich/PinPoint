# Vitest Best Practices - Agent Quick Reference

## 🚀 Critical Info for Agents (Lines 1-50)

### Essential Commands

```bash
# Run tests
npm run test           # All tests
npm run test:coverage  # Coverage report
npm run test:watch     # Watch mode
npm run test:ui        # Interactive UI

# Agent validation
npm run quick    # Fast validation
npm run validate # Pre-commit check
```

### Core Import Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
```

### Essential Mocking Patterns

```typescript
// Basic mock
vi.mock("~/module");

// With implementation
vi.mock("~/service", () => ({
  ServiceClass: vi.fn(() => ({ method: vi.fn() })),
}));

// Hoisted variables
const { mockData } = vi.hoisted(() => ({ mockData: { id: 1 } }));

// Clear mocks
beforeEach(() => vi.clearAllMocks());
```

### Performance Data (Real Results)

- **7-65x faster** than Jest on pure functions
- **8-10x faster** on React components
- **12-19x faster** on service layer tests
- **Overall**: 87-93% test success rates

### Critical MSW-tRPC v2.0.1 Pattern

```typescript
// ✅ CORRECT (uses links array)
export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: "http://localhost:3000/api/trpc" })],
  transformer: { input: superjson, output: superjson },
});

// ❌ WRONG (baseUrl doesn't exist)
// baseUrl: 'http://localhost:3000/api/trpc' // This property doesn't exist!
```

---

## 📋 Detailed Patterns (Lines 51+)

### Architecture Benefits

**Why Vitest > Jest**:

- **Explicit Dependencies**: Forces better architecture through explicit mocking
- **ESM Native**: No transform overhead, faster execution
- **Better TypeScript**: First-class TypeScript support without ts-jest
- **Intentional Design Pressure**: Makes bad patterns difficult, promotes DI

### Multi-Tenant Security Testing

**Critical Pattern**: All tests must validate organization scoping:

```typescript
// Mock context with organization
const mockContext = {
  organization: { id: "org-1", name: "Test Org" },
  session: { user: { id: "user-1" } },
};

// Verify organization scoping in queries
expect(mockDb.issue.findMany).toHaveBeenCalledWith({
  where: { organizationId: "org-1" }, // MUST be present
});
```

### Permission-Based UI Testing

**Pattern**: Use VitestTestWrapper for permission testing:

```typescript
import { VitestTestWrapper, VITEST_PERMISSION_SCENARIOS } from '~/test/VitestTestWrapper';

const TestComponent = () => (
  <VitestTestWrapper
    userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}
    userRole="Admin"
  >
    <PermissionGate permission="issue:edit" hasPermission={mockHasPermission}>
      <button>Edit Issue</button>
    </PermissionGate>
  </VitestTestWrapper>
);
```

### Service Layer Testing with DI

**Modern Pattern**: Constructor injection for testability:

```typescript
export class NotificationService {
  constructor(
    private db: ExtendedPrismaClient,
    private emailService: EmailService,
  ) {}
}

// Test setup
describe("NotificationService", () => {
  let service: NotificationService;
  let mockDb: DeepMockProxy<ExtendedPrismaClient>;

  beforeEach(() => {
    mockDb = mockDeep<ExtendedPrismaClient>();
    service = new NotificationService(mockDb, mockEmailService);
  });
});
```

### Common Anti-Patterns to Avoid

```typescript
// ❌ DON'T: Mock framework itself
vi.mock("react");

// ❌ DON'T: Mock types
vi.mock("~/types");

// ❌ DON'T: Complex logic in mock declaration
vi.mock("~/service", () => ({
  getData: () => {
    if (someCondition) {
      // someCondition not in scope!
      return mockData1;
    }
    return mockData2;
  },
}));

// ✅ DO: Use variables from vi.hoisted()
const { mockData } = vi.hoisted(() => ({ mockData: { id: 1 } }));
vi.mock("~/service", () => ({ getData: () => mockData }));
```

### MSW-tRPC Integration Troubleshooting

**Common Error**: "links is not iterable"

- **Cause**: Using old configuration format with `baseUrl`
- **Fix**: Use links array: `links: [httpLink({ url: testUrl })]`

**Common Error**: Transformer mismatch

- **Cause**: Client and MSW using different transformer config
- **Fix**: Ensure both use same transformer structure

### Component Testing Migration

**Before (Jest)**:

```tsx
/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
jest.mock("@mui/material", () => ({
  /* ... */
}));
```

**After (Vitest)**:

```tsx
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
vi.mock("@mui/material", () => ({
  /* ... */
}));
```

### Database Mocking Patterns

```typescript
// Mock ALL query patterns used by services
mockDb.notification.findMany.mockResolvedValue([mockNotification]);
mockDb.notification.findUnique.mockResolvedValue(mockNotification);
mockDb.notification.findFirst.mockResolvedValue(mockNotification);
mockDb.notification.create.mockResolvedValue(mockNotification);
mockDb.notification.update.mockResolvedValue(mockNotification);
mockDb.notification.delete.mockResolvedValue(mockNotification);
```

### When to Mock vs Refactor

**Just Mock When:**

- < 3 dependencies
- Pure utility functions
- Time-sensitive migration
- External APIs

**Refactor to DI When:**

- 5+ transitive dependencies
- Circular dependencies
- Core business logic
- Frequent test changes

### Test Organization Patterns

```typescript
describe("ComponentName", () => {
  const mockFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user has permission", () => {
    beforeEach(() => {
      mockHasPermission.mockReturnValue(true);
    });

    it("should render enabled button", () => {
      // Test implementation
    });
  });

  describe("when user lacks permission", () => {
    beforeEach(() => {
      mockHasPermission.mockReturnValue(false);
    });

    it("should render disabled button with tooltip", () => {
      // Test implementation
    });
  });
});
```

### Error Handling Patterns

```typescript
// Test error scenarios
mockDb.entity.create.mockRejectedValue(new Error("Database error"));
await expect(service.method()).rejects.toThrow("Database error");

// Test network errors with MSW
const handlers = [
  trpcMsw.procedure.query((req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: "Server error" }));
  }),
];
```

### Performance Optimization Tips

1. **Use vi.hoisted()** for shared mock data
2. **Clear mocks in beforeEach()** to prevent test interference
3. **Mock only what you need** - avoid over-mocking
4. **Use MSW for HTTP-level mocking** instead of module mocking when possible
5. **Batch related tests** in describe blocks with shared setup

### tRPC Component Testing Patterns

**The Problem**: Partial tRPC mocking can break React component rendering. A common error is `Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined`.

**The Solution**: Preserve the tRPC React components by using `vi.importActual()` and only mocking the specific queries you need to.

```typescript
vi.mock("~/trpc/react", async () => {
  const actual =
    await vi.importActual<typeof import("~/trpc/react")>("~/trpc/react");
  return {
    ...actual,
    api: {
      ...actual.api,
      createClient: actual.api.createClient, // ← CRITICAL
      Provider: actual.api.Provider, // ← CRITICAL
      issue: {
        core: {
          getAll: {
            useQuery: mockIssuesQuery,
          },
        },
      },
      // ... other mocked queries
    },
  };
});
```

**Key Insight**: The `VitestTestWrapper` needs the real `api.createClient` and `api.Provider` to function correctly.

**`vi.hoisted()` is Mandatory**: All mock functions referenced in `vi.mock()` calls must be created with `vi.hoisted()` to avoid `ReferenceError: Cannot access 'mockX' before initialization`.

```typescript
const { mockIssuesQuery } = vi.hoisted(() => ({
  mockIssuesQuery: vi.fn(),
}));
```

**MUI Component Testing**: For complex MUI components like `Select` that may not have accessible names, use position-based selection.

```typescript
// ✅ Works - select by position with type assertion
const comboboxes = screen.getAllByRole("combobox");
expect(comboboxes).toHaveLength(4);
const locationSelect = comboboxes[0] as HTMLElement;
```

### Quick Migration Checklist

- [ ] Update imports: `jest` → `vitest`
- [ ] Update DOM imports: `'@testing-library/jest-dom'` → `'@testing-library/jest-dom/vitest'`
- [ ] Update mocks: `jest.mock` → `vi.mock`
- [ ] Update functions: `jest.fn()` → `vi.fn()`
- [ ] Update cleanup: `jest.clearAllMocks()` → `vi.clearAllMocks()`
- [ ] Add type annotations to mocks for better TypeScript support
- [ ] Verify MSW-tRPC uses links array, not baseUrl
- [ ] Test organization scoping in multi-tenant tests
- [ ] Validate permission boundaries in security tests

## Real Migration Results

### Component Tests

- PermissionButton: 672ms → 68ms (**9.9x faster**)
- PermissionGate: 676ms → 86ms (**7.9x faster**)
- Overall: 87% success rate

### Service Tests

- CollectionService: **13.3x faster**
- NotificationService: **19.0x faster**
- PermissionService: **7.5x faster**
- Overall: 12-19x improvements

### API Security Tests

- Multi-tenant security: **7-38x faster**
- tRPC auth procedures: **10-25x faster**
- Permission validation: **15-30x faster**

The migration to Vitest not only improves performance but drives better architecture through explicit dependency management and cleaner testing patterns.
