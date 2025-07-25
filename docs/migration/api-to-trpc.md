# API to tRPC Migration Guide

**Last Updated**: 2025-07-22  
**Status**: Current  
**Purpose**: Guide for migrating traditional API routes to tRPC procedures

## Overview

This guide helps developers convert traditional Next.js API routes to tRPC procedures, following PinPoint's tRPC-first architecture. It includes patterns, examples, and security considerations.

## Why Migrate to tRPC?

1. **Type Safety**: End-to-end TypeScript types from backend to frontend
2. **Better DX**: Auto-completion, refactoring support, and compile-time errors
3. **Security**: Built-in CSRF protection and automatic input validation
4. **Consistency**: Single pattern for all application endpoints
5. **Performance**: Automatic request batching and caching

## Migration Checklist

Before migrating an API route, verify it's a good candidate:

- [ ] Not required by external services (webhooks, OAuth callbacks)
- [ ] Not serving binary data or files
- [ ] Not requiring specific HTTP semantics (redirects, custom headers)
- [ ] Called by your own frontend, not third-party tools
- [ ] Can work with JSON request/response format

If all checked, proceed with migration!

## Basic Migration Pattern

### 1. Simple GET Endpoint

**Before (API Route)**:
```typescript
// src/app/api/users/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await db.user.findUnique({
    where: { id: params.id }
  });
  
  if (!user) {
    return new Response("Not found", { status: 404 });
  }
  
  return Response.json(user);
}
```

**After (tRPC Procedure)**:
```typescript
// src/server/api/routers/user.ts
export const userRouter = createTRPCRouter({
  byId: publicProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id }
      });
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found"
        });
      }
      
      return user;
    }),
});
```

**Frontend Usage Change**:
```typescript
// Before
const response = await fetch(`/api/users/${userId}`);
const user = await response.json();

// After
const user = await trpc.user.byId.useQuery({ id: userId });
```

### 2. Protected POST Endpoint

**Before (API Route)**:
```typescript
// src/app/api/issues/route.ts
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  const body = await request.json();
  // Manual validation...
  
  const issue = await db.issue.create({
    data: {
      title: body.title,
      description: body.description,
      userId: session.user.id
    }
  });
  
  return Response.json(issue);
}
```

**After (tRPC Procedure)**:
```typescript
// src/server/api/routers/issue.ts
export const issueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // ctx.session guaranteed by protectedProcedure
      return ctx.db.issue.create({
        data: {
          ...input,
          userId: ctx.session.user.id
        }
      });
    }),
});
```

### 3. Multi-Tenant Endpoint

**Before (API Route)**:
```typescript
// src/app/api/organizations/[orgId]/machines/route.ts
export async function GET(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Check membership
  const membership = await db.membership.findFirst({
    where: {
      userId: session.user.id,
      organizationId: params.orgId
    }
  });
  
  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }
  
  // Check permission
  const hasPermission = await checkPermission(
    membership.roleId,
    "machine:view"
  );
  
  if (!hasPermission) {
    return new Response("Forbidden", { status: 403 });
  }
  
  const machines = await db.machine.findMany({
    where: { organizationId: params.orgId }
  });
  
  return Response.json(machines);
}
```

**After (tRPC Procedure)**:
```typescript
// src/server/api/routers/machine.ts
export const machineRouter = createTRPCRouter({
  list: organizationProcedure
    .requiresPermission("machine:view")
    .query(async ({ ctx }) => {
      // All auth/permission checks handled by middleware
      // Prisma extension ensures organizationId filtering
      return ctx.db.machine.findMany();
    }),
});
```

## Advanced Patterns

### 1. File Uploads

**Before**: Direct file upload to API route  
**After**: Use presigned URLs

```typescript
// tRPC procedure for getting upload URL
export const uploadRouter = createTRPCRouter({
  createPresignedUrl: organizationProcedure
    .requiresPermission("file:upload")
    .input(z.object({
      filename: z.string(),
      contentType: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const url = await createPresignedUploadUrl({
        filename: input.filename,
        contentType: input.contentType,
        organizationId: ctx.organization.id
      });
      
      return { uploadUrl: url };
    }),
});

// Frontend uploads directly to storage
const { uploadUrl } = await trpc.upload.createPresignedUrl.mutate({
  filename: file.name,
  contentType: file.type
});

await fetch(uploadUrl, {
  method: "PUT",
  body: file
});
```

### 2. Pagination

```typescript
export const issueRouter = createTRPCRouter({
  list: organizationProcedure
    .requiresPermission("issue:view")
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(), // For cursor pagination
      // OR
      page: z.number().min(1).default(1), // For offset pagination
    }))
    .query(async ({ ctx, input }) => {
      const issues = await ctx.db.issue.findMany({
        take: input.limit + 1, // Fetch one extra
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" }
      });
      
      let nextCursor: string | undefined = undefined;
      if (issues.length > input.limit) {
        const nextItem = issues.pop();
        nextCursor = nextItem!.id;
      }
      
      return {
        issues,
        nextCursor
      };
    }),
});
```

### 3. Real-time Updates

