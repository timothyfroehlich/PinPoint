---
name: pinpoint-typescript
description: TypeScript strictest patterns, type guards, optional properties (exactOptionalPropertyTypes), Drizzle query safety, null checks. Use when fixing type errors, implementing complex types, or when user mentions TypeScript/types/generics.
---

# PinPoint TypeScript Guide

## When to Use This Skill

Use this skill when:

- Fixing TypeScript compilation errors
- Implementing complex types or generics
- Dealing with optional properties and `exactOptionalPropertyTypes`
- Working with Drizzle ORM types
- Handling null/undefined safety
- User mentions: "TypeScript", "type error", "type guard", "optional", "nullable"

## Quick Reference

### Critical TypeScript Rules

1. **Strictest config**: No `any`, no `!`, no unsafe `as` (NON_NEGOTIABLE #7)
2. **Explicit return types**: Required for public functions
3. **Path aliases**: Always use `~/` (e.g., `~/lib/utils`)
4. **Optional property assignment**: Use conditional spread for `exactOptionalPropertyTypes` safety
5. **Type guards**: Use predicates for narrowing (e.g., `user is UserProfile`)

### Common Fixes

**Optional Properties (exactOptionalPropertyTypes)**:

```typescript
// ✅ Correct: Conditional spread
const data = {
  id: uuid(),
  ...(name && { name }),
  ...(description && { description }),
};

// ❌ Wrong: Direct assignment (fails if value is undefined)
const data = { name: value };
```

## Detailed Documentation

Read these files for comprehensive TypeScript patterns and rules:

- `docs/TYPESCRIPT_STRICTEST_PATTERNS.md` — Detailed generic and union patterns
- `docs/NON_NEGOTIABLES.md` — Core project constraints (CORE-TS-\* rules)
- `src/lib/types/database.ts` — Canonical database entity types

## Core Safety Patterns

### Null Safety & Optional Chaining

```typescript
// ✅ Safe authentication check (Supabase SSR)
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user?.id) {
  throw new Error("Unauthorized");
}
const userId = user.id; // Safe - narrowed to non-null

// ✅ Safe array access
const firstItem = items[0]?.name ?? "No items";
const lastItem = items.at(-1)?.name ?? "No items";

// ✅ Safe object property access (Drizzle relational)
const machineName = issue.machine?.name ?? "Unknown";
```

### Date Formatting (Narrowing Required)

Helpers in `~/lib/dates.ts` (**formatDate**, **formatDateTime**, **formatRelative**) currently throw `TypeError` on `null` or `undefined`. You MUST narrow before calling.

```typescript
// ✅ Correct: Narrowing with fallback
<span>{machine.fixedAt ? formatDate(machine.fixedAt) : "—"}</span>

// ✅ Correct: Early return/guard
if (!issue.createdAt) return null;
return <div>{formatDate(issue.createdAt)}</div>

// ❌ Wrong: Passing potentially null value
<div>{formatDate(issue.closedAt)}</div> // Throws if closedAt is null
```

### Type Guards

```typescript
// ✅ Type guard for arrays
function hasItems<T>(arr: T[] | null | undefined): arr is T[] {
  return !!arr && arr.length > 0;
}

// ✅ Type guard for UserProfile (Auth context)
import { type UserProfile } from "~/lib/types/database";

function isUserProfile(profile: unknown): profile is UserProfile {
  return (
    typeof profile === "object" &&
    profile !== null &&
    "id" in profile &&
    "email" in profile &&
    "role" in profile
  );
}

// ✅ Type guard for discriminated unions
type Result =
  | { type: "success"; data: string }
  | { type: "error"; message: string };

function processResult(result: Result) {
  if (result.type === "success") {
    console.log(result.data); // Safe - narrowing works
  } else {
    console.log(result.message); // Safe - narrowing works
  }
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

## Drizzle Query Safety

### Safe Query Patterns

```typescript
import { eq, and, desc } from "drizzle-orm";
import { issues, userProfiles } from "~/server/db/schema";
import { type Issue } from "~/lib/types/database";

// ✅ Safe Drizzle queries with explicit typing
export async function getIssuesByMachine(machineId: string): Promise<Issue[]> {
  return await db.query.issues.findMany({
    where: eq(issues.machineId, machineId),
    orderBy: desc(issues.createdAt),
  });
}

// ✅ Explicit column selection
const users = await db.query.userProfiles.findMany({
  columns: {
    id: true,
    email: true,
    name: true,
  },
});

// ✅ Type-safe joins
const issuesWithMachines = await db.query.issues.findMany({
  with: {
    machine: true, // Drizzle infers correct relational types
  },
});
```

### Database Type Inference

```typescript
// Database types (Inferred from schema)
import { userProfiles } from "~/server/db/schema";
import { type InferSelectModel } from "drizzle-orm";

type DbUser = InferSelectModel<typeof userProfiles>;
// Resulting type uses camelCase from schema.ts:
// { id: string, email: string, firstName: string, lastName: string, ... }

// Application types (Cleaned up or extended)
import { type UserRole } from "~/lib/types/user";

export type UserProfileSummary = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

// Converter at boundary
export function toProfileSummary(dbUser: DbUser): UserProfileSummary {
  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: `${dbUser.firstName} ${dbUser.lastName}`,
    role: dbUser.role as UserRole,
  };
}
```

## Supabase SSR Safety

### Safe Auth Context

```typescript
// ✅ Safe auth context in Server Component
export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Handle both success and error cases
  if (error || !user) {
    redirect("/login");
  }

  // user is guaranteed to be non-null here
  return <DashboardContent user={user} />;
}
```

### Server Action Safety

```typescript
// ✅ Safe Server Action with auth
"use server";
import { createClient } from "~/lib/supabase/server";

