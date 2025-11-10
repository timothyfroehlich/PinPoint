# TypeScript Strictest Patterns

**Last Updated**: Unknown  
**Last Reviewed**: Unknown  

_Essential patterns for @tsconfig/strictest compliance and direct conversion approach_

## Core Safety Patterns

### Null Safety & Optional Chaining

```typescript
// ✅ Safe authentication check
if (!ctx.session?.user?.id) {
  throw new TRPCError({ code: "UNAUTHORIZED" });
}
const userId = ctx.session.user.id; // Now safe

// ✅ Safe array access
const firstItem = items[0]?.name ?? "No items";
const lastItem = items.at(-1)?.name ?? "No items";

// ✅ Safe object property access
const orgName = user.memberships?.[0]?.organization?.name ?? "Unknown";
```

### Optional Property Assignment (exactOptionalPropertyTypes)

```typescript
// ✅ Correct: Conditional assignment
const data: { name?: string } = {};
if (value) data.name = value;

// ✅ Correct: Object spread with conditional
const data = {
  id: uuid(),
  ...(name && { name }),
  ...(description && { description }),
};

// ❌ Wrong: Direct assignment of potentially undefined
const data: { name?: string } = { name: value }; // Error if value is undefined
```

### Type Guards

```typescript
// ✅ Type guard for arrays
function hasItems<T>(arr: T[] | undefined): arr is T[] {
  return arr !== undefined && arr.length > 0;
}

// ✅ Type guard for Supabase user
function isValidUser(user: unknown): user is { id: string; email: string } {
  return (
    typeof user === "object" && user !== null && "id" in user && "email" in user
  );
}
```

## Common Error Fixes

### "Object is possibly null" Errors

```typescript
// ❌ Problem
const user = await getUserById(id);
console.log(user.email); // Error: Object is possibly null

// ✅ Solution 1: Null check
const user = await getUserById(id);
if (!user) throw new Error("User not found");
console.log(user.email); // Safe

// ✅ Solution 2: Optional chaining with fallback
const user = await getUserById(id);
console.log(user?.email ?? "No email"); // Safe with fallback
```

### "Argument of type X is not assignable to parameter" Errors

```typescript
// ❌ Problem: Mixing string and number
const id: string | number = getId();
const result = await fetchUser(id); // Error: expects string

// ✅ Solution: Type narrowing
const id: string | number = getId();
const userId = typeof id === "string" ? id : String(id);
const result = await fetchUser(userId);
```

### Union Type Errors

```typescript
// ✅ Discriminated unions
type Result =
  | { type: "success"; data: string }
  | { type: "error"; message: string };

function processResult(result: Result) {
  if (result.type === "success") {
    console.log(result.data); // Safe
  } else {
    console.log(result.message); // Safe
  }
}
```

## tRPC Context Safety

### Protected Procedure Pattern

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

### Organization Scoping

```typescript
const protectedOrgProcedure = protectedProcedure.use(({ ctx, next }) => {
  const orgId = ctx.session.user.user_metadata?.organizationId;
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

## Drizzle Query Safety

### Safe Query Patterns

```typescript
import { eq, and } from "drizzle-orm";
import { issues, machines } from "~/db/schema";

// ✅ Safe Drizzle queries with proper typing
export async function getIssuesWithMachines(organizationId: string) {
  if (!organizationId) {
    throw new Error("Organization ID required");
  }

  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId),
    with: {
      machine: {
        columns: { id: true, name: true, model: true },
      },
    },
  });
}

// ✅ Explicit column selection
const users = await db.query.users.findMany({
  columns: {
    id: true,
    email: true,
    name: true,
    // Explicitly exclude sensitive fields
  },
});
```

## Supabase SSR Safety

### Safe Auth Context

```typescript
// ✅ Safe auth context access
export async function createTRPCContext({ req }: { req: NextRequest }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Handle both success and error cases
  if (error) {
    console.warn("Auth error:", error.message);
    return { user: null, supabase };
  }

  return { user, supabase };
}
```

### Server Action Safety

```typescript
// ✅ Safe Server Action with auth
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name");
  if (typeof name !== "string") {
    throw new Error("Name must be a string");
  }

  await db.update(users).set({ name }).where(eq(users.id, user.id));
  revalidatePath("/profile");
}
```

## Error Prevention Strategies

### Strict Function Signatures

```typescript
// ✅ Explicit return types prevent inference errors
export async function getUserMemberships(
  userId: string,
): Promise<Membership[]> {
  if (!userId) {
    throw new Error("User ID required");
  }

  return await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
  });
}

// ✅ Strict parameter validation
export function createIssue(data: {
  title: string;
  description?: string;
  machineId: string;
  organizationId: string;
}): Promise<Issue> {
  return db.insert(issues).values(data).returning();
}
```

### Import Path Consistency

```typescript
// ✅ Always use TypeScript alias
import { validateUser } from "~/lib/validation/user";
import { createClient } from "~/utils/supabase/server";

// ❌ Never use relative paths for deep imports
import { validateUser } from "../../../lib/validation/user";
```

## Anti-Patterns to Avoid

```typescript
// ❌ Never: any types
const data: any = await fetchData();

// ❌ Never: Non-null assertion without justification
const user = getUser()!.email; // Dangerous

// ❌ Never: Ignoring TypeScript errors
// @ts-ignore
const result = dangerousOperation();

// ❌ Never: Unsafe type assertions
const user = data as User; // Without validation

// ✅ Instead: Proper validation
function isUser(data: unknown): data is User {
  return typeof data === "object" && data !== null && "id" in data;
}
if (isUser(data)) {
  const user = data; // Safe
}
```

## Server Components Safety

### Async Component Patterns

```typescript
// ✅ Safe async Server Component
export default async function IssuesPage({ params }: { params: { orgId: string } }) {
  if (!params.orgId) {
    throw new Error('Organization ID required');
  }

  const issues = await db.query.issues.findMany({
    where: eq(issues.organizationId, params.orgId),
  });

  return (
    <div>
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
```

---

**Key Remember**: In @tsconfig/strictest mode, TypeScript catches potential runtime errors at compile time. Embrace the errors—they're preventing bugs.

**Cross-References:**

- Latest patterns: @docs/latest-updates/quick-reference.md
- API security: @docs/quick-reference/api-security-patterns.md
