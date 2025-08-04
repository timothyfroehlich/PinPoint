# API Security Patterns Quick Reference

Essential security patterns for tRPC procedures and multi-tenant access control. Auto-loaded by Claude Code agents.

## Protected Procedure Patterns

### Basic Authentication Check

```typescript
const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session, // Now guaranteed to exist
      userId: ctx.session.user.id, // Safe access
    },
  });
});
```

### Organization-Scoped Procedures

```typescript
const orgScopedProcedure = protectedProcedure.use(({ ctx, next }) => {
  const orgId = ctx.session.user.currentOrganizationId;
  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No organization selected",
    });
  }
  return next({
    ctx: {
      ...ctx,
      organizationId: orgId, // Safe string
    },
  });
});
```

### Permission-Based Procedures

```typescript
function requirePermission(permission: string) {
  return orgScopedProcedure.use(async ({ ctx, next }) => {
    const hasPermission = await checkUserPermission(
      ctx.userId,
      ctx.organizationId,
      permission,
    );

    if (!hasPermission) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${permission}`,
      });
    }

    return next({ ctx });
  });
}

// Usage
const adminProcedure = requirePermission("admin");
const manageIssuesProcedure = requirePermission("manage_issues");
```

## Multi-Tenant Query Patterns

### Safe Organization Scoping

```typescript
// ✅ Always scope by organization
export const issueRouter = createTRPCRouter({
  list: orgScopedProcedure.query(async ({ ctx }) => {
    return await db.issue.findMany({
      where: {
        organizationId: ctx.organizationId, // Required scoping
      },
      select: {
        id: true,
        title: true,
        status: true,
        // Explicit field selection
      },
    });
  }),

  create: orgScopedProcedure
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      return await db.issue.create({
        data: {
          ...input,
          organizationId: ctx.organizationId, // Force scoping
          createdBy: ctx.userId,
        },
      });
    }),
});
```

### Resource Ownership Validation

```typescript
// Validate resource belongs to user's organization
const getIssueByIdProcedure = orgScopedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const issue = await db.issue.findFirst({
      where: {
        id: input.id,
        organizationId: ctx.organizationId, // Security boundary
      },
    });

    if (!issue) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Issue not found or access denied",
      });
    }

    return issue;
  });
```

## Input Validation Patterns

### Zod Schema Validation

```typescript
const createIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  machineId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

// Use in procedure
.input(createIssueSchema)
.mutation(async ({ ctx, input }) => {
  // input is fully validated and typed
  return await createIssue(ctx.organizationId, input);
});
```

### ID Validation

```typescript
const idSchema = z.string().uuid("Invalid ID format");
const organizationIdSchema = z.string().uuid("Invalid organization ID");

// Validate IDs in procedures
.input(z.object({
  issueId: idSchema,
  machineId: idSchema,
}))
```

## Prisma Security Patterns

### Explicit Select Clauses

```typescript
// ✅ Always use explicit select for public data
const publicUsers = await db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Exclude: hashedPassword, apiKeys, etc.
  },
});

// ✅ Type-safe partial selections
type UserPublic = Pick<User, "id" | "name" | "email">;
```

### Safe Relationship Loading

```typescript
// ✅ Explicitly scope relationships
const issuesWithMachines = await db.issue.findMany({
  where: { organizationId: ctx.organizationId },
  include: {
    machine: {
      select: {
        id: true,
        name: true,
        model: true,
        // Only safe machine fields
      },
    },
  },
});
```

### Parameterized Queries

```typescript
// ✅ Use Prisma's type-safe queries
const results = await db.issue.findMany({
  where: {
    organizationId: ctx.organizationId, // Parameterized
    status: { in: input.statuses }, // Safe array
    createdAt: { gte: input.startDate }, // Safe date
  },
});

// ❌ Never: Raw SQL without proper escaping
// const results = await db.$queryRaw`SELECT * FROM issues WHERE org_id = ${orgId}`;
```

## Error Handling Patterns

### Consistent Error Responses

```typescript
// Standard error types
const ERRORS = {
  UNAUTHORIZED: { code: "UNAUTHORIZED" as const },
  FORBIDDEN: { code: "FORBIDDEN" as const },
  NOT_FOUND: { code: "NOT_FOUND" as const },
  VALIDATION: { code: "BAD_REQUEST" as const },
} as const;

// Usage in procedures
if (!user) {
  throw new TRPCError(ERRORS.NOT_FOUND);
}
```

### Safe Error Messages

```typescript
// ✅ Generic error messages (don't leak info)
throw new TRPCError({
  code: "NOT_FOUND",
  message: "Resource not found or access denied",
});

// ❌ Specific error messages (information leakage)
throw new TRPCError({
  code: "NOT_FOUND",
  message: "Issue ID issue-123 belongs to organization org-456",
});
```

## Rate Limiting Patterns

### Basic Rate Limiting Middleware

```typescript
const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const key = `rate_limit:${ctx.userId || ctx.ip}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  if (count > 100) {
    // 100 requests per minute
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded",
    });
  }

  return next({ ctx });
});
```

## Public Endpoint Security

### Subdomain-Based Organization Resolution

```typescript
// Public endpoints still need org scoping
const publicOrgProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const subdomain = getSubdomainFromRequest(ctx.req);
  const organization = await getOrgBySubdomain(subdomain);

  if (!organization) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return next({
    ctx: {
      ...ctx,
      organization,
      organizationId: organization.id,
    },
  });
});
```

### Safe Public Data Exposure

```typescript
// Public machine list (limited fields)
publicMachines: publicOrgProcedure.query(async ({ ctx }) => {
  return await db.machine.findMany({
    where: {
      organizationId: ctx.organizationId,
      isPublic: true, // Additional visibility check
    },
    select: {
      id: true,
      name: true,
      model: true,
      location: { select: { name: true } },
      // Exclude: maintenance notes, issues, etc.
    },
  });
}),
```

## Migration Security Patterns

### Supabase RLS Preview

```typescript
// When RLS is enabled, queries automatically scope by user context
// Preview pattern (for Stage 3):
const rls_issues = await supabase
  .from("issues")
  .select("*")
  .eq("organization_id", organizationId); // Still explicit for clarity
```

### Backward Compatibility

```typescript
// Dual auth support during migration
const getCurrentUser = async (ctx: Context) => {
  if (process.env.USE_SUPABASE_AUTH === "true") {
    return await getSupabaseUser(ctx);
  }
  return await getNextAuthUser(ctx);
};
```

## Testing Security Patterns

### Permission Testing

```typescript
describe("Issue API", () => {
  it("denies access to other organization's issues", async () => {
    const caller = createCaller({
      session: { user: { id: "user-1", currentOrganizationId: "org-1" } },
    });

    await expect(
      caller.issues.getById({ id: "issue-from-org-2" }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
```

## Anti-Patterns to Avoid

```typescript
// ❌ Missing organization scoping
const issues = await db.issue.findMany(); // Leaks all orgs

// ❌ Client-side permission checks only
if (user.role === "admin") {
  /* sensitive operation */
}

// ❌ SQL injection via template literals
await db.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;

// ❌ Exposing internal IDs or structure
return { internalDatabaseId: 12345, debugInfo: error.stack };

// ❌ Inconsistent error handling
throw new Error("User not found"); // Should use TRPCError
```

---

**Complete Reference**: See `@docs/security/INDEX.md` for comprehensive security patterns  
**RLS Guide**: See `@docs/developer-guides/row-level-security/` for database-level security

**Last Updated**: 2025-08-03  
**Status**: Active - Core patterns for tRPC + multi-tenant security
