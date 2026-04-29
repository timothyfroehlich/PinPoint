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
5. **Type guards**: Use predicates for narrowing (e.g., `profile is UserProfile`)

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

## Drizzle Query Safety

### Safe Query Patterns

```typescript
import { eq, desc } from "drizzle-orm";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { type Issue } from "~/lib/types/database";

// ✅ Safe Drizzle queries with explicit typing
export async function getIssuesByMachine(machineId: string): Promise<Issue[]> {
  return await db.query.issues.findMany({
    where: eq(issues.machineId, machineId),
    orderBy: desc(issues.createdAt),
  });
}
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
    role: dbUser.role, // Inferred correctly from schema enum
  };
}
```

## Supabase SSR Safety

### Safe Auth Context

```typescript
// ✅ Safe auth context in Server Component
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <DashboardContent user={user} />;
}
```

### Server Action Safety

```typescript
// ✅ Safe Server Action with auth
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";

export async function updateProfile(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const firstName = formData.get("firstName");
  if (typeof firstName !== "string") {
    throw new Error("First name must be a string");
  }

  await db
    .update(userProfiles)
    .set({ firstName })
    .where(eq(userProfiles.id, user.id));
  revalidatePath("/profile");
}
```

## Strict Function Signatures

```typescript
// ✅ Explicit return types prevent inference errors
import { type Issue } from "~/lib/types/database";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function getIssuesByMachine(machineId: string): Promise<Issue[]> {
  return await db.query.issues.findMany({
    where: eq(issues.machineId, machineId),
  });
}

// ✅ Strict parameter validation (Zod schemas)
import { publicIssueSchema } from "~/app/(app)/report/schemas";
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
const user = data as UserProfile; // Without validation (Rule #7)

// ✅ Instead: Proper validation / Type guards
if (isUserProfile(data)) {
  const user = data; // Safe narrowed type
}
```

## Server Components Safety

### Async Component Patterns

```typescript
// ✅ Safe async Server Component (Next.js 15)
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";

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
// ⚠️ Note: Use per-field extraction or helpers for boolean coercion (like watchIssue)
"use server";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { publicIssueSchema } from "~/app/(app)/report/schemas";

export async function createIssueAction(formData: FormData) {
  // Simple extraction for strings; use parsePublicIssueForm() for booleans/coercion
  const rawData = {
    machineId: String(formData.get("machineId")),
    title: String(formData.get("title")),
    // ...
  };

  // Type-safe validation
  const validation = publicIssueSchema.safeParse(rawData);
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
- Drizzle types: Use `src/lib/types/database.ts` as canonical source
