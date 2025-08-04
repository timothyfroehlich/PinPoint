# TypeScript Strictest Patterns

Essential patterns for @tsconfig/strictest compliance. Auto-loaded by Claude Code agents.

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

### Type Narrowing & Guards

```typescript
// ✅ Type guard for arrays
function hasItems<T>(arr: T[] | undefined): arr is T[] {
  return arr !== undefined && arr.length > 0;
}

// ✅ Type guard for objects
function isValidUser(user: unknown): user is { id: string; email: string } {
  return (
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    "email" in user &&
    typeof user.id === "string" &&
    typeof user.email === "string"
  );
}

// ✅ Using type guards
if (hasItems(items)) {
  items.forEach((item) => processItem(item)); // items is T[]
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

// ✅ Solution 2: Non-null assertion (use sparingly)
const user = await getUserById(id);
console.log(user!.email); // Only if you're certain user exists

// ✅ Solution 3: Optional chaining with fallback
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

// ✅ Alternative: Type assertion (use carefully)
const result = await fetchUser(id as string);
```

### "Property X does not exist on type" Errors

```typescript
// ❌ Problem: Accessing properties on union types
function processResult(result: Success | Error) {
  console.log(result.message); // Error: message might not exist
}

// ✅ Solution: Type narrowing
function processResult(result: Success | Error) {
  if ("message" in result) {
    console.log(result.message); // Safe
  }
}

// ✅ Alternative: Discriminated unions
type Result =
  | { type: "success"; data: string }
  | { type: "error"; message: string };

function processResult(result: Result) {
  switch (result.type) {
    case "success":
      console.log(result.data); // Safe
      break;
    case "error":
      console.log(result.message); // Safe
      break;
  }
}
```

## Project-Specific Patterns

### tRPC Context Safety

```typescript
// ✅ Protected procedure pattern
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

### Multi-Tenant Query Safety

```typescript
// ✅ Safe organization scoping
export async function getIssuesForOrg(organizationId: string) {
  if (!organizationId) {
    throw new Error("Organization ID required");
  }

  return await db.issue.findMany({
    where: { organizationId }, // Guaranteed to be string
  });
}

// ✅ Session-based organization scoping
const protectedOrgProcedure = protectedProcedure.use(({ ctx, next }) => {
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

### Prisma Select Clause Safety

```typescript
// ✅ Explicit select for type safety
const users = await db.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    // Explicitly exclude sensitive fields
  },
});

// ✅ Type-safe partial selections
type UserPublic = Pick<User, "id" | "email" | "name">;
const publicUsers: UserPublic[] = await db.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
});
```

## Error Prevention Strategies

### Import Path Consistency

```typescript
// ✅ Always use TypeScript alias
import { validateUser } from "~/lib/validation/user";
import { createClient } from "~/lib/supabase/client";

// ❌ Never use relative paths for deep imports
import { validateUser } from "../../../lib/validation/user";
import { createClient } from "../../../lib/supabase/client";
```

### Strict Function Signatures

```typescript
// ✅ Explicit return types prevent inference errors
export async function getUserMemberships(
  userId: string,
): Promise<Membership[]> {
  if (!userId) {
    throw new Error("User ID required");
  }
  // Implementation ensures return type matches
  return await db.membership.findMany({
    where: { userId },
  });
}

// ✅ Strict parameter validation
export function createIssue(data: {
  title: string;
  description?: string;
  machineId: string;
  organizationId: string;
}): Promise<Issue> {
  // All required fields are guaranteed by type system
  return db.issue.create({ data });
}
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

// ❌ Never: Mutating readonly arrays
const items: readonly string[] = getItems();
items.push("new"); // Error (good!)

// ✅ Instead: Create new array
const newItems = [...items, "new"];
```

## Migration-Specific Patterns

### Supabase Auth Transition

```typescript
// ✅ Safe auth context access
export async function createTRPCContext({ req }: { req: NextRequest }) {
  const supabase = createServerClient(cookies);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  // Handle both success and error cases
  if (error) {
    console.warn("Auth session error:", error.message);
    return { session: null, supabase };
  }

  return { session, supabase };
}
```

### Drizzle Query Safety

```typescript
// ✅ Safe Drizzle queries with proper typing
import { eq, and } from "drizzle-orm";
import { issues, machines } from "~/db/schema";

export async function getIssuesWithMachines(organizationId: string) {
  if (!organizationId) {
    throw new Error("Organization ID required");
  }

  return await db
    .select({
      issue: issues,
      machine: machines,
    })
    .from(issues)
    .innerJoin(machines, eq(issues.machineId, machines.id))
    .where(eq(issues.organizationId, organizationId));
}
```

---

**Key Remember**: In @tsconfig/strictest mode, TypeScript catches potential runtime errors at compile time. Embrace the errors—they're preventing bugs.

**Last Updated**: 2025-08-03  
**Status**: Active - Core patterns for strictest compliance
