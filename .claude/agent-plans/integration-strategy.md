# Drizzle Integration Strategy with Existing DatabaseProvider

**Context**: Integrate Drizzle ORM into existing DatabaseProvider pattern  
**Current System**: Extended Prisma client with Accelerate, singleton provider  
**Goal**: Dual-ORM support during Phase 2A-2E migration

## Current Architecture Analysis

### Existing Database Setup
```typescript
// src/server/db.ts
function createPrismaClientInternal() {
  const baseClient = new PrismaClient({
    log: isDevelopment() ? ["query", "error", "warn"] : ["error"],
  });
  
  return baseClient.$extends(withAccelerate()); // Extended client
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClientInternal>;
```

### Current Provider Pattern
```typescript
// src/server/db/provider.ts
export class DatabaseProvider {
  private instance?: ExtendedPrismaClient;
  
  getClient(): ExtendedPrismaClient {
    this.instance ??= createPrismaClient();
    return this.instance;
  }
}
```

## Integration Strategy

### Phase 2A: Dual-ORM DatabaseProvider

**Approach**: Extend existing provider to support both Prisma and Drizzle

```typescript
// src/server/db/provider.ts (updated)
import { createPrismaClient, type ExtendedPrismaClient } from "~/server/db";
import { createDrizzleClient, type DrizzleClient } from "~/server/db/drizzle";

export class DatabaseProvider {
  private prismaInstance?: ExtendedPrismaClient;
  private drizzleInstance?: DrizzleClient;

  // Existing Prisma method (unchanged)
  getClient(): ExtendedPrismaClient {
    this.prismaInstance ??= createPrismaClient();
    return this.prismaInstance;
  }

  // New Drizzle method
  getDrizzleClient(): DrizzleClient {
    this.drizzleInstance ??= createDrizzleClient();
    return this.drizzleInstance;
  }

  // Updated for dual-ORM support
  async disconnect(): Promise<void> {
    await Promise.all([
      this.prismaInstance?.$disconnect(),
      this.drizzleInstance?.sql?.end(), // Close postgres-js connection
    ]);
    delete this.prismaInstance;
    delete this.drizzleInstance;
  }

  reset(): void {
    delete this.prismaInstance;
    delete this.drizzleInstance;
  }
}
```

### New Drizzle Client Module

```typescript
// src/server/db/drizzle.ts (new file)
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { isDevelopment } from "~/lib/environment";
import * as schema from './schema';

function createDrizzleClientInternal() {
  const connectionString = process.env.POSTGRES_PRISMA_URL!;
  
  const sql = postgres(connectionString, {
    max: 1,                    // Serverless optimization
    idle_timeout: 20,          
    connect_timeout: 10,       
    ssl: 'require',           // Supabase requirement
  });

  return drizzle(sql, { 
    schema,
    logger: isDevelopment(), // Match Prisma logging behavior
  });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClientInternal>;

export const createDrizzleClient = (): DrizzleClient => {
  return createDrizzleClientInternal();
};

// Export the sql connection for cleanup
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
```

### Development Hot-Reload Support

```typescript
// src/server/db/drizzle.ts (with singleton pattern)
declare global {
  var __drizzle: DrizzleClient | undefined;
  var __sql: ReturnType<typeof postgres> | undefined;
}

export const createDrizzleClient = (): DrizzleClient => {
  if (process.env.NODE_ENV === 'production') {
    return createDrizzleClientInternal();
  }

  // Development: reuse connection across hot reloads
  if (!global.__drizzle) {
    const sql = postgres(process.env.POSTGRES_PRISMA_URL!, { max: 1 });
    global.__sql = sql;
    global.__drizzle = drizzle(sql, { 
      schema,
      logger: isDevelopment(),
    });
  }

  return global.__drizzle;
};
```

## tRPC Context Integration

### Current tRPC Context
```typescript
// src/server/api/trpc.ts (current)
export const createTRPCContext = async (opts: CreateTRPCContextOptions) => {
  const session = await getServerAuthSession(opts);
  const organization = await resolveOrganization(opts);

  return {
    session,
    organization,
    db: getGlobalDatabaseProvider().getClient(), // Prisma client
  };
};
```

### Updated for Dual-ORM
```typescript
// src/server/api/trpc.ts (Phase 2A)
export const createTRPCContext = async (opts: CreateTRPCContextOptions) => {
  const session = await getServerAuthSession(opts);
  const organization = await resolveOrganization(opts);
  const dbProvider = getGlobalDatabaseProvider();

  return {
    session,
    organization,
    db: dbProvider.getClient(),        // Prisma (existing)
    drizzle: dbProvider.getDrizzleClient(), // Drizzle (new)
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
```

## Validation Infrastructure

