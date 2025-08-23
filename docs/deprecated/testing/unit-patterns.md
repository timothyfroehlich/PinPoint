# ⚠️ DEPRECATED: Unit Testing Patterns

**Status**: **DEPRECATED** - Superseded by archetype-based testing system  
**Replacement**: **[archetype-unit-testing.md](./archetype-unit-testing.md)**  
**Date**: August 2025

---

## 🎯 Use the New Archetype System

This file has been **superseded** by the comprehensive **Unit Testing Archetype**:

**👉 [archetype-unit-testing.md](./archetype-unit-testing.md)**

The new archetype provides:

- **Comprehensive patterns** for pure functions, React components, and business logic
- **Agent assignment** (`unit-test-architect`) for expert assistance
- **Performance targets** (<100ms per test)
- **Memory safety guidance** and anti-patterns
- **Integration** with the complete 3-archetype testing system

---

## Legacy Content (For Reference Only)

The content below is **deprecated** and may be **outdated**. Use the archetype system instead.

---

## Overview

With the migration to Drizzle and Supabase, unit testing focuses on pure functions and business logic with minimal mocking. Database-dependent code should use integration tests instead.

## When to Use Unit Tests

✅ **Good candidates for unit tests:**

- Pure utility functions
- Data transformations
- Validation logic
- Permission calculations
- Complex algorithms

❌ **Use integration tests instead for:**

- Database queries
- tRPC procedures
- Authentication flows
- Multi-table operations

## Pure Function Testing

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
});
```

## Service Layer Testing

When services have complex logic beyond database calls, test the logic separately:

### Business Logic Extraction

```typescript
// src/server/services/scoring-service.ts
export class ScoringService {
  // Pure function - easy to unit test
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

  // Database-dependent - use integration tests
  async scoreIssue(db: Database, issueId: string): Promise<number> {
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    // ... fetch related data ...

    return ScoringService.calculateIssuePriority({
      severity: issue.severity,
      // ... other params
    });
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
});
```

## Permission Testing

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

// Unit tests
describe("Permission Utils", () => {
  describe("hasPermission", () => {
    it("matches exact permissions", () => {
      expect(hasPermission(["issue:create"], "issue:create")).toBe(true);
      expect(hasPermission(["issue:view"], "issue:create")).toBe(false);
    });

    it("matches wildcard permissions", () => {
      expect(hasPermission(["issue:*"], "issue:create")).toBe(true);
      expect(hasPermission(["issue:*"], "issue:delete")).toBe(true);
    });

    it("grants all permissions to admin", () => {
      expect(hasPermission(["admin"], "anything:anywhere")).toBe(true);
    });
  });

  describe("combinePermissions", () => {
    it("expands wildcards", () => {
      const result = combinePermissions(["issue:*"]);
      expect(result).toContain("issue:create");
      expect(result).toContain("issue:view");
      expect(result).toContain("issue:edit");
      expect(result).toContain("issue:delete");
    });
  });
});
```

## React Hook Testing

For hooks that don't depend on external services:

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
});
```

## ⚠️ Anti-Patterns to Avoid

### Over-Mocking Database

```typescript
// ❌ BAD: Too much mocking
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([{ id: "1", title: "Test" }]),
};

// ✅ GOOD: Use integration tests for database code
// See integration-patterns.md
```

### Testing Implementation Details

```typescript
// ❌ BAD: Testing private methods
class IssueService {
  private formatTitle(title: string) {
    /* ... */
  }
}

// Test private method directly (DON'T DO THIS)

// ✅ GOOD: Test public API
it("creates issue with formatted title", async () => {
  const issue = await service.createIssue({ title: "test  issue" });
  expect(issue.title).toBe("Test Issue"); // Test the outcome
});
```

### Mocking Everything

```typescript
// ❌ BAD: Mock overload
vi.mock("~/server/db");
vi.mock("~/lib/utils");
vi.mock("~/server/services/notification");

// ✅ GOOD: Use real implementations when possible
// Only mock external services (email, APIs, etc.)
```

## Best Practices

1. **Keep tests focused** - One concept per test
2. **Use descriptive names** - Test name should explain the scenario
3. **Arrange-Act-Assert** - Clear test structure
4. **Minimal mocking** - Prefer real implementations
5. **Test behavior** - Not implementation details
6. **Fast feedback** - Unit tests should run in milliseconds

## When to Use Integration Tests Instead

If you find yourself:

- Mocking database queries
- Testing tRPC procedures
- Verifying multi-table operations
- Testing permission checks with real data
- Validating RLS policies

→ Use [Integration Patterns](./integration-patterns.md) instead!
