# Dual-ORM Migration Guide

This guide covers patterns and strategies for gradually migrating from Prisma to Drizzle while maintaining both ORMs in parallel during the transition period.

## Architecture Overview

### tRPC Context Integration

Both ORMs are available in every tRPC procedure:

```typescript
export interface TRPCContext {
  db: ExtendedPrismaClient;      // Existing Prisma client
  drizzle: DrizzleClient;        // New Drizzle client
  user: PinPointSupabaseUser | null;
  supabase: SupabaseServerClient;
  organization: Organization | null;
  membership: Membership | null;
  userPermissions: string[];
}
```

### Context Creation

```typescript
export const createTRPCContext = async (
  opts: CreateTRPCContextOptions
): Promise<TRPCContext> => {
  // ... auth and organization setup ...

  return {
    db: prisma,                    // Existing Prisma instance
    drizzle: createDrizzleClient(), // New Drizzle instance
    user,
    supabase,
    organization,
    membership,
    userPermissions,
  };
};
```

## Migration Strategies

### 1. Parallel Query Validation (Development Only)

Run both ORMs in parallel to validate query equivalence:

```typescript
export const issueRouter = createTRPCRouter({
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Run both queries in parallel during development
      if (process.env.NODE_ENV === "development") {
        const [prismaResult, drizzleResult] = await Promise.all([
          // Existing Prisma query
          ctx.db.issue.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organization.id,
            },
            include: {
              machine: { include: { location: true, model: true } },
              status: true,
              assignedTo: true,
            },
          }),
          
          // New Drizzle query
          ctx.drizzle
            .select({
              id: issues.id,
              title: issues.title,
              description: issues.description,
              machine: {
                id: machines.id,
                name: machines.name,
                location: {
                  id: locations.id,
                  name: locations.name,
                },
                model: {
                  id: models.id,
                  name: models.name,
                },
              },
              status: {
                id: issueStatuses.id,
                name: issueStatuses.name,
              },
              assignedTo: {
                id: users.id,
                name: users.name,
                email: users.email,
              },
            })
            .from(issues)
            .leftJoin(machines, eq(issues.machineId, machines.id))
            .leftJoin(locations, eq(machines.locationId, locations.id))
            .leftJoin(models, eq(machines.modelId, models.id))
            .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
            .leftJoin(users, eq(issues.assignedToId, users.id))
            .where(
              and(
                eq(issues.id, input.id),
                eq(issues.organizationId, ctx.organization.id),
              ),
            )
            .then((results) => results[0]),
        ]);

        // Log any differences for debugging
        if (!deepEqual(prismaResult, drizzleResult)) {
          console.warn("Query mismatch:", {
            prisma: prismaResult,
            drizzle: drizzleResult,
          });
        }
      }

      // Return Prisma result (or Drizzle when ready)
      return prismaResult;
    }),
});
```

### 2. Feature Flag Migration

Use environment variables to switch between ORMs:

```typescript
const USE_DRIZZLE = process.env.USE_DRIZZLE_FOR_ISSUES === "true";

export const issueRouter = createTRPCRouter({
  list: organizationProcedure.query(async ({ ctx }) => {
    if (USE_DRIZZLE) {
      // Drizzle implementation
      return ctx.drizzle
        .select()
        .from(issues)
        .where(eq(issues.organizationId, ctx.organization.id));
    }
    
    // Prisma implementation (default)
    return ctx.db.issue.findMany({
      where: { organizationId: ctx.organization.id },
    });
  }),
});
```

### 3. Gradual Router Migration

Migrate one router at a time:

```typescript
// Phase 1: Keep Prisma for complex routers
export const issueRouter = createTRPCRouter({
  // Complex procedures stay on Prisma initially
  createWithNotifications: organizationProcedure
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // Keep using Prisma for complex transactions
      return ctx.db.$transaction(async (tx) => {
        const issue = await tx.issue.create({ /* ... */ });
        await tx.notification.create({ /* ... */ });
        return issue;
      });
    }),
});

// Phase 2: Simple routers migrate first
export const locationRouter = createTRPCRouter({
  // Simple CRUD operations migrate to Drizzle
  list: organizationProcedure.query(async ({ ctx }) => {
    return ctx.drizzle
      .select()
      .from(locations)
      .where(eq(locations.organizationId, ctx.organization.id));
  }),
});
```

## Type Management

### Shared Type Definitions

Create shared types that work with both ORMs:

```typescript
// src/types/database.ts

// Prisma types
import type { Issue as PrismaIssue } from "@prisma/client";

// Drizzle types
import type { issues } from "~/server/db/schema";
type DrizzleIssue = typeof issues.$inferSelect;

// Unified type for application use
export type Issue = PrismaIssue | DrizzleIssue;

// Type guards
export function isPrismaIssue(issue: Issue): issue is PrismaIssue {
  return "createdAt" in issue && issue.createdAt instanceof Date;
}

export function isDrizzleIssue(issue: Issue): issue is DrizzleIssue {
  return "createdAt" in issue && typeof issue.createdAt === "string";
}
```

### Response Normalization

Normalize responses between ORMs:

```typescript
function normalizeIssue(issue: PrismaIssue | DrizzleIssue): NormalizedIssue {
  if (isPrismaIssue(issue)) {
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    };
  }
  
  // Drizzle already returns ISO strings
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}
```

