# Unit Testing Archetype

**Agent**: `unit-test-architect`  
**Purpose**: Fast, isolated testing without database dependencies  
**Characteristics**: Pure functions, UI components, business logic validation  
**Execution Speed**: Sub-100ms per test

---

## When to Use This Archetype

✅ **Perfect for**:

- Pure utility functions
- React component behavior
- Business logic calculations
- Validation schemas
- Permission calculations
- Data transformations
- Hook testing (without external services)

❌ **Wrong archetype for**:

- Database queries → Use Integration Testing Archetype
- tRPC procedures → Use Integration Testing Archetype
- Security boundaries → Use Security Testing Archetype
- Multi-table operations → Use Integration Testing Archetype

---

## Core Principles

1. **No Database Dependencies**: Tests run without any database connection
2. **Fast Execution**: Target <100ms per test for immediate feedback
3. **Isolated Testing**: Each test is completely independent
4. **Type-Safe Mocking**: Use `vi.importActual` for partial mocking with types
5. **Behavior Focus**: Test what the code does, not how it does it

---

## Pattern 1: Pure Function Testing

### Utility Functions

```typescript
// src/lib/utils/machine-utils.ts
export function calculateMachineAge(installDate: Date): {
  years: number;
  months: number;
  days: number;
} {
  const now = new Date();
  const diffMs = now.getTime() - installDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays % 30;

  return { years, months, days };
}

// src/lib/utils/__tests__/machine-utils.test.ts
import { describe, it, expect } from "vitest";
import { calculateMachineAge } from "../machine-utils";

describe("calculateMachineAge", () => {
  it("calculates age correctly", () => {
    const installDate = new Date();
    installDate.setFullYear(installDate.getFullYear() - 2);
    installDate.setMonth(installDate.getMonth() - 3);
    installDate.setDate(installDate.getDate() - 15);

    const age = calculateMachineAge(installDate);

    expect(age.years).toBe(2);
    expect(age.months).toBeGreaterThanOrEqual(3);
    expect(age.days).toBeGreaterThanOrEqual(14);
  });

  it("handles current date correctly", () => {
    const today = new Date();
    const age = calculateMachineAge(today);

    expect(age.years).toBe(0);
    expect(age.months).toBe(0);
    expect(age.days).toBe(0);
  });
});
```

### Validation Logic

```typescript
// src/lib/validators/issue-validators.ts
import { z } from "zod";

export const issueSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

export function validateIssueTitle(title: string): {
  valid: boolean;
  error?: string;
} {
  if (!title.trim()) {
    return { valid: false, error: "Title cannot be empty" };
  }

  if (title.length > 255) {
    return { valid: false, error: "Title too long (max 255 characters)" };
  }

  // Check for spam patterns
  const spamPatterns = [/^\d+$/, /^[A-Z\s]+$/, /test\d+/i];
  if (spamPatterns.some((pattern) => pattern.test(title))) {
    return { valid: false, error: "Invalid title format" };
  }

  return { valid: true };
}

// src/lib/validators/__tests__/issue-validators.test.ts
describe("validateIssueTitle", () => {
  it("accepts valid titles", () => {
    const result = validateIssueTitle("Flipper not responding");
    expect(result.valid).toBe(true);
  });

  it("rejects empty titles", () => {
    const result = validateIssueTitle("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects spam patterns", () => {
    const result = validateIssueTitle("TEST123");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid");
  });

  it("accepts normal titles with numbers", () => {
    const result = validateIssueTitle("Machine 1 flipper issue");
    expect(result.valid).toBe(true);
  });
});
```

---

## Pattern 2: Business Logic Testing

### Extracted Business Logic (No Database)

