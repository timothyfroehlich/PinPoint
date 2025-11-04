---
applyTo: "src/app/api/**/*.ts,src/server/api/**/*.ts"
---

# API Routes & tRPC Router Instructions

## API Route Patterns (Next.js App Router)

### Route Handler Structure

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Handle request
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

### Authentication in API Routes

- **REQUIRED**: Use `~/lib/supabase/server` for authentication
- **REQUIRED**: Call `auth.getUser()` immediately after creating client
- **FORBIDDEN**: Direct imports from `@supabase/supabase-js`

### Error Handling in API Routes

- **NEVER** expose internal error details to clients
- Use generic error messages for security
- Log detailed errors server-side only

```typescript
// ✅ Safe error handling
return NextResponse.json({ error: "Access denied" }, { status: 403 });

// ❌ Information disclosure
return NextResponse.json(
  { error: `User ${userId} not found in organization ${orgId}` },
  { status: 403 },
);
```

## tRPC Router Patterns

### Organization-Scoped Procedures (CRITICAL)

**ALWAYS use orgScopedProcedure for multi-tenant operations**:

```typescript
import { createTRPCRouter, orgScopedProcedure } from "~/server/api/trpc";

export const issueRouter = createTRPCRouter({
  // ✅ Organization-scoped procedure
  list: orgScopedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // ctx.organizationId is guaranteed to exist
      return await db.query.issues.findMany({
        where: and(
          eq(issues.organizationId, ctx.organizationId),
          input.status ? eq(issues.status, input.status) : undefined,
        ),
      });
    }),

  // ❌ FORBIDDEN: Unscoped query in multi-tenant context
  list: publicProcedure.query(async () => {
    return await db.query.issues.findMany(); // SECURITY VIOLATION
  }),
});
```

### Input Validation with Zod

- **REQUIRED**: Validate all inputs with Zod schemas
- **REQUIRED**: Export inferred types to `~/lib/types`
- Keep schemas co-located with routers

```typescript
import { z } from "zod";

const createIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  machineId: z.string().uuid(),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const issueRouter = createTRPCRouter({
  create: orgScopedProcedure
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

### Database Access Patterns

**Organization Scoping (MANDATORY)**:

```typescript
// ✅ Every query includes organizationId
.query(async ({ ctx }) => {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, ctx.organizationId),
  });
});

// ❌ SECURITY VIOLATION: Missing organization filter
.query(async ({ ctx }) => {
  return await db.query.issues.findMany(); // FORBIDDEN
});
```

**Type Boundaries**:

```typescript
// ✅ Convert snake_case to camelCase at boundary
import type { Db } from "~/lib/types";
import { DrizzleToCamelCase } from "~/lib/utils/type-conversion";

.query(async ({ ctx }) => {
  const dbResult: Db.Issue[] = await db.query.issues.findMany({
    where: eq(issues.organizationId, ctx.organizationId),
  });

  // Convert to camelCase for API
  return dbResult.map(issue => DrizzleToCamelCase(issue));
});
```

### Error Handling in tRPC

**Use TRPCError with appropriate codes**:

```typescript
import { TRPCError } from "@trpc/server";

// ✅ Structured error handling
.mutation(async ({ ctx, input }) => {
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.id, input.id),
      eq(issues.organizationId, ctx.organizationId)
    ),
  });

  if (!issue) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Access denied", // Generic message
    });
  }

  // Process mutation
});
```

**Error Code Guidelines**:

- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Authenticated but not authorized
- `NOT_FOUND` - Resource doesn't exist or no access
- `BAD_REQUEST` - Invalid input
- `INTERNAL_SERVER_ERROR` - Unexpected errors

### Performance Optimization

**Use database indexes and efficient queries**:

```typescript
// ✅ Efficient query with proper filtering
.query(async ({ ctx, input }) => {
  return await db.query.issues.findMany({
    where: and(
      eq(issues.organizationId, ctx.organizationId),
      eq(issues.status, "open")
    ),
    orderBy: [desc(issues.createdAt)],
    limit: input.limit ?? 50,
  });
});
```

**Cache expensive operations**:

```typescript
import { cache } from "react";

// ✅ Cached fetcher for use in Server Components
const getCachedIssues = cache(async (organizationId: string) => {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId),
  });
});
```

## SQL Security

### FORBIDDEN Patterns

- **SQL Injection**: Raw string interpolation in SQL

  ```typescript
  // ❌ CRITICAL SECURITY VIOLATION
  sql.raw(`SET var = '${value}'`);

  // ✅ Use parameterized queries
  sql`SET var = ${value}`;
  ```

- **Architectural SQL Misuse**: Using `sql.raw()` when `sql` templates work

  ```typescript
  // ❌ Wrong: raw() when templates work
  sql.raw(`SELECT * FROM issues WHERE org_id = '${orgId}'`);

  // ✅ Correct: Parameterized with Drizzle
  db.query.issues.findMany({
    where: eq(issues.organizationId, orgId),
  });
  ```

### Session Variable Abuse

- **FORBIDDEN**: Setting database session variables from application code
- **REQUIRED**: Use explicit filtering with organizationId in queries

## Testing API Routes and Routers

### tRPC Router Testing

```typescript
import { createMockAdminContext } from "~/test/helpers/auth-helpers";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

test("list issues for organization", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    const ctx = createMockAdminContext(SEED_TEST_IDS.ORGANIZATIONS.primary);

    const result = await issueRouter.createCaller(ctx).list({});

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
  });
});
```

### API Route Testing

Use Playwright for end-to-end API route testing to ensure proper authentication and authorization flow.

## Documentation

- Document complex business logic
- Explain non-obvious security decisions
- Add JSDoc comments for public router procedures
- Link to relevant documentation for external APIs
