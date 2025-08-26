# Validation Testing Factory Patterns

This guide documents patterns for testing validation functions using type-safe factory functions and comprehensive edge case coverage.

## Test Data Factory Pattern

### Basic Factory Structure

```typescript
// Type-safe factory with partial overrides
function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function createTestMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    roleId: "role-1",
    user: createTestUser(), // Nested factory usage
    ...overrides,
  };
}
```

### Readonly Type Safety

```typescript
// Use readonly types to prevent accidental mutation
type ReadonlyUser = Readonly<{
  id: string;
  name: string;
  email: string;
}>;

function createReadonlyUser(
  overrides: Partial<ReadonlyUser> = {},
): ReadonlyUser {
  return Object.freeze({
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    ...overrides,
  });
}
```

## Validation Input Factories

### Complex Input Object Factories

```typescript
function createPublicIssueInput(
  overrides: Partial<PublicIssueCreationInput> = {},
): PublicIssueCreationInput {
  return {
    title: "Test Issue",
    description: "Test description",
    machineId: "machine-1",
    reporterEmail: "reporter@example.com",
    submitterName: "Anonymous",
    ...overrides,
  };
}

function createIssueAssignmentInput(
  overrides: Partial<IssueAssignmentInput> = {},
): IssueAssignmentInput {
  return {
    issueId: "issue-1",
    userId: "user-1",
    organizationId: "org-1",
    ...overrides,
  };
}
```

### Context Object Factories

```typescript
function createValidationContext(
  overrides: Partial<ValidationContext> = {},
): ValidationContext {
  return {
    organizationId: "org-1",
    actorUserId: "user-1",
    actorRole: "Member",
    permissions: ["issue:view", "issue:create"],
    timestamp: new Date(),
    ...overrides,
  };
}
```

## Edge Case Testing Patterns

### Email Validation Testing

```typescript
describe("Email Format Validation", () => {
  const validEmails = [
    "user@example.com",
    "user.name@example.com",
    "user+tag@example.com",
    "user_name@example.com",
    "123@example.com",
    "user@subdomain.example.com",
  ];

  const invalidEmails = [
    "notanemail",
    "@example.com",
    "user@",
    "user @example.com",
    "user@example",
    "",
    null,
    undefined,
  ];

  validEmails.forEach((email) => {
    it(`accepts valid email: ${email}`, () => {
      const input = createPublicIssueInput({ reporterEmail: email });
      const result = validateIssueCreationInput(input);
      expect(result.valid).toBe(true);
    });
  });

  invalidEmails.forEach((email) => {
    it(`rejects invalid email: ${String(email)}`, () => {
      const input = createPublicIssueInput({ reporterEmail: email as any });
      const result = validateIssueCreationInput(input);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("email");
    });
  });
});
```

### Boundary Testing

```typescript
describe("String Length Validation", () => {
  it("accepts strings at minimum length", () => {
    const input = createPublicIssueInput({ title: "A" }); // 1 char minimum
    const result = validateIssueCreationInput(input);
    expect(result.valid).toBe(true);
  });

  it("accepts strings at maximum length", () => {
    const maxTitle = "A".repeat(255); // 255 char maximum
    const input = createPublicIssueInput({ title: maxTitle });
    const result = validateIssueCreationInput(input);
    expect(result.valid).toBe(true);
  });

  it("rejects strings exceeding maximum length", () => {
    const tooLongTitle = "A".repeat(256);
    const input = createPublicIssueInput({ title: tooLongTitle });
    const result = validateIssueCreationInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("255 characters");
  });
});
```

## Batch Validation Testing

### Factory for Batch Operations

```typescript
function createBatchAssignments(count: number): IssueAssignmentInput[] {
  return Array.from({ length: count }, (_, i) => ({
    issueId: `issue-${i + 1}`,
    userId: `user-${(i % 3) + 1}`, // Rotate through 3 users
    organizationId: "org-1",
  }));
}

describe("Batch Assignment Validation", () => {
  it("validates large batches efficiently", () => {
    const assignments = createBatchAssignments(100);
    const startTime = performance.now();

    const result = validateBatchAssignments(
      assignments,
      issues,
      users,
      context,
    );

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.valid).toBe(true);
    expect(result.validAssignments).toHaveLength(100);
    expect(duration).toBeLessThan(10); // Should be fast
  });

  it("handles partial batch failures", () => {
    const assignments = [
      createIssueAssignmentInput(), // Valid
      createIssueAssignmentInput({ userId: "invalid-user" }), // Invalid
      createIssueAssignmentInput({ issueId: "issue-2" }), // Valid
    ];

    const result = validateBatchAssignments(
      assignments,
      issues,
      users,
      context,
    );

    expect(result.valid).toBe(false);
    expect(result.validAssignments).toHaveLength(2);
    expect(result.invalidAssignments).toHaveLength(1);
    expect(result.errors[0]).toContain("User not found");
  });
});
```

## State Transition Testing

### Factory for Different States