## Testing During Migration

### Dual Mock Support

Update test utilities to support both ORMs:

```typescript
export function createTestContext(options?: {
  useDrizzle?: boolean;
}): TRPCContext {
  const mockPrisma = createMockPrismaClient();
  const mockDrizzle = createMockDrizzleClient();
  
  return {
    db: mockPrisma,
    drizzle: mockDrizzle,
    // ... other context properties
  };
}
```

### Parallel Test Execution

Run tests against both implementations:

```typescript
describe.each([
  { orm: "prisma", useDrizzle: false },
  { orm: "drizzle", useDrizzle: true },
])("Issue Router with $orm", ({ orm, useDrizzle }) => {
  beforeAll(() => {
    process.env.USE_DRIZZLE_FOR_ISSUES = useDrizzle.toString();
  });

  it("should list issues", async () => {
    const ctx = createTestContext({ useDrizzle });
    const caller = issueRouter.createCaller(ctx);
    
    const result = await caller.list();
    expect(result).toHaveLength(3);
  });
});
```

## Migration Checklist

### Per-Router Migration Steps

- [ ] 1. Implement Drizzle query alongside Prisma
- [ ] 2. Add feature flag for ORM selection
- [ ] 3. Run parallel validation in development
- [ ] 4. Update tests to cover both implementations
- [ ] 5. Deploy with feature flag disabled
- [ ] 6. Enable feature flag in staging
- [ ] 7. Monitor for issues
- [ ] 8. Enable in production
- [ ] 9. Remove Prisma implementation
- [ ] 10. Remove feature flag

### Common Patterns to Migrate

#### Simple CRUD
```typescript
// Prisma
const user = await ctx.db.user.findUnique({
  where: { id: userId },
});

// Drizzle
const [user] = await ctx.drizzle
  .select()
  .from(users)
  .where(eq(users.id, userId));
```

#### Joins
```typescript
// Prisma
const issueWithMachine = await ctx.db.issue.findFirst({
  where: { id: issueId },
  include: { machine: true },
});

// Drizzle
const [issueWithMachine] = await ctx.drizzle
  .select({
    issue: issues,
    machine: machines,
  })
  .from(issues)
  .leftJoin(machines, eq(issues.machineId, machines.id))
  .where(eq(issues.id, issueId));
```

#### Transactions
```typescript
// Prisma
const result = await ctx.db.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  const membership = await tx.membership.create({ data: { userId: user.id } });
  return { user, membership };
});

// Drizzle
const result = await ctx.drizzle.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(userData).returning();
  const [membership] = await tx.insert(memberships)
    .values({ userId: user.id })
    .returning();
  return { user, membership };
});
```

## Performance Monitoring

Track query performance during migration:

```typescript
async function trackQueryPerformance<T>(
  name: string,
  prismaQuery: () => Promise<T>,
  drizzleQuery: () => Promise<T>,
): Promise<{ prismaTime: number; drizzleTime: number; result: T }> {
  const prismaStart = performance.now();
  const prismaResult = await prismaQuery();
  const prismaTime = performance.now() - prismaStart;

  const drizzleStart = performance.now();
  const drizzleResult = await drizzleQuery();
  const drizzleTime = performance.now() - drizzleStart;

  console.log(`Query: ${name}`, {
    prismaTime: `${prismaTime.toFixed(2)}ms`,
    drizzleTime: `${drizzleTime.toFixed(2)}ms`,
    improvement: `${((prismaTime - drizzleTime) / prismaTime * 100).toFixed(1)}%`,
  });

  return { prismaTime, drizzleTime, result: drizzleResult };
}
```

## Rollback Strategy

Each router can be rolled back independently:

```typescript
// Quick rollback via environment variable
process.env.USE_DRIZZLE_FOR_ISSUES = "false";

// Or code-level rollback
const USE_DRIZZLE = false; // Quick toggle

// Emergency rollback procedure
export async function rollbackToPrisma(routerName: string) {
  // 1. Disable feature flag
  await updateEnvVar(`USE_DRIZZLE_FOR_${routerName.toUpperCase()}`, "false");
  
  // 2. Clear any Drizzle-specific caches
  await clearDrizzleCache();
  
  // 3. Log rollback event
  console.error(`Rolled back ${routerName} to Prisma`);
}
```

## Best Practices

1. **Start Simple**: Migrate read-only queries first
2. **Test Thoroughly**: Run both ORMs in parallel during development
3. **Monitor Performance**: Track query times and errors
4. **Rollback Ready**: Keep Prisma code until Drizzle is proven
5. **Type Safety**: Use shared types to avoid duplicated definitions
6. **Incremental Migration**: One router at a time
7. **Document Decisions**: Note any query differences or optimizations

## Troubleshooting

### Common Issues

1. **Type Mismatches**: Drizzle returns different types than Prisma
   - Solution: Use normalization functions

2. **Join Complexity**: Drizzle joins are more explicit
   - Solution: Create helper functions for common joins

3. **Transaction Syntax**: Different transaction APIs
   - Solution: Abstract transaction logic into services

4. **Date Handling**: Prisma returns Date objects, Drizzle returns strings
   - Solution: Consistent date formatting in responses

5. **Null vs Undefined**: Different null handling
   - Solution: Explicit null checks and coercion