```typescript
// Use tRPC subscriptions (WebSocket)
export const issueRouter = createTRPCRouter({
  onUpdate: organizationProcedure
    .requiresPermission("issue:view")
    .input(z.object({
      issueId: z.string()
    }))
    .subscription(({ ctx, input }) => {
      return observable<Issue>((emit) => {
        const unsubscribe = subscribeToIssueUpdates(
          input.issueId,
          (issue) => emit.next(issue)
        );
        
        return () => {
          unsubscribe();
        };
      });
    }),
});
```

### 4. Batch Operations

```typescript
export const issueRouter = createTRPCRouter({
  deleteMany: organizationProcedure
    .requiresPermission("issue:delete")
    .input(z.object({
      ids: z.array(z.string()).min(1).max(100)
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify all issues belong to organization
      const issues = await ctx.db.issue.findMany({
        where: { id: { in: input.ids } }
      });
      
      if (issues.length !== input.ids.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some issues not found"
        });
      }
      
      // Batch delete
      await ctx.db.issue.deleteMany({
        where: { id: { in: input.ids } }
      });
      
      return { deleted: input.ids.length };
    }),
});
```

## Security Migration

### Authentication
```typescript
// Before: Manual session checks
const session = await getServerSession();
if (!session) return new Response("Unauthorized", { status: 401 });

// After: Automatic via procedure type
protectedProcedure // Ensures ctx.session exists
```

### Authorization
```typescript
// Before: Manual permission checks
const hasPermission = await checkUserPermission(userId, "issue:create");
if (!hasPermission) return new Response("Forbidden", { status: 403 });

// After: Declarative permissions
.requiresPermission("issue:create") // Automatic check
```

### Input Validation
```typescript
// Before: Manual validation
if (!body.title || body.title.length > 200) {
  return new Response("Invalid input", { status: 400 });
}

// After: Zod schemas
.input(z.object({
  title: z.string().min(1).max(200)
}))
```

## Frontend Migration

### 1. Replace fetch with tRPC hooks

```typescript
// Before
function IssueList() {
  const [issues, setIssues] = useState([]);
  
  useEffect(() => {
    fetch("/api/issues")
      .then(res => res.json())
      .then(setIssues);
  }, []);
  
  return <div>{/* render issues */}</div>;
}

// After
function IssueList() {
  const { data: issues } = trpc.issue.list.useQuery();
  
  return <div>{/* render issues */}</div>;
}
```

### 2. Replace form submissions

```typescript
// Before
async function handleSubmit(e) {
  e.preventDefault();
  const response = await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData)
  });
  
  if (!response.ok) {
    // Handle error
  }
}

// After
function CreateIssue() {
  const createIssue = trpc.issue.create.useMutation({
    onSuccess: () => {
      // Handle success
    },
    onError: (error) => {
      // Type-safe error handling
    }
  });
  
  const handleSubmit = (data) => {
    createIssue.mutate(data);
  };
}
```

## Testing Migration

### 1. Unit Tests

```typescript
// Before: Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ id: "123" })
  })
);

// After: Mock tRPC
const mockRouter = {
  issue: {
    create: jest.fn().mockResolvedValue({ id: "123" })
  }
};
```

### 2. Integration Tests

```typescript
// Use tRPC test client
const caller = appRouter.createCaller({
  session: mockSession,
  db: mockDb
});

const result = await caller.issue.create({
  title: "Test Issue"
});
```

## Common Pitfalls

### 1. Forgetting Organization Context
```typescript
// ❌ Wrong - Missing organization filter
.query(async ({ ctx }) => {
  return ctx.db.issue.findMany(); // Returns ALL issues!
});

// ✅ Correct - Use organizationProcedure
organizationProcedure
  .query(async ({ ctx }) => {
    return ctx.db.issue.findMany(); // Filtered by org
  });
```

### 2. Over-fetching Data
```typescript
// ❌ Wrong - Fetching everything
.query(async ({ ctx }) => {
  return ctx.db.user.findMany({
    include: {
      posts: true,
      comments: true,
      organizations: true
    }
  });
});

// ✅ Correct - Select only needed fields
.query(async ({ ctx }) => {
  return ctx.db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true
    }
  });
});
```

### 3. Missing Error Handling
```typescript
// ❌ Wrong - Generic errors
.mutation(async ({ ctx, input }) => {
  const result = await ctx.db.issue.create({ data: input });
  return result; // What if it fails?
});

// ✅ Correct - Proper error handling
.mutation(async ({ ctx, input }) => {
  try {
    return await ctx.db.issue.create({ data: input });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Issue already exists"
      });
    }
    throw error;
  }
});
```

## Migration Tools

### 1. Find API Routes to Migrate
```bash
# Find all API routes
find src/app/api -name "route.ts" -o -name "route.js"

# Find fetch calls in frontend
rg "fetch\(['\"]\/api\/" --type tsx --type ts
```

### 2. Generate tRPC Router Scaffold
```typescript
// Template for new router
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  organizationProcedure,
} from "~/server/api/trpc";

export const newRouter = createTRPCRouter({
  // Add procedures here
});

// Add to root router
export const appRouter = createTRPCRouter({
  // ... existing routers
  new: newRouter,
});
```

## References

- [tRPC Documentation](https://trpc.io/docs)
- [PinPoint API Routes](../architecture/api-routes.md)
- [Security Guidelines](../security/api-security.md)
- [tRPC Best Practices](https://trpc.io/docs/server/error-handling)