```typescript
// src/server/services/scoring-service.ts
export class ScoringService {
  // Pure function - perfect for unit testing
  static calculateIssuePriority(params: {
    severity: "low" | "medium" | "high" | "critical";
    machineUsage: "low" | "medium" | "high";
    reportCount: number;
    daysSinceReport: number;
  }): number {
    let score = 0;

    // Severity scoring
    const severityScores = { low: 1, medium: 2, high: 3, critical: 4 };
    score += severityScores[params.severity] * 10;

    // Usage impact
    const usageScores = { low: 1, medium: 2, high: 3 };
    score += usageScores[params.machineUsage] * 5;

    // Multiple reports boost priority
    score += Math.min(params.reportCount * 2, 10);

    // Age penalty
    score -= Math.min(params.daysSinceReport, 7);

    return Math.max(score, 0);
  }

  // Database-dependent method - use Integration Testing Archetype
  async scoreIssue(db: Database, issueId: string): Promise<number> {
    // ... database operations
    // Test this with Integration Testing Archetype
  }
}

// Unit test the pure function
describe("ScoringService.calculateIssuePriority", () => {
  it("scores critical issues highest", () => {
    const score = ScoringService.calculateIssuePriority({
      severity: "critical",
      machineUsage: "high",
      reportCount: 3,
      daysSinceReport: 1,
    });

    expect(score).toBeGreaterThan(50);
  });

  it("reduces score for old issues", () => {
    const freshScore = ScoringService.calculateIssuePriority({
      severity: "medium",
      machineUsage: "medium",
      reportCount: 1,
      daysSinceReport: 0,
    });

    const oldScore = ScoringService.calculateIssuePriority({
      severity: "medium",
      machineUsage: "medium",
      reportCount: 1,
      daysSinceReport: 7,
    });

    expect(oldScore).toBeLessThan(freshScore);
  });

  it("caps age penalty at 7 days", () => {
    const score7Days = ScoringService.calculateIssuePriority({
      severity: "medium",
      machineUsage: "medium",
      reportCount: 1,
      daysSinceReport: 7,
    });

    const score30Days = ScoringService.calculateIssuePriority({
      severity: "medium",
      machineUsage: "medium",
      reportCount: 1,
      daysSinceReport: 30,
    });

    expect(score7Days).toBe(score30Days);
  });
});
```

### Permission Calculations

```typescript
// src/lib/permissions/permission-utils.ts
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string,
): boolean {
  // Direct match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check wildcards (e.g., "issue:*" matches "issue:create")
  const [resource, action] = requiredPermission.split(":");
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }

  // Admin override
  if (userPermissions.includes("admin")) {
    return true;
  }

  return false;
}

export function combinePermissions(
  rolePermissions: string[],
  additionalPermissions: string[] = [],
): string[] {
  const combined = new Set([...rolePermissions, ...additionalPermissions]);

  // Expand wildcards
  const expanded = new Set<string>();
  const resources = ["issue", "machine", "user", "organization"];
  const actions = ["create", "view", "edit", "delete"];

  for (const perm of combined) {
    if (perm.endsWith(":*")) {
      const resource = perm.split(":")[0];
      actions.forEach((action) => expanded.add(`${resource}:${action}`));
    } else {
      expanded.add(perm);
    }
  }

  return Array.from(expanded).sort();
}

// Unit tests for permission logic
describe("Permission Utils", () => {
  describe("hasPermission", () => {
    it("matches exact permissions", () => {
      expect(hasPermission(["issue:create"], "issue:create")).toBe(true);
      expect(hasPermission(["issue:view"], "issue:create")).toBe(false);
    });

    it("matches wildcard permissions", () => {
      expect(hasPermission(["issue:*"], "issue:create")).toBe(true);
      expect(hasPermission(["issue:*"], "issue:delete")).toBe(true);
      expect(hasPermission(["machine:*"], "issue:create")).toBe(false);
    });

    it("grants all permissions to admin", () => {
      expect(hasPermission(["admin"], "anything:anywhere")).toBe(true);
      expect(hasPermission(["admin"], "super:secret:operation")).toBe(true);
    });
  });

  describe("combinePermissions", () => {
    it("expands wildcards correctly", () => {
      const result = combinePermissions(["issue:*"]);
      expect(result).toContain("issue:create");
      expect(result).toContain("issue:view");
      expect(result).toContain("issue:edit");
      expect(result).toContain("issue:delete");
    });

    it("combines role and additional permissions", () => {
      const result = combinePermissions(["issue:view"], ["machine:edit"]);
      expect(result).toContain("issue:view");
      expect(result).toContain("machine:edit");
    });

    it("removes duplicates", () => {
      const result = combinePermissions(
        ["issue:view"],
        ["issue:view", "machine:edit"],
      );
      const viewCount = result.filter((p) => p === "issue:view").length;
      expect(viewCount).toBe(1);
    });
  });
});
```

---

## Pattern 3: React Component Testing

### Basic Component Behavior

