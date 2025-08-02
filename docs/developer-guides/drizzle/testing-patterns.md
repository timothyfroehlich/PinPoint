# Drizzle Testing Patterns

This guide covers testing patterns specific to Drizzle ORM in the PinPoint codebase, including mock strategies, CRUD validation, and integration testing during the dual-ORM migration period.

## Mock Patterns

### Basic Drizzle Client Mock

```typescript
import { vi } from "vitest";
import type { DrizzleClient } from "~/server/db/drizzle";

export const createMockDrizzleClient = (): DrizzleClient => {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
  } as unknown as DrizzleClient;
};
```

### Dual-ORM Test Context

During migration, test contexts must provide both Prisma and Drizzle clients:

```typescript
// src/test/vitestMockContext.ts
export interface VitestMockContext {
  db: ExtendedPrismaClient;      // Existing Prisma mock
  drizzle: DrizzleClient;         // New Drizzle mock
  services: ServiceFactory;
  user: PinPointSupabaseUser | null;
  supabase: typeof mockSupabaseClient;
  organization: { id: string; name: string; subdomain: string; } | null;
  headers: Headers;
}

export function createVitestMockContext(): VitestMockContext {
  const mockDrizzleClient = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  } as unknown as DrizzleClient;

  return {
    db: mockDb,              // Existing Prisma mock
    drizzle: mockDrizzleClient,  // Drizzle mock
    // ... other properties
  };
}
```

## CRUD Validation Testing

### Test Structure

```typescript
describe("Drizzle CRUD Operations", () => {
  let db: DrizzleClient;
  let testOrgId: string;
  let testUserId: string;

  beforeEach(async () => {
    db = createDrizzleClient();
    testOrgId = `test-org-${Date.now()}`;
    testUserId = `test-user-${Date.now()}`;
  });

  afterEach(async () => {
    // Cleanup test data
    try {
      await db.delete(schema.users).where(eq(schema.users.id, testUserId));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrgId));
    } catch (error) {
      console.warn("Cleanup warning:", error);
    }
  });

  describe("INSERT Operations", () => {
    it("should insert with returning clause", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          id: testUserId,
          email: "test@example.com",
          name: "Test User",
          notificationFrequency: "IMMEDIATE",
        })
        .returning();

      expect(user).toBeDefined();
      expect(user?.id).toBe(testUserId);
      expect(user?.email).toBe("test@example.com");
    });
  });

  describe("SELECT Operations", () => {
    it("should perform complex joins", async () => {
      const orgWithLocations = await db
        .select({
          orgId: schema.organizations.id,
          orgName: schema.organizations.name,
          locationId: schema.locations.id,
          locationName: schema.locations.name,
        })
        .from(schema.organizations)
        .leftJoin(
          schema.locations,
          eq(schema.organizations.id, schema.locations.organizationId),
        )
        .where(eq(schema.organizations.id, testOrgId));

      expect(orgWithLocations).toHaveLength(1);
    });
  });
});
```

### Transaction Testing

```typescript
describe("Transaction Operations", () => {
  it("should commit successful transaction", async () => {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ /* ... */ })
        .returning();

      const [org] = await tx
        .insert(schema.organizations)
        .values({ /* ... */ })
        .returning();

      return { user, org };
    });

    expect(result.user).toBeDefined();
    expect(result.org).toBeDefined();
  });

  it("should rollback failed transaction", async () => {
    const txUserId = `rollback-user-${Date.now()}`;

    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.users).values({ id: txUserId, /* ... */ });
        throw new Error("Intentional rollback test");
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    // Verify rollback - user should not exist
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, txUserId));
    
    expect(users).toHaveLength(0);
  });
});
```

## Integration Testing with tRPC

### Testing Dual-ORM Context

```typescript
describe("Drizzle tRPC Integration", () => {
  let mockContext: TRPCContext;
  let mockDrizzleClient: DrizzleClient;

  beforeEach(() => {
    mockDrizzleClient = createMockDrizzleClient();
    
    const baseContext = createVitestMockContext();
    mockContext = {
      ...baseContext,
      drizzle: mockDrizzleClient,
    } as unknown as TRPCContext;
  });

  it("should have both ORMs available in context", () => {
    expect(mockContext.db).toBeDefined();        // Prisma
    expect(mockContext.drizzle).toBeDefined();   // Drizzle
    expect(mockContext.db).not.toBe(mockContext.drizzle);
  });

  it("should handle missing Drizzle client gracefully", async () => {
    const testRouter = createTRPCRouter({
      testProcedure: publicProcedure.query(({ ctx }) => {
        if (!ctx.drizzle) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Drizzle client not available",
          });
        }
        return { success: true };
      }),
    });

    const contextWithoutDrizzle = {
      ...mockContext,
      drizzle: undefined,
    } as unknown as TRPCContext;

    const caller = testRouter.createCaller(contextWithoutDrizzle);
    
    await expect(caller.testProcedure()).rejects.toThrow(
      "Drizzle client not available"
    );
  });
});
```