export async function updateProfile(formData: FormData): Promise<void> {
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

  await db
    .update(userProfiles)
    .set({ name })
    .where(eq(userProfiles.id, user.id));
  revalidatePath("/profile");
}
```

## Strict Function Signatures

```typescript
// ✅ Explicit return types prevent inference errors
import { type Issue } from "~/lib/types/database";

export async function getIssuesByMachine(machineId: string): Promise<Issue[]> {
  return await db.query.issues.findMany({
    where: eq(issues.machineId, machineId),
  });
}

// ✅ Strict parameter validation (Zod schemas)
import { createIssueSchema } from "~/app/(app)/report/schemas";
```

## Import Path Consistency

```typescript
// ✅ Always use TypeScript alias
import { createClient } from "~/lib/supabase/server";
import { userProfiles } from "~/server/db/schema";

// ❌ Never use relative paths for deep imports
import { createClient } from "../../../lib/supabase/server";
```

## Anti-Patterns to Avoid

```typescript
// ❌ Never: any types
const data: any = await fetchData();

// ❌ Never: Non-null assertion without justification
const user = getUser()!.email; // Dangerous (Rule #7)

// ❌ Never: Ignoring TypeScript errors
// @ts-ignore
const result = dangerousOperation();

// ❌ Never: Unsafe type assertions
const user = data as UserProfile; // Without validation

// ✅ Instead: Proper validation / Type guards
if (isUserProfile(data)) {
  const user = data; // Safe narrowed type
}
```

## Server Components Safety

### Async Component Patterns

```typescript
// ✅ Safe async Server Component
export default async function MachineIssuesPage({
  params
}: {
  params: Promise<{ machineId: string }>
}): Promise<JSX.Element> {
  const { machineId } = await params;

  const issuesResult = await db.query.issues.findMany({
    where: eq(issues.machineId, machineId),
    orderBy: desc(issues.createdAt),
  });

  return (
    <div>
      {issuesResult.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
```

### Form Data Validation (Zod)

```typescript
// ✅ Safe FormData handling with Zod schemas from route directory
"use server";
import { createIssueSchema } from "~/app/(app)/report/schemas";

export async function createIssueAction(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());

  // Type-safe validation
  const validation = createIssueSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.flatten() };
  }

  const [issue] = await db.insert(issues).values(validation.data).returning();
  revalidatePath("/issues");
  return issue;
}
```

## TypeScript Checklist

Before committing TypeScript code:

- [ ] No `any` types
- [ ] No non-null assertions (`!`)
- [ ] No unsafe type assertions (`as`)
- [ ] Explicit return types on public functions
- [ ] Optional properties use conditional spread
- [ ] Type guards for complex narrowing
- [ ] Path aliases (`~/`) instead of relative imports
- [ ] `pnpm run typecheck` passes

## Additional Resources

- TypeScript patterns: `docs/TYPESCRIPT_STRICTEST_PATTERNS.md`
- Non-negotiables: `docs/NON_NEGOTIABLES.md` (CORE-TS-\* rules)
- Drizzle types: Use Context7 MCP for latest patterns
