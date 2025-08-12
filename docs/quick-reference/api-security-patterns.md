# API Security Patterns Quick Reference

_Essential security patterns for tRPC, Server Actions, and multi-tenant access control_

## Protected Procedure Patterns

### tRPC Procedure Patterns

**Protected procedures**: Session auth with Supabase → @docs/developer-guides/trpc/procedures.md#protected  
**Org scoping**: Multi-tenant boundary enforcement → @docs/developer-guides/row-level-security/multi-tenant.md#trpc  
**Permission checks**: Role-based access control → @docs/security/rbac-patterns.md

## Drizzle Query Security Patterns

### Organization Scoping

```typescript
// ✅ Always scope by organization
export const issueRouter = createTRPCRouter({
  list: orgScopedProcedure.query(async ({ ctx }) => {
    return await db.query.issues.findMany({
      where: eq(issues.organizationId, ctx.organizationId),
      columns: { id: true, title: true, status: true },
    });
  }),

  create: orgScopedProcedure
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      return await db.insert(issues).values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
      });
    }),
});
```

### Resource Ownership Validation

```typescript
const getByIdProcedure = orgScopedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, input.id),
        eq(issues.organizationId, ctx.organizationId),
      ),
    });

    if (!issue) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Access denied" });
    }
    return issue;
  });
```

### Relational Security

```typescript
// ✅ Secure joins with explicit scoping
const issuesWithMachines = await db.query.issues.findMany({
  where: eq(issues.organizationId, ctx.organizationId),
  with: {
    machine: {
      columns: { id: true, name: true, model: true },
    },
  },
});
```

## Server Actions Security

### Authentication Wrapper

```typescript
export async function withAuth<T extends any[], R>(
  action: (userId: string, ...args: T) => Promise<R>,
) {
  return async (...args: T): Promise<R> => {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) redirect("/login");
    return action(user.id, ...args);
  };
}

// Usage
export const updateProfile = withAuth(
  async (userId: string, formData: FormData) => {
    const name = formData.get("name") as string;
    await db.update(users).set({ name }).where(eq(users.id, userId));
    revalidatePath("/profile");
  },
);
```

### Organization Context

```typescript
export const withOrgContext = (action: Function) =>
  withAuth(async (userId: string, ...args: any[]) => {
    const orgId = await getUserOrganizationId(userId);
    if (!orgId) throw new Error("No organization selected");
    return action(userId, orgId, ...args);
  });
```

## Input Validation & Error Handling

### Validation Schemas

```typescript
const createIssueSchema = z.object({
  title: z.string().min(1).max(200),
  machineId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

// Server Action validation
export async function createIssue(formData: FormData) {
  const fields = createIssueSchema.safeParse({
    title: formData.get("title"),
    machineId: formData.get("machineId"),
  });
  if (!fields.success) return { error: "Invalid input" };
  // Proceed...
}
```

### Safe Error Messages

```typescript
const SECURITY_ERRORS = {
  UNAUTHORIZED: { code: "UNAUTHORIZED" as const },
  FORBIDDEN: { code: "FORBIDDEN" as const },
  NOT_FOUND: {
    code: "NOT_FOUND" as const,
    message: "Resource not found or access denied",
  },
} as const;

// ✅ Generic messages (don't leak info)
throw new TRPCError(SECURITY_ERRORS.NOT_FOUND);
```

## Security Testing

```typescript
it("denies cross-org access", async () => {
  const mockSession = {
    user: { id: "user-1", user_metadata: { organizationId: "org-1" } },
  };
  const caller = createCaller({ session: mockSession });
  await expect(
    caller.issues.getById({ id: "issue-from-org-2" }),
  ).rejects.toThrow("NOT_FOUND");
});
```

## Common Anti-Patterns

```typescript
// ❌ Missing organization scoping
const issues = await db.query.issues.findMany(); // Leaks all orgs

// ❌ Client-side security only
if (user.role === "admin") {
  /* unsafe */
}

// ❌ Exposing sensitive data
return { internalId: 12345, debugInfo: error.stack };

// ❌ Generic error handling
throw new Error("Failed"); // Should use TRPCError
```

**Cross-References:**

- Latest patterns: @docs/latest-updates/quick-reference.md
- Testing security: @docs/quick-reference/testing-patterns.md