```typescript
function createIssueInState(state: "new" | "assigned" | "resolved"): Issue {
  const baseIssue = {
    id: "issue-1",
    title: "Test Issue",
    organizationId: "org-1",
    statusId: "status-new",
    assignedToId: null,
    createdById: "user-1",
  };

  switch (state) {
    case "new":
      return { ...baseIssue };
    case "assigned":
      return {
        ...baseIssue,
        assignedToId: "user-2",
        statusId: "status-in-progress",
      };
    case "resolved":
      return {
        ...baseIssue,
        assignedToId: "user-2",
        statusId: "status-resolved",
      };
  }
}

describe("Issue State Transitions", () => {
  const states = ["new", "assigned", "resolved"] as const;

  states.forEach((fromState) => {
    states.forEach((toState) => {
      it(`validates transition from ${fromState} to ${toState}`, () => {
        const issue = createIssueInState(fromState);
        const result = validateStateTransition(issue, toState);

        // Define valid transitions
        const validTransitions = new Set([
          "new->assigned",
          "assigned->resolved",
          "resolved->new", // Reopen
        ]);

        const transition = `${fromState}->${toState}`;
        expect(result.valid).toBe(validTransitions.has(transition));
      });
    });
  });
});
```

## Multi-Tenant Validation Testing

### Organization-Scoped Factories

```typescript
function createOrganizationContext(orgId: string) {
  return {
    createUser: (overrides?: Partial<User>) =>
      createTestUser({ organizationId: orgId, ...overrides }),

    createMachine: (overrides?: Partial<Machine>) =>
      createTestMachine({
        location: { organizationId: orgId },
        ...overrides,
      }),

    createIssue: (overrides?: Partial<Issue>) =>
      createTestIssue({ organizationId: orgId, ...overrides }),
  };
}

describe("Multi-Tenant Validation", () => {
  it("prevents cross-organization operations", () => {
    const org1 = createOrganizationContext("org-1");
    const org2 = createOrganizationContext("org-2");

    const issue = org1.createIssue();
    const user = org2.createUser();

    const result = validateIssueAssignment({
      issueId: issue.id,
      userId: user.id,
      organizationId: "org-1",
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("different organization");
  });
});
```

## Performance Testing Patterns

### Factory with Performance Metrics

```typescript
function createPerformanceTestData(size: "small" | "medium" | "large") {
  const counts = {
    small: { users: 10, issues: 100 },
    medium: { users: 100, issues: 1000 },
    large: { users: 1000, issues: 10000 },
  };

  const { users: userCount, issues: issueCount } = counts[size];

  return {
    users: Array.from({ length: userCount }, (_, i) =>
      createTestUser({ id: `user-${i}` }),
    ),
    issues: Array.from({ length: issueCount }, (_, i) =>
      createTestIssue({
        id: `issue-${i}`,
        assignedToId: i % 10 === 0 ? `user-${i % userCount}` : null,
      }),
    ),
  };
}

describe("Validation Performance", () => {
  ["small", "medium", "large"].forEach((size) => {
    it(`handles ${size} dataset efficiently`, () => {
      const { users, issues } = createPerformanceTestData(size as any);
      const startTime = performance.now();

      // Run validation on entire dataset
      const results = issues.map((issue) => validateIssueData(issue, users));

      const endTime = performance.now();
      const duration = endTime - startTime;
      const opsPerSecond = issues.length / (duration / 1000);

      expect(results.every((r) => r.valid)).toBe(true);
      expect(opsPerSecond).toBeGreaterThan(1000); // Performance threshold
    });
  });
});
```

## Parameterized Testing

### Table-Driven Tests

```typescript
describe("Permission Validation", () => {
  const testCases = [
    { role: "Guest", permissions: [], canCreate: false, canAssign: false },
    {
      role: "Member",
      permissions: ["issue:create"],
      canCreate: true,
      canAssign: false,
    },
    {
      role: "Tech",
      permissions: ["issue:create", "issue:assign"],
      canCreate: true,
      canAssign: true,
    },
    { role: "Admin", permissions: ["*"], canCreate: true, canAssign: true },
  ];

  testCases.forEach(({ role, permissions, canCreate, canAssign }) => {
    describe(`${role} role`, () => {
      const context = createValidationContext({
        actorRole: role,
        permissions,
      });

      it(`${canCreate ? "can" : "cannot"} create issues`, () => {
        const result = validateIssueCreation(createPublicIssueInput(), context);
        expect(result.valid).toBe(canCreate);
      });

      it(`${canAssign ? "can" : "cannot"} assign issues`, () => {
        const result = validateIssueAssignment(
          createIssueAssignmentInput(),
          context,
        );
        expect(result.valid).toBe(canAssign);
      });
    });
  });
});
```

## Best Practices

1. **Immutability**: Use `Object.freeze()` for truly immutable test data
2. **Type Safety**: Always provide proper TypeScript types for factories
3. **Composability**: Build complex factories from simpler ones
4. **Defaults**: Provide sensible defaults that create valid objects
5. **Documentation**: Document what each factory creates and why

## Common Anti-Patterns to Avoid

```typescript
// ❌ Bad: Mutating shared test data
const sharedUser = createTestUser();
sharedUser.name = "Modified"; // Affects other tests!

// ✅ Good: Create new instances or use overrides
const modifiedUser = createTestUser({ name: "Modified" });

// ❌ Bad: Complex inline test data
const result = validate({
  id: "123",
  name: "Test",
  email: "test@example.com",
  // ... 20 more properties
});

// ✅ Good: Use factories
const result = validate(createTestUser({ id: "123" }));

// ❌ Bad: No type safety
const testData = { id: "123", naem: "Test" }; // Typo!

// ✅ Good: Type-safe factories catch typos
const testData = createTestUser({ naem: "Test" }); // TypeScript error
```