### Query Equivalence Testing
```typescript
// src/server/db/validation.ts (new file)
import { type Context } from "~/server/api/trpc";
import { isDevelopment } from "~/lib/environment";

export async function validateQueryEquivalence<T>(
  prismaQuery: () => Promise<T>,
  drizzleQuery: () => Promise<unknown>,
  operationName: string
): Promise<T> {
  if (!isDevelopment()) {
    // Production: use Drizzle only
    return drizzleQuery() as Promise<T>;
  }

  // Development: validate both return same results
  const [prismaResult, drizzleResult] = await Promise.all([
    prismaQuery(),
    drizzleQuery(),
  ]);

  // Normalize and compare results
  const normalizedPrisma = normalizeResult(prismaResult);
  const normalizedDrizzle = normalizeResult(drizzleResult);

  if (!deepEqual(normalizedPrisma, normalizedDrizzle)) {
    console.error(`❌ Query equivalence failed for ${operationName}`);
    console.error('Prisma result:', normalizedPrisma);
    console.error('Drizzle result:', normalizedDrizzle);
    
    // Option: throw error to catch issues early
    throw new Error(`Query equivalence validation failed: ${operationName}`);
  }

  console.log(`✅ Query equivalence validated: ${operationName}`);
  return prismaResult;
}

function normalizeResult(result: unknown): unknown {
  // Handle arrays, objects, dates, etc. for comparison
  if (result === null || result === undefined) return result;
  if (result instanceof Date) return result.toISOString();
  if (Array.isArray(result)) return result.map(normalizeResult);
  if (typeof result === 'object') {
    return Object.fromEntries(
      Object.entries(result).map(([key, value]) => [key, normalizeResult(value)])
    );
  }
  return result;
}
```

### Router Migration Pattern
```typescript
// Example: src/server/api/routers/user.ts (during migration)
export const userRouter = createTRPCRouter({
  getProfile: authenticatedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return validateQueryEquivalence(
        // Prisma query (existing)
        () => ctx.db.user.findFirst({
          where: { id: input.userId },
          include: { memberships: { include: { role: true } } }
        }),
        
        // Drizzle query (new)
        () => ctx.drizzle.select()
          .from(users)
          .leftJoin(memberships, eq(users.id, memberships.userId))
          .leftJoin(roles, eq(memberships.roleId, roles.id))
          .where(eq(users.id, input.userId)),
        
        'userRouter.getProfile'
      );
    }),
});
```

## File Structure Changes

### New Files
```
src/server/db/
├── provider.ts          # Updated for dual-ORM
├── drizzle.ts           # New Drizzle client
├── validation.ts        # New validation utilities
└── schema/              # New schema directory
    ├── index.ts
    ├── auth.ts
    ├── organizations.ts
    ├── machines.ts
    ├── issues.ts
    └── collections.ts
```

### Updated Files
- `src/server/db/provider.ts` - Add Drizzle support
- `src/server/api/trpc.ts` - Add Drizzle to context

## Testing Strategy

### Provider Tests Update
```typescript
// src/server/db/__tests__/provider.test.ts (update existing)
describe('DatabaseProvider', () => {
  // Existing Prisma tests (unchanged)
  
  // New Drizzle tests
  it('should create and reuse Drizzle client', () => {
    const provider = new DatabaseProvider();
    const client1 = provider.getDrizzleClient();
    const client2 = provider.getDrizzleClient();
    
    expect(client1).toBe(client2); // Same instance
  });

  it('should disconnect both clients', async () => {
    const provider = new DatabaseProvider();
    provider.getClient();        // Initialize Prisma
    provider.getDrizzleClient(); // Initialize Drizzle
    
    await expect(provider.disconnect()).resolves.not.toThrow();
  });
});
```

## Environment Considerations

### No Environment Changes Needed
- **POSTGRES_PRISMA_URL**: Used by both Prisma and Drizzle
- **POSTGRES_URL_NON_POOLING**: Used for migrations only
- **Existing env.js**: No changes required

### Development vs Production
```typescript
// Different behavior based on environment
const shouldValidate = isDevelopment() && process.env.VALIDATE_QUERIES !== 'false';
const useValidation = shouldValidate ? validateQueryEquivalence : (_, drizzleQuery) => drizzleQuery();
```

## Rollback Strategy

### Quick Removal Process
1. **Remove Drizzle imports** from tRPC context
2. **Comment out `getDrizzleClient()`** method
3. **Disable validation calls** in routers
4. **Keep Prisma unchanged** (zero risk)

### Minimal Impact
- **No schema changes**: Database remains unchanged
- **No env changes**: Same connection strings
- **No type changes**: Existing Prisma types preserved
- **Clean separation**: Drizzle is purely additive

## Success Criteria

### Integration Requirements
- [ ] DatabaseProvider supports both Prisma and Drizzle clients
- [ ] tRPC context includes both database clients
- [ ] Hot-reload works correctly in development
- [ ] Connection pooling operates within Supabase limits
- [ ] Logging behavior matches between ORMs

### Development Experience
- [ ] Query validation catches discrepancies early
- [ ] Error messages clearly identify source (Prisma vs Drizzle)
- [ ] Performance monitoring shows both ORM operations
- [ ] Type safety maintained across all integrations

### Production Readiness
- [ ] Graceful connection cleanup on shutdown
- [ ] Memory usage remains stable during dual-ORM period
- [ ] Performance baseline maintained
- [ ] Rollback process tested and verified

## Implementation Order

1. **Create Drizzle client** (`src/server/db/drizzle.ts`)
2. **Update DatabaseProvider** (add `getDrizzleClient()`)
3. **Update tRPC context** (add Drizzle client)
4. **Create validation utilities** (`src/server/db/validation.ts`)
5. **Test integration** (database connectivity and provider tests)

This integration strategy maintains the existing architecture while safely adding Drizzle support for the migration period.