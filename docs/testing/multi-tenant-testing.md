# ⚠️ DEPRECATED: Multi-Tenant Testing Patterns

**Status**: **DEPRECATED** - Superseded by archetype-based testing system  
**Replacement**: **[archetype-security-testing.md](./archetype-security-testing.md)**  
**Date**: August 2025

---

## 🎯 Use the New Security Testing Archetype

This file has been **superseded** by the comprehensive **Security Testing Archetype**:

**👉 [archetype-security-testing.md](./archetype-security-testing.md)**

The new archetype provides:
- **RLS policy direct testing** patterns (NEW archetype not in this legacy file)
- **Permission matrix validation** with comprehensive coverage
- **Cross-organizational data leakage prevention** testing
- **Agent assignment** (`security-test-architect`) for expert assistance
- **Compliance validation** (GDPR, data isolation)
- **Database-level security enforcement** testing

---

## Legacy Content (For Reference Only)

The content below is **deprecated** and **incomplete** compared to the new archetype. Use the archetype system instead.

---

This guide documents patterns for testing multi-tenant security boundaries, organization isolation, and cross-tenant prevention in a shared database architecture.

## Organization Boundary Testing

### Basic Organization Context Setup

```typescript
describe("🏢 Multi-Tenant Security", () => {
  const org1Context = {
    id: "org-1",
    name: "Organization One",
    subdomain: "org1",
  };

  const org2Context = {
    id: "org-2",
    name: "Organization Two",
    subdomain: "org2",
  };

  it("prevents cross-organization data access", () => {
    // Test that org1 users cannot access org2 data
  });
});
```

### Testing Component-Level Security

```typescript
describe("Component Multi-Tenant Security", () => {
  it("hides admin actions for cross-organization users", () => {
    const org1Machine = createMockMachine({
      location: { organizationId: "org-1" }
    });

    const org2User = createMockSupabaseUser({
      app_metadata: { organization_id: "org-2" }
    });

    render(
      <VitestTestWrapper
        userPermissions={["machine:edit", "machine:delete"]}
        userRole="Admin"
      >
        <MachineDetailView
          machine={org1Machine}
          user={org2User}
          machineId="machine-1"
        />
      </VitestTestWrapper>
    );

    // Should not show edit/delete buttons despite admin permissions
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
```

## API-Level Tenant Isolation

### Testing tRPC Procedures

```typescript
describe("tRPC Multi-Tenant Security", () => {
  const createCaller = createCallerFactory(appRouter);

  it("prevents cross-organization issue creation", async () => {
    const org1Context = createMockTRPCContext(["issue:create"]);
    org1Context.organization = {
      id: "org-1",
      name: "Org 1",
      subdomain: "org1",
    };

    const org2Machine = {
      id: "machine-2",
      location: { organizationId: "org-2" },
    };

    vi.mocked(org1Context.db.machine.findFirst).mockResolvedValue(org2Machine);

    const caller = createCaller(org1Context);

    await expect(
      caller.issue.core.create({
        title: "Cross-org issue",
        machineId: "machine-2", // Belongs to org-2
      }),
    ).rejects.toThrow(
      "Machine not found or does not belong to this organization",
    );
  });
});
```

### Testing Database Queries

```typescript
describe("Database Query Isolation", () => {
  it("scopes all queries by organizationId", async () => {
    const mockContext = createMockTRPCContext();
    const caller = createCaller(mockContext);

    await caller.location.getAll();

    // Verify the query included organization scoping
    expect(mockContext.db.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
        }),
      }),
    );
  });
});
```

## Cross-Organization Assignment Prevention

### User Assignment Validation

```typescript
describe("Cross-Organization Assignment", () => {
  it("prevents assigning users from different organizations", async () => {
    const org1Issue = createTestIssue({ organizationId: "org-1" });
    const org2User = createTestUser({ id: "user-2" });
    const org2Membership = createTestMembership({
      userId: "user-2",
      organizationId: "org-2",
    });

    const result = validateIssueAssignment(
      {
        issueId: org1Issue.id,
        userId: org2User.id,
        organizationId: "org-1",
      },
      {
        issue: org1Issue,
        assignee: org2Membership,
        context: { organizationId: "org-1", actorUserId: "user-1" },
      },
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain("User not member of organization");
  });
});
```

## Public Endpoint Organization Scoping

### Testing Public APIs

```typescript
describe("Public API Organization Scoping", () => {
  it("scopes public data by organization from subdomain", async () => {
    const publicContext = {
      ...createMockTRPCContext(),
      user: null, // No authentication
      organization: { id: "org-1", name: "Public Org", subdomain: "public" },
    };

    const caller = createCaller(publicContext);

    const result = await caller.location.getPublic();

    // Verify only org-1 locations returned
    expect(mockContext.db.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
        }),
      }),
    );
  });

  it("returns 404 for invalid organization", async () => {
    const publicContext = {
      ...createMockTRPCContext(),
      user: null,
      organization: null, // No organization resolved
    };

    const caller = createCaller(publicContext);

    await expect(caller.location.getPublic()).rejects.toThrow(
      "Organization not found",
    );
  });
});
```

## Testing Workflow Boundaries

### Multi-Step Operations