```typescript
// src/components/issues/__tests__/IssueCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { VitestTestWrapper, VITEST_PERMISSION_SCENARIOS } from '~/test/VitestTestWrapper';
import { IssueCard } from '../IssueCard';

const mockIssue = {
  id: 'issue-1',
  title: 'Test Issue',
  description: 'Test Description',
  status: 'open',
  priority: 'medium',
  createdAt: new Date('2024-01-01'),
  assignedTo: null,
};

describe('IssueCard', () => {
  it('renders issue information correctly', () => {
    render(
      <VitestTestWrapper>
        <IssueCard issue={mockIssue} />
      </VitestTestWrapper>
    );

    expect(screen.getByText('Test Issue')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('shows edit button for users with edit permissions', () => {
    render(
      <VitestTestWrapper
        userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}
        supabaseUser={{
          id: '123',
          user_metadata: { organizationId: 'org-1', role: 'admin' }
        }}
      >
        <IssueCard issue={mockIssue} />
      </VitestTestWrapper>
    );

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('hides edit button for users without edit permissions', () => {
    render(
      <VitestTestWrapper
        userPermissions={VITEST_PERMISSION_SCENARIOS.MEMBER}
        supabaseUser={{
          id: '456',
          user_metadata: { organizationId: 'org-1', role: 'member' }
        }}
      >
        <IssueCard issue={mockIssue} />
      </VitestTestWrapper>
    );

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();

    render(
      <VitestTestWrapper
        userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}
      >
        <IssueCard issue={mockIssue} onEdit={onEdit} />
      </VitestTestWrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(mockIssue.id);
  });
});
```

### Permission-Based Rendering

```typescript
// src/components/common/__tests__/ActionButton.test.tsx
import { render, screen } from '@testing-library/react';
import { VitestTestWrapper } from '~/test/VitestTestWrapper';
import { ActionButton } from '../ActionButton';

describe('ActionButton', () => {
  it('renders when user has required permission', () => {
    render(
      <VitestTestWrapper
        userPermissions={['issue:delete']}
      >
        <ActionButton
          action="delete"
          resource="issue"
          onClick={() => {}}
        >
          Delete Issue
        </ActionButton>
      </VitestTestWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not render when user lacks permission', () => {
    render(
      <VitestTestWrapper
        userPermissions={['issue:view']}
      >
        <ActionButton
          action="delete"
          resource="issue"
          onClick={() => {}}
        >
          Delete Issue
        </ActionButton>
      </VitestTestWrapper>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders for admin users regardless of specific permissions', () => {
    render(
      <VitestTestWrapper
        userPermissions={['admin']}
      >
        <ActionButton
          action="delete"
          resource="issue"
          onClick={() => {}}
        >
          Delete Issue
        </ActionButton>
      </VitestTestWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

---

## Pattern 4: React Hook Testing

### Custom Hook Testing

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// src/hooks/__tests__/useDebounce.test.ts
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays value update", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } },
    );

    expect(result.current).toBe("initial");

    // Update value
    rerender({ value: "updated", delay: 500 });
    expect(result.current).toBe("initial"); // Still initial

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("updated");
  });

  it("cancels previous timeout on value change", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "first", delay: 500 } },
    );

    // Change value before timeout
    rerender({ value: "second", delay: 500 });

    // Advance part way
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current).toBe("first"); // Still original

    // Advance to complete new timeout
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("second"); // Updated to latest
  });
});
```

---

## Pattern 5: Consistent Test Data with SEED_TEST_IDS

### Mock Patterns for Unit Tests

```typescript
// src/server/api/routers/__tests__/machine.test.ts
import {
  SEED_TEST_IDS,
  createMockAdminContext,
} from "~/test/constants/seed-test-ids";
import { machineRouter } from "../machine";

describe("Machine Router Unit Tests", () => {
  // Consistent mock context using SEED_TEST_IDS
  const mockContext = createMockAdminContext();
  // Uses: organizationId: "test-org-pinpoint", userId: "test-user-tim"

  const mockMachineData = {
    id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
    name: "Test Machine",
    organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
    model: "Stern Pinball",
  };

  it("creates machine with consistent mock data", async () => {
    const caller = machineRouter.createCaller(mockContext);

    // Mock database operations with predictable IDs
    vi.mocked(mockDb.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockMachineData]),
      }),
    });

    const result = await caller.create({
      name: "Test Machine",
      model: "Stern Pinball",
    });

    expect(result.id).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
    expect(result.organizationId).toBe(mockContext.organizationId);
  });
});
```

