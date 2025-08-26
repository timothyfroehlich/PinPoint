# Current tRPC Patterns (Post-RLS)

Current tRPC procedure patterns used in PinPoint. **Phase 0-2 Complete**: API routes removed, RLS implemented.

**🔑 Key Change**: Simplified procedures - no more manual `organizationId` filtering or complex middleware.

## 🔧 Basic Procedure Patterns

### Simple Query

```typescript
// CURRENT PATTERN - Basic data fetching
export const userRouter = createTRPCRouter({
  byId: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.id),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return user;
    }),
});
```

### Protected Mutation

```typescript
// CURRENT PATTERN - Protected data modification
export const issueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [issue] = await ctx.db
        .insert(issues)
        .values({
          ...input,
          userId: ctx.session.user.id,
          organizationId: ctx.user.organizationId,
        })
        .returning();

      return issue;
    }),
});
```

## 🔐 Multi-Tenant Security Pattern

### Simplified Procedures (Post-RLS)

```typescript
// ✅ CURRENT PATTERN (Post-RLS) - RLS handles organizational scoping
export const machineRouter = createTRPCRouter({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      // RLS automatically scopes to user's organization via Supabase auth context
      // No manual organizationId filtering needed!
      return ctx.db.query.machines.findMany({
        orderBy: [asc(machines.name)], // Only business logic needed
      });
    }),
    
  byLocation: protectedProcedure
    .input(z.object({ locationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.machines.findMany({
        where: eq(machines.locationId, input.locationId),
        // ✅ Both machines and location automatically scoped to user's org by RLS
        with: {
          location: true,
          model: true,
        }
      });
    }),
});
```

### Resource Access Validation  

```typescript
// ✅ CURRENT PATTERN (Post-RLS) - Trust database-level security
export const issueRouter = createTRPCRouter({
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.db.query.issues.findFirst({
        // ✅ Only business logic filtering - RLS ensures organizational isolation
        where: eq(issues.id, input.id),
        with: {
          machine: {
            with: { location: true }
          },
          comments: {
            with: { author: true }
          }
        }
      });

      if (!issue) {
        // If RLS policies block access, issue will be null (not found)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found or access denied",
        });
      }

      return issue;
    }),
});
```

## 🚀 Advanced Patterns

### File Upload (Presigned URLs)

```typescript
// CURRENT PATTERN - Secure file uploads
export const uploadRouter = createTRPCRouter({
  createPresignedUrl: organizationProcedure
    .requiresPermission("file:upload")
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const url = await createPresignedUploadUrl({
        filename: input.filename,
        contentType: input.contentType,
        organizationId: ctx.organizationId,
      });

      return { uploadUrl: url };
    }),
});

// Frontend usage
const { uploadUrl } = await trpc.upload.createPresignedUrl.mutate({
  filename: file.name,
  contentType: file.type,
});

await fetch(uploadUrl, {
  method: "PUT",
  body: file,
});
```

### Cursor Pagination

```typescript
// CURRENT PATTERN - Efficient pagination
export const issueRouter = createTRPCRouter({
  list: organizationProcedure
    .requiresPermission("issue:view")
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const issues = await ctx.db.query.issues.findMany({
        where: eq(issues.organizationId, ctx.organizationId),
        limit: input.limit + 1, // Fetch one extra
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: [desc(issues.createdAt)],
      });

      let nextCursor: string | undefined = undefined;
      if (issues.length > input.limit) {
        const nextItem = issues.pop();
        nextCursor = nextItem!.id;
      }

      return {
        issues,
        nextCursor,
      };
    }),
});
```

### Batch Operations