```typescript
describe("Multi-Tenant Workflow Security", () => {
  it("maintains organization boundaries through complex workflows", async () => {
    // Setup: User from org-1 tries to:
    // 1. Create issue on org-1 machine ✓
    // 2. Assign to org-1 user ✓
    // 3. Move to org-2 machine ✗

    const context = createMockTRPCContext(["issue:create", "issue:edit"]);
    const caller = createCaller(context);

    // Step 1: Create issue (should succeed)
    const issue = await caller.issue.core.create({
      title: "Test Issue",
      machineId: "machine-1", // org-1 machine
    });

    expect(issue.organizationId).toBe("org-1");

    // Step 2: Assign to org-1 user (should succeed)
    await caller.issue.core.assign({
      issueId: issue.id,
      userId: "user-1", // org-1 user
    });

    // Step 3: Try to move to org-2 machine (should fail)
    await expect(
      caller.issue.core.update({
        id: issue.id,
        machineId: "machine-2", // org-2 machine
      }),
    ).rejects.toThrow("Machine not found");
  });
});
```

## Testing Permission Boundaries

### Organization-Specific Roles

```typescript
describe("Organization Role Isolation", () => {
  it("admin in one org has no permissions in another", () => {
    const user = createMockSupabaseUser({
      app_metadata: { organization_id: "org-1" },
    });

    const org1Membership = {
      userId: user.id,
      organizationId: "org-1",
      role: { name: "Admin", permissions: ["*"] },
    };

    const org2Context = {
      ...createMockTRPCContext(),
      organization: { id: "org-2" },
      user,
    };

    // User has no membership in org-2
    vi.mocked(org2Context.db.membership.findFirst).mockResolvedValue(null);

    const permissions = getUserPermissions(org2Context);
    expect(permissions).toEqual([]); // No permissions in org-2
  });
});
```

## Batch Operation Testing

### Multi-Tenant Batch Validation

```typescript
describe("Batch Operations Across Organizations", () => {
  it("filters out cross-organization items in batch", async () => {
    const batchItems = [
      { id: "item-1", organizationId: "org-1" }, // Valid
      { id: "item-2", organizationId: "org-2" }, // Invalid
      { id: "item-3", organizationId: "org-1" }, // Valid
    ];

    const result = await processBatch(batchItems, { organizationId: "org-1" });

    expect(result.processed).toHaveLength(2);
    expect(result.processed.map((i) => i.id)).toEqual(["item-1", "item-3"]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("different organization");
  });
});
```

## Testing Data Migration Safety

### Ensuring Organization Boundaries During Migration

```typescript
describe("Data Migration Multi-Tenant Safety", () => {
  it("preserves organization boundaries during data transformation", async () => {
    const legacyData = [
      { id: 1, org_id: "org-1", data: "value1" },
      { id: 2, org_id: "org-2", data: "value2" },
    ];

    const migrationContext = { organizationId: "org-1" };
    const migratedData = await migrateData(legacyData, migrationContext);

    // Should only migrate org-1 data
    expect(migratedData).toHaveLength(1);
    expect(migratedData[0].organizationId).toBe("org-1");
  });
});
```

## Global vs Organization Data

### Testing Mixed Scope Queries

```typescript
describe("Global and Organization Data", () => {
  it("combines global models with organization machines", async () => {
    // Models are global (no organizationId)
    const globalModel = {
      id: "model-1",
      name: "Godzilla",
      manufacturer: "Stern",
    };

    // Machines are organization-scoped
    const org1Machine = {
      id: "machine-1",
      modelId: "model-1",
      organizationId: "org-1",
    };

    const result = await getMachineWithModel("machine-1", "org-1");

    expect(result.machine.organizationId).toBe("org-1");
    expect(result.model.organizationId).toBeUndefined(); // Global
  });
});
```

## Best Practices

1. **Always Test Both Paths**: Test both allowed and denied access scenarios
2. **Use Descriptive Names**: Make organization context clear in test data
3. **Mock at Right Level**: Mock database queries, not business logic
4. **Test Edge Cases**: Empty orgs, deleted orgs, subdomain mismatches
5. **Verify Query Scoping**: Check that WHERE clauses include organizationId

## Common Testing Patterns

### Organization Factory Pattern

```typescript
class OrganizationTestContext {
  constructor(private orgId: string) {}

  createUser(overrides = {}) {
    return createMockSupabaseUser({
      app_metadata: { organization_id: this.orgId },
      ...overrides,
    });
  }

  createMachine(overrides = {}) {
    return {
      id: `machine-${this.orgId}`,
      location: { organizationId: this.orgId },
      ...overrides,
    };
  }

  createContext(permissions = []) {
    return createMockTRPCContext(permissions, this.orgId);
  }
}

// Usage
const org1 = new OrganizationTestContext("org-1");
const org2 = new OrganizationTestContext("org-2");

const user1 = org1.createUser();
const machine2 = org2.createMachine();
```

### Security Boundary Test Matrix

```typescript
const securityTests = [
  {
    action: "view",
    resource: "issue",
    ownerOrg: "org-1",
    actorOrg: "org-1",
    allowed: true,
  },
  {
    action: "view",
    resource: "issue",
    ownerOrg: "org-1",
    actorOrg: "org-2",
    allowed: false,
  },
  {
    action: "edit",
    resource: "machine",
    ownerOrg: "org-1",
    actorOrg: "org-1",
    allowed: true,
  },
  {
    action: "edit",
    resource: "machine",
    ownerOrg: "org-1",
    actorOrg: "org-2",
    allowed: false,
  },
];

securityTests.forEach(({ action, resource, ownerOrg, actorOrg, allowed }) => {
  it(`${allowed ? "allows" : "denies"} ${action} on ${resource} from ${actorOrg} to ${ownerOrg}`, () => {
    const result = checkAccess(action, resource, ownerOrg, actorOrg);
    expect(result).toBe(allowed);
  });
});
```
