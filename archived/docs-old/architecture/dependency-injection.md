# Dependency Injection Architecture

**Status**: ✅ **Active** - Current implementation patterns  
**Audience**: Developers, Architecture Review  
**Last Updated**: July 25, 2025

---

## Overview

PinPoint uses a sophisticated dependency injection system that balances testability, type safety, and development productivity. The architecture follows proven patterns for service layer organization, database access, and context-based injection through tRPC.

---

## Core Architecture

### Service Factory Pattern

> ⚠️ **MIGRATION IN PROGRESS**: The Service Factory pattern is being removed as part of the Drizzle migration.
>
> - **Current**: Services instantiated through factory with Prisma dependency
> - **Target**: Direct service instantiation with Drizzle database client
> - **Reason**: Simplifies architecture without losing testability
>
> For new code, instantiate services directly: `new NotificationService(db)`
>
> See [Migration Guide](/docs/migration/supabase-drizzle/) for details.

**Location**: `src/server/services/factory.ts`

~~PinPoint uses a **Service Factory** to manage business logic dependencies:~~ **(Being Removed)**

```typescript
export class ServiceFactory {
  constructor(private db: ExtendedPrismaClient) {}

  createNotificationService(): NotificationService {
    return new NotificationService(this.db);
  }

  createCollectionService(): CollectionService {
    return new CollectionService(this.db);
  }

  createIssueActivityService(): IssueActivityService {
    return new IssueActivityService(this.db);
  }
}
```

**Benefits**:

- **Single Responsibility**: Each service handles one domain
- **Constructor Injection**: Clear dependency requirements
- **Type Safety**: Full TypeScript support throughout
- **Testability**: Easy to mock individual services

### Database Provider Singleton

**Location**: `src/server/db/provider.ts`

Database access uses a **singleton provider** with lazy initialization:

```typescript
export class DatabaseProvider {
  private instance?: ExtendedPrismaClient;

  getClient(): ExtendedPrismaClient {
    this.instance ??= createPrismaClient();
    return this.instance;
  }
}

// Global singleton for production
export function getGlobalDatabaseProvider(): DatabaseProvider {
  globalProvider ??= new DatabaseProvider();
  return globalProvider;
}
```

**Features**:

- **Prisma Accelerate**: Automatically applied to all connections
- **Environment Logging**: Query logs in dev, errors only in production
- **Reset Support**: Clean slate for testing
- **Type Extensions**: Custom `ExtendedPrismaClient` with accelerate typing

---

## tRPC Context Injection

**Location**: `src/server/api/trpc.base.ts`

### Context Structure

```typescript
export interface TRPCContext {
  db: ExtendedPrismaClient; // Database client
  session: Session | null; // Authentication state
  organization: Organization | null; // Multi-tenant context
  services: ServiceFactory; // Business logic services
  headers: Headers; // HTTP headers for subdomain detection
}
```

### Context Creation Flow

1. **Database**: Get singleton Prisma client via provider
2. **Services**: Create factory with database dependency
3. **Authentication**: Resolve NextAuth session from request
4. **Multi-tenancy**: Resolve organization via subdomain/session
5. **Headers**: Extract HTTP headers for routing logic

### Usage in Routers

```typescript
export const issueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(CreateIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // Services injected via context
      const activityService = ctx.services.createIssueActivityService();

      // Database injected via context
      const issue = await ctx.db.issue.create({
        data: {
          ...input,
          organizationId: ctx.organization.id,
          createdById: ctx.session.user.id,
        },
      });

      // Use service for business logic
      await activityService.logIssueCreated(issue.id, ctx.session.user.id);

      return issue;
    }),
});
```

---

## Authentication Context Hierarchy

PinPoint uses **graduated context types** based on authentication level:

### Context Types

```typescript
// Base context - may have null session
interface TRPCContext {
  session: Session | null;
  // ...
}

// Guaranteed authenticated user
interface ProtectedTRPCContext extends TRPCContext {
  session: Session & { user: User };
}

// Authenticated + organization membership verified
interface OrganizationTRPCContext extends ProtectedTRPCContext {
  organization: Organization;
}
```

### Middleware Chain

```typescript
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
      ctx: {
        ...ctx,
        session: { ...ctx.session, user: ctx.session.user },
      } satisfies ProtectedTRPCContext,
    });
  });
```

**Benefits**:

- **Type Safety**: TypeScript knows user is authenticated in protected procedures
- **Progressive Enhancement**: Each middleware adds guarantees
- **Clear Boundaries**: Authentication requirements explicit in procedure types

---

## Testing Dependency Injection

### Mock Context Creation

**Location**: `src/test/mockContext.ts`

```typescript
export function createMockContext(): MockContext {
  const mockDb: DeepMockProxy<ExtendedPrismaClient> =
    mockDeep<ExtendedPrismaClient>();
  const mockServices = createMockServiceFactory();

  return {
    db: mockDb,
    services: mockServices,
    session: null,
    organization: null,
    headers: new Headers(),
  };
}
```

### Service Mocking Strategy