## Multi-Tenant Isolation Testing

```typescript
describe("Multi-Tenancy Isolation", () => {
  const org1Id = `tenant1-${Date.now()}`;
  const org2Id = `tenant2-${Date.now()}`;

  beforeEach(async () => {
    // Create two organizations with separate data
    await db.insert(schema.organizations).values([
      { id: org1Id, name: "Tenant 1", subdomain: `tenant1-${Date.now()}` },
      { id: org2Id, name: "Tenant 2", subdomain: `tenant2-${Date.now()}` },
    ]);

    await db.insert(schema.locations).values([
      { id: `loc1-${Date.now()}`, name: "Tenant 1 Location", organizationId: org1Id },
      { id: `loc2-${Date.now()}`, name: "Tenant 2 Location", organizationId: org2Id },
    ]);
  });

  it("should properly isolate tenant data", async () => {
    // Tenant 1 should only see their locations
    const tenant1Locations = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.organizationId, org1Id));

    expect(tenant1Locations).toHaveLength(1);
    expect(tenant1Locations[0]?.name).toBe("Tenant 1 Location");
  });

  it("should prevent cross-tenant data access", async () => {
    // Trying to access org2 data with org1 filter should return empty
    const crossTenantLocations = await db
      .select()
      .from(schema.locations)
      .where(
        and(
          eq(schema.locations.organizationId, org1Id),
          sql`${schema.locations.name} LIKE '%Tenant 2%'`,
        ),
      );

    expect(crossTenantLocations).toHaveLength(0);
  });
});
```

## Test Utilities

### Schema Validation Helper

```typescript
export function validateDrizzleSchemaExports() {
  const requiredExports = [
    'users', 'organizations', 'locations', 'machines', 'models',
    'issues', 'memberships', 'roles', 'permissions'
  ];

  requiredExports.forEach(exportName => {
    expect(schema[exportName]).toBeDefined();
    expect(schema[exportName]).toHaveProperty('id');
  });
}
```

### Mock Data Factories

```typescript
export const createMockUser = (overrides?: Partial<NewUser>): NewUser => ({
  id: `user-${Date.now()}`,
  email: `test-${Date.now()}@example.com`,
  name: "Test User",
  notificationFrequency: "IMMEDIATE",
  ...overrides,
});

export const createMockOrganization = (
  overrides?: Partial<NewOrganization>
): NewOrganization => ({
  id: `org-${Date.now()}`,
  name: "Test Organization",
  subdomain: `test-${Date.now()}`,
  ...overrides,
});
```

## Performance Testing

```typescript
it("should validate organizationId indexes work efficiently", async () => {
  const startTime = Date.now();

  const locations = await db
    .select()
    .from(schema.locations)
    .where(eq(schema.locations.organizationId, testOrgId));

  const queryTime = Date.now() - startTime;

  expect(locations).toHaveLength(1);
  // Index queries should be very fast
  expect(queryTime).toBeLessThan(100);
});
```

## Best Practices

1. **Always Clean Up Test Data**: Use unique IDs with timestamps and clean up in `afterEach`
2. **Test Both Success and Failure Paths**: Include transaction rollback and constraint violation tests
3. **Mock at the Right Level**: Mock the Drizzle client for unit tests, use real database for integration tests
4. **Validate Multi-Tenancy**: Always test organization isolation in multi-tenant operations
5. **Use Type-Safe Mocks**: Avoid `any` types, use `as unknown as DrizzleClient` pattern
6. **Test Index Performance**: Validate that performance indexes are actually improving query speed

## Common Pitfalls

1. **Forgetting Cleanup**: Can cause test pollution and flaky tests
2. **Not Testing Rollbacks**: Transaction failures need explicit testing
3. **Missing Multi-Tenant Tests**: Critical for data isolation validation
4. **Over-Mocking**: Some tests benefit from real database interactions
5. **Ignoring TypeScript Errors**: Strict mode catches real issues

## Migration Testing Strategy

During the Prisma to Drizzle migration:

1. **Parallel Testing**: Run same tests against both ORMs
2. **Result Comparison**: Validate identical results from both ORMs
3. **Performance Comparison**: Benchmark Drizzle vs Prisma
4. **Gradual Migration**: Test one router at a time
5. **Rollback Testing**: Ensure procedures can revert to Prisma