# tRPC Context Patterns with Drizzle + Supabase

## Overview

The tRPC context provides shared resources to all procedures. During the migration, we're updating the context to use Supabase for authentication and Drizzle for database access.

## Context Setup

### Base Context Structure

```typescript
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "~/server/db";
import type { Session } from "@supabase/supabase-js";

interface CreateContextOptions {
  session: Session | null;
  headers: Headers;
}

export async function createTRPCContext(
  opts: FetchCreateContextFnOptions,
): Promise<CreateContextOptions> {
  // Create Supabase server client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
      },
    },
  );

  // Get session from Supabase
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    session,
    headers: opts.req.headers,
    db,
    supabase,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
```

### Organization Context

```typescript
interface OrganizationContext extends Context {
  organization: Organization;
  organizationId: string;
  membership: Membership | null;
}

export async function createOrganizationContext(
  baseContext: Context,
): Promise<OrganizationContext | null> {
  // Extract organization from JWT
  const organizationId =
    baseContext.session?.user?.app_metadata?.organizationId;

  if (!organizationId) {
    return null;
  }

  // Fetch organization (with Drizzle)
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return null;
  }

  // Fetch membership if user is authenticated
  let membership = null;
  if (baseContext.session?.user?.id) {
    [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, baseContext.session.user.id),
          eq(memberships.organizationId, organizationId),
        ),
      )
      .limit(1);
  }

  return {
    ...baseContext,
    organization,
    organizationId,
    membership,
  };
}
```

## Procedure Types

### Public Procedure

```typescript
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const publicProcedure = t.procedure;
```

### Protected Procedure

```typescript
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});
```

### Organization Procedure

```typescript
export const organizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const orgContext = await createOrganizationContext(ctx);

    if (!orgContext) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No organization access",
      });
    }

    return next({
      ctx: orgContext,
    });
  },
);
```

### Permission-Based Procedures

```typescript
export function createPermissionProcedure(permission: string) {
  return organizationProcedure.use(({ ctx, next }) => {
    const permissions = ctx.session.user.app_metadata?.permissions ?? [];

    if (!permissions.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing required permission: ${permission}`,
      });
    }

    return next({ ctx });
  });
}

// Usage
export const issueCreateProcedure = createPermissionProcedure("issue:create");
export const issueAdminProcedure = createPermissionProcedure("issue:admin");
```

## RLS Context Setup

### Setting JWT Claims for RLS

```typescript
export async function createRLSContext(
  ctx: Context,
): Promise<Context & { dbWithRLS: DrizzleClient }> {
  if (!ctx.session) {
    return { ...ctx, dbWithRLS: db };
  }

  // Create a new database connection with RLS context
  const rlsDb = db.$with({
    // Set JWT claims for RLS policies
    async prepare(client) {
      await client.query(
        `
        SET LOCAL request.jwt.claims = $1::json;
      `,
        [
          JSON.stringify({
            sub: ctx.session.user.id,
            organizationId: ctx.session.user.app_metadata?.organizationId,
            permissions: ctx.session.user.app_metadata?.permissions ?? [],
          }),
        ],
      );
    },
  });

  return {
    ...ctx,
    dbWithRLS: rlsDb,
  };
}

// RLS-aware procedure
export const rlsProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const rlsContext = await createRLSContext(ctx);
  return next({ ctx: rlsContext });
});
```

## Service Integration

### Without Service Factory (New Pattern)

```typescript
// Direct service instantiation
export const issueRouter = createTRPCRouter({
  create: issueCreateProcedure
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // Use services directly
      const notificationService = new NotificationService(ctx.db);
      const activityService = new IssueActivityService(ctx.db);

      // Create issue with Drizzle
      const [issue] = await ctx.db
        .insert(issues)
        .values({
          ...input,
          organizationId: ctx.organizationId,
          createdById: ctx.session.user.id,
        })
        .returning();

      // Record activity
      await activityService.recordIssueCreated(
        issue.id,
        ctx.organizationId,
        ctx.session.user.id,
      );

      // Send notifications
      await notificationService.notifyMachineOwnerOfIssue(
        issue.id,
        input.machineId,
      );

      return issue;
    }),
});
```

## Subdomain Resolution

```typescript
export async function resolveOrganizationFromSubdomain(
  headers: Headers,
): Promise<string | null> {
  const host = headers.get("host");
  if (!host) return null;

  // Extract subdomain
  const subdomain = host.split(".")[0];
  if (!subdomain || subdomain === "www") return null;

  // Lookup organization
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.subdomain, subdomain))
    .limit(1);

  return org?.id ?? null;
}

// Public procedure with subdomain resolution
export const publicOrgProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const organizationId = await resolveOrganizationFromSubdomain(ctx.headers);

  if (!organizationId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
  }

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return next({
    ctx: {
      ...ctx,
      organization,
      organizationId,
    },
  });
});
```

## Testing Context

```typescript
import { type Session } from "@supabase/supabase-js";

export function createMockContext(
  overrides: {
    session?: Partial<Session>;
    organizationId?: string;
    permissions?: string[];
  } = {},
): Context {
  const mockSession: Session | null = overrides.session
    ? {
        access_token: "mock-token",
        refresh_token: "mock-refresh",
        expires_at: Date.now() + 3600,
        user: {
          id: "test-user-id",
          email: "test@example.com",
          app_metadata: {
            organizationId: overrides.organizationId ?? "test-org",
            permissions: overrides.permissions ?? [],
          },
          user_metadata: {},
          ...overrides.session.user,
        },
        ...overrides.session,
      }
    : null;

  return {
    session: mockSession,
    headers: new Headers(),
    db: mockDb,
    supabase: mockSupabase,
  };
}

// Usage in tests
const caller = appRouter.createCaller(
  createMockContext({
    organizationId: "org-123",
    permissions: ["issue:create", "issue:view"],
  }),
);
```

## ⚠️ MIGRATION: Old Context Patterns

### NextAuth to Supabase

```typescript
// OLD: NextAuth session in context
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";

export async function createTRPCContext() {
  const session = await getServerSession(authOptions);
  return { session, db: prisma };
}

// NEW: Supabase session in context
import { createServerClient } from "@supabase/ssr";

export async function createTRPCContext() {
  const supabase = createServerClient(/* ... */);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { session, db, supabase };
}
```

### Prisma to Drizzle

```typescript
// OLD: Prisma in context
import { prisma } from "~/server/db";

const ctx = { db: prisma };
const users = await ctx.db.user.findMany();

// NEW: Drizzle in context
import { db } from "~/server/db";

const ctx = { db };
const users = await ctx.db.select().from(users);
```

### Service Factory Removal

```typescript
// OLD: Service factory pattern
export async function createTRPCContext() {
  const services = new ServiceFactory(prisma);
  return { session, db: prisma, services };
}

// Usage
await ctx.services.createNotificationService().notify();

// NEW: Direct instantiation
const notificationService = new NotificationService(ctx.db);
await notificationService.notify();
```

## Best Practices

1. **Keep context minimal** - Only include shared resources
2. **Use middleware** for authentication and authorization
3. **Type your context** properly for better DX
4. **Test with realistic context** including permissions
5. **Handle RLS gracefully** - Let DB enforce security
6. **Cache expensive lookups** like organization data
7. **Use transactions** when needed via context.db

## Performance Considerations

```typescript
// Cache organization lookup
const organizationCache = new Map<string, Organization>();

export async function getCachedOrganization(
  organizationId: string,
): Promise<Organization | null> {
  if (organizationCache.has(organizationId)) {
    return organizationCache.get(organizationId)!;
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (org) {
    organizationCache.set(organizationId, org);
  }

  return org;
}

// Clear cache periodically
setInterval(() => organizationCache.clear(), 5 * 60 * 1000); // 5 minutes
```