```typescript
// Individual service mocks with all methods defined
const mockNotificationService = {
  createNotification: vi.fn().mockResolvedValue(undefined),
  getUserNotifications: vi.fn().mockResolvedValue([]),
  markAsRead: vi.fn().mockResolvedValue(undefined),
};

// Factory mock returns consistent instances
ctx.services.createNotificationService.mockReturnValue(mockNotificationService);
```

### Test Usage Pattern

```typescript
describe("Issue Router", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
    // Mock context already has services and db configured
  });

  it("should create issue with activity log", async () => {
    // Arrange - Configure specific mocks
    const mockActivityService = ctx.services.createIssueActivityService();
    mockActivityService.logIssueCreated.mockResolvedValue(undefined);

    // Act - Call router with mocked context
    const result = await issueRouter
      .createCaller(ctx as ProtectedTRPCContext)
      .create({ title: "Test Issue" });

    // Assert - Verify service was called
    expect(mockActivityService.logIssueCreated).toHaveBeenCalledWith(
      result.id,
      ctx.session.user.id,
    );
  });
});
```

---

## Frontend Dependency Injection

### Permission System Context

**Location**: `src/contexts/PermissionDepsContext.tsx`

```typescript
export interface PermissionDependencies {
  sessionHook: typeof useSession;
  membershipQuery: typeof api.user.getCurrentMembership.useQuery;
}

// Production dependencies
const productionDeps: PermissionDependencies = {
  sessionHook: useSession,
  membershipQuery: api.user.getCurrentMembership.useQuery,
};

// Test dependencies can be mocked
const testDeps: PermissionDependencies = {
  sessionHook: mockUseSession,
  membershipQuery: mockMembershipQuery,
};
```

### Usage in Components

```typescript
export function usePermissions() {
  const deps = useContext(PermissionDepsContext);

  const { data: session } = deps.sessionHook();
  const { data: membership } = deps.membershipQuery(undefined, {
    enabled: !!session?.user,
  });

  return useMemo(() => {
    return new PermissionChecker(session, membership);
  }, [session, membership]);
}
```

**Benefits**:

- **Testable**: Can inject mock dependencies in tests
- **Type Safe**: All dependencies explicitly typed
- **Flexible**: Easy to swap implementations per environment

---

## External Service Patterns

### Class-Based Clients

**Example**: `src/lib/opdb/client.ts`

```typescript
export class OPDBClient {
  private apiToken: string;
  private baseUrl: string;
  private cache = new Map<string, CacheEntry>();

  constructor(apiToken?: string, baseUrl?: string) {
    this.apiToken = apiToken ?? env.OPDB_API_KEY ?? "";
    this.baseUrl = baseUrl ?? env.OPDB_API_URL;
  }

  async searchGames(query: string): Promise<OPDBGame[]> {
    // Implementation with caching and error handling
  }
}
```

### Service Integration

```typescript
export class GameSyncService {
  constructor(
    private db: ExtendedPrismaClient,
    private opdbClient: OPDBClient = new OPDBClient(),
  ) {}

  async syncGameData(gameId: string): Promise<void> {
    const gameData = await this.opdbClient.getGame(gameId);
    await this.db.model.update({
      where: { id: gameId },
      data: { ...gameData },
    });
  }
}
```

---

## Best Practices

### Service Design

✅ **Do**:

- Use constructor injection for all dependencies
- Keep services focused on single domain
- Return proper TypeScript types
- Handle errors explicitly

❌ **Don't**:

- Access database directly in routers
- Mix concerns across services
- Use service locator patterns
- Skip error handling

### Testing

✅ **Do**:

- Mock at service boundary
- Use factory mocks for consistency
- Test service logic independently
- Verify dependency interactions

❌ **Don't**:

- Mock internal service implementations
- Skip integration testing
- Use `any` types in mocks
- Test private methods directly

### Database Access

✅ **Do**:

- Use singleton provider in production
- Reset provider in tests
- Apply consistent extensions
- Handle connection errors

❌ **Don't**:

- Create multiple Prisma instances
- Skip transaction management
- Ignore connection limits
- Mix query patterns

---

## Migration Patterns

### Adding New Services

1. **Create service class** with constructor injection:

   ```typescript
   export class NewService {
     constructor(private db: ExtendedPrismaClient) {}
   }
   ```

2. **Add to service factory**:

   ```typescript
   createNewService(): NewService {
     return new NewService(this.db);
   }
   ```

3. **Create test mock**:

   ```typescript
   const mockNewService = {
     method1: vi.fn(),
     method2: vi.fn(),
   };
   ```

4. **Update mock factory**:
   ```typescript
   createNewService: vi.fn().mockReturnValue(mockNewService),
   ```

### Refactoring to Services

When moving logic from routers to services:

1. **Extract** business logic to service method
2. **Inject** service via context in router
3. **Test** service independently
4. **Update** integration tests

---

## Related Documentation

- **[Multi-Config Strategy](../configuration/multi-config-strategy.md)** - Configuration and testing setup
- **[TypeScript Strictest Production](../developer-guides/typescript-strictest-production.md)** - Type safety patterns
- **[Testing Architecture Patterns](../testing/architecture-patterns.md)** - Comprehensive testing guide

**Next Review**: August 25, 2025