### Benefits of MOCK_PATTERNS

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// ✅ Predictable debugging
const mockIssue = {
  id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE, // "mock-issue-1"
  title: "Test Issue",
  machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE, // "mock-machine-1"
};
// Error message: "mock-issue-1 is failing" vs random UUID

// ✅ Consistent relationships
const mockData = {
  organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
  machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
  // Same IDs across all unit tests
};

// ✅ Helper functions for common scenarios
const createMockIssue = (overrides = {}) => ({
  id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
  title: "Test Issue",
  organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
  createdBy: SEED_TEST_IDS.MOCK_PATTERNS.USER,
  ...overrides,
});
```

---

## Pattern 6: Type-Safe Mocking

### Partial Module Mocking

```typescript
// src/services/__tests__/reportService.test.ts
import type * as IssueServiceModule from "@/server/services/issueService";

// Type-safe partial mocking
vi.mock("@/server/services/issueService", async (importOriginal) => {
  const actual = await importOriginal<typeof IssueServiceModule>();
  return {
    ...actual,
    IssueService: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({ id: "1", title: "Mock Issue" }),
      findByStatus: vi.fn().mockResolvedValue([]),
      // Keep real business logic for testing
      calculatePriority: actual.IssueService.prototype.calculatePriority,
    })),
  };
});

describe("ReportService", () => {
  it("generates priority report using real calculation logic", async () => {
    const reportService = new ReportService();

    // This test uses real calculatePriority logic with mocked data fetching
    const report = await reportService.generatePriorityReport();

    expect(report).toBeDefined();
    // Test the report structure, knowing priority calculations are real
  });
});
```

---

## Anti-Patterns to Avoid

### ❌ Over-Mocking Database Operations

```typescript
// ❌ BAD: Mocking database in unit tests
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([{ id: "1", title: "Test" }]),
};

// ✅ GOOD: Use Integration Testing Archetype for database code
// See archetype-integration-testing.md
```

### ❌ Testing Implementation Details

```typescript
// ❌ BAD: Testing private methods
class IssueService {
  private formatTitle(title: string) {
    /* ... */
  }
}
// Don't test formatTitle directly

// ✅ GOOD: Test public API behavior
it("creates issue with formatted title", async () => {
  const issue = await service.createIssue({ title: "test  issue" });
  expect(issue.title).toBe("Test Issue"); // Test the outcome
});
```

### ❌ Complex Test Setup

```typescript
// ❌ BAD: Complex setup for unit tests
beforeEach(async () => {
  // Multiple database mocks
  // Complex organizational context
  // Heavy infrastructure setup
});

// ✅ GOOD: Simple, focused setup
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

## Quality Guidelines

### Performance Targets

- **<100ms per test**: Unit tests should execute extremely quickly
- **Minimal setup**: Keep beforeEach/beforeAll lightweight
- **Parallel execution**: Tests should be completely independent

### Test Structure

- **Arrange-Act-Assert**: Clear three-phase structure
- **One concept per test**: Each test validates a single behavior
- **Descriptive names**: Test name explains the scenario being tested

### Best Practices

1. **Test behavior, not implementation**: Focus on what the code does
2. **Use real implementations when possible**: Only mock external dependencies
3. **Keep tests focused**: One responsibility per test
4. **Use type safety**: Leverage TypeScript for mock validation
5. **Prefer semantic queries**: Use meaningful selectors in component tests

---

## Agent Assignment

**This archetype is handled by**: `unit-test-architect`

**Agent responsibilities**:

- Ensure sub-100ms execution times
- Implement type-safe mocking patterns
- Test component behavior and permission-based rendering
- Validate business logic without database dependencies
- Maintain testing patterns that resist refactoring

**Quality validation**:

- No database operations in unit tests
- All mocks use type-safe patterns
- Tests focus on behavior, not implementation
- Performance targets are met

---

## When to Escalate to Other Archetypes

**Switch to Integration Testing Archetype when**:

- Test involves database queries
- Testing tRPC procedures
- Need to validate multi-table operations
- Testing complete user workflows

**Switch to Security Testing Archetype when**:

- Testing organizational boundaries
- Validating permission enforcement
- Testing cross-tenant isolation
- Verifying RLS policy behavior

The unit testing archetype provides the foundation for fast, reliable feedback during development while ensuring more complex scenarios are handled by the appropriate specialized testing approaches.