```typescript
// CURRENT PATTERN - Bulk operations with security
export const issueRouter = createTRPCRouter({
  deleteMany: organizationProcedure
    .requiresPermission("issue:delete")
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify all issues belong to organization
      const issues = await ctx.db.query.issues.findMany({
        where: and(
          inArray(issues.id, input.ids),
          eq(issues.organizationId, ctx.organizationId),
        ),
      });

      if (issues.length !== input.ids.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some issues not found or access denied",
        });
      }

      // Batch delete
      await ctx.db
        .delete(issues)
        .where(
          and(
            inArray(issues.id, input.ids),
            eq(issues.organizationId, ctx.organizationId),
          ),
        );

      return { deleted: input.ids.length };
    }),
});
```

### Real-time Subscriptions

```typescript
// CURRENT PATTERN - WebSocket subscriptions
export const issueRouter = createTRPCRouter({
  onUpdate: organizationProcedure
    .requiresPermission("issue:view")
    .input(
      z.object({
        issueId: z.string(),
      }),
    )
    .subscription(({ ctx, input }) => {
      return observable<Issue>((emit) => {
        const unsubscribe = subscribeToIssueUpdates(
          input.issueId,
          ctx.organizationId,
          (issue) => emit.next(issue),
        );

        return () => {
          unsubscribe();
        };
      });
    }),
});
```

## 🧪 Testing Patterns

### tRPC Caller Testing

```typescript
// CURRENT PATTERN - Integration testing with tRPC
import { createTRPCCaller } from "~/test/helpers/trpc-caller";

test("creates issue with organization scoping", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    const caller = createTRPCCaller(db, {
      user: {
        id: "test-user",
        user_metadata: { organizationId: "test-org", role: "admin" },
      },
    });

    const result = await caller.issues.create({
      title: "Test Issue",
      description: "Test Description",
    });

    expect(result.organizationId).toBe("test-org");
  });
});
```

### Mock Setup

```typescript
// CURRENT PATTERN - Mock tRPC for unit tests
const mockRouter = {
  issues: {
    create: vi.fn().mockResolvedValue({ id: "123", title: "Test" }),
    list: vi.fn().mockResolvedValue([]),
  },
};

vi.mock("~/trpc/react", () => ({
  api: mockRouter,
}));
```

## 📋 Common Patterns Checklist

**Every Procedure Should:**

- [ ] Use proper procedure type (public/protected/organization)
- [ ] Include input validation with Zod schemas
- [ ] Handle errors with appropriate TRPCError codes
- [ ] Scope queries by organization where applicable
- [ ] Use Drizzle query patterns

**Security Checks:**

- [ ] Protected procedures verify authentication
- [ ] Organization procedures verify membership
- [ ] Resource access verifies ownership
- [ ] Permissions checked before operations

**Error Handling:**

- [ ] Use specific TRPCError codes
- [ ] Provide helpful error messages
- [ ] Don't leak sensitive information
- [ ] Handle edge cases gracefully

## ⚠️ Critical Anti-Patterns

**❌ NEVER:**

- Return data across organizational boundaries
- Skip input validation
- Use generic error messages for security issues
- Expose internal database errors
- Forget to check permissions

**✅ ALWAYS:**

- Scope data by organization
- Validate all inputs with Zod
- Use proper error codes
- Check permissions before operations
- Test multi-tenant isolation

## 🔗 Frontend Usage Patterns

### Query Usage

```typescript
// CURRENT PATTERN - React Query integration
function IssueList() {
  const { data: issues, isLoading } = api.issues.list.useQuery({
    limit: 20
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {issues?.issues.map(issue => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
```

### Mutation Usage

```typescript
// CURRENT PATTERN - Optimistic updates
function CreateIssueForm() {
  const utils = api.useUtils();

  const createIssue = api.issues.create.useMutation({
    onSuccess: () => {
      utils.issues.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (data: FormData) => {
    createIssue.mutate({
      title: data.get("title") as string,
      description: data.get("description") as string
    });
  };

  return (
    <form action={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

**Key Insight**: These patterns provide type-safe, secure, and efficient API operations with automatic organizational scoping and proper error handling.
