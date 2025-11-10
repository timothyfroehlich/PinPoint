# PinPoint Code Patterns

**Last Updated**: November 10, 2025
**Version**: 2.0 (Greenfield)

**For AI Agents**: This is a living document. When you implement a pattern more than once, add it here so future agents can follow the same approach. Keep examples concise and focused on PinPoint-specific conventions.

---

## Data Fetching

### Server Component + Direct Drizzle Query

```typescript
// src/app/machines/[machineId]/issues/page.tsx
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function MachineIssuesPage({
  params,
}: {
  params: { machineId: string };
}) {
  // Direct query in Server Component - no DAL/repository layer
  const machineIssues = await db.query.issues.findMany({
    where: eq(issues.machineId, params.machineId),
    orderBy: desc(issues.createdAt),
    with: {
      assignedTo: {
        columns: { id: true, name: true, email: true },
      },
    },
  });

  return <IssueList issues={machineIssues} />;
}
```

**Key points**:
- Query directly in Server Component, no intermediate layers
- Use `with` for relations instead of separate queries
- Select specific columns for related data to avoid over-fetching

---

## Mutations

### Server Action + Zod Validation

```typescript
// src/app/issues/actions.ts
"use server";

import { z } from "zod";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const createIssueSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  machineId: z.string().uuid("Invalid machine ID"),
  severity: z.enum(["minor", "playable", "unplayable"]),
});

export async function createIssueAction(formData: FormData) {
  // Validate input
  const rawData = {
    title: formData.get("title"),
    description: formData.get("description"),
    machineId: formData.get("machineId"),
    severity: formData.get("severity"),
  };

  const validData = createIssueSchema.parse(rawData);

  // Insert and return
  const [issue] = await db.insert(issues).values(validData).returning();

  // Revalidate and redirect
  revalidatePath("/issues");
  redirect(`/issues/${issue.id}`);
}
```

**Key points**:
- Always use Zod for validation (CORE-SEC-002)
- Mark functions with `"use server"`
- Call `revalidatePath()` after mutations
- Use `redirect()` for navigation after success

---

## Authentication

### Auth Check in Server Components

```typescript
// src/app/dashboard/page.tsx
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Now user is guaranteed to exist
  return <DashboardContent user={user} />;
}
```

### Auth Check in Server Actions

```typescript
"use server";

import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Mutation logic here...
}
```

**Key points**:
- Always call `auth.getUser()` immediately after creating client (CORE-SSR-002)
- Use `redirect()` for unauthenticated users
- Never skip auth checks in protected routes (CORE-SEC-001)

---

## File Organization

### Project Structure Conventions

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group for auth pages
│   │   ├── login/
│   │   └── signup/
│   ├── machines/                 # Feature-based routing
│   │   ├── [machineId]/
│   │   │   ├── page.tsx         # Server Component
│   │   │   └── actions.ts       # Server Actions for this route
│   │   └── page.tsx
│   └── layout.tsx
├── components/                    # Shared UI components
│   ├── ui/                       # shadcn/ui components
│   ├── issue-card.tsx            # Domain components (Server Component)
│   └── issue-form.tsx            # Client Component ("use client")
├── lib/                          # Shared utilities
│   ├── supabase/
│   │   └── server.ts
│   ├── types/                    # Shared TypeScript types
│   └── utils.ts
└── server/                       # Server-only code
    └── db/
        ├── schema.ts             # Drizzle schema
        └── index.ts              # DB instance
```

**Conventions**:
- Server Actions co-located with routes in `actions.ts` files
- Domain components in `src/components/` (default to Server Components)
- Client Components have `"use client"` at top, or `-client.tsx` suffix
- Database schema in `src/server/db/schema.ts`
- Types in `src/lib/types/`

---

## Domain Rules

### Issues Always Require Machine

**Schema Enforcement** (already in place):
```typescript
// src/server/db/schema.ts
export const issues = pgTable("issues", {
  // ...
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  // ...
}, (table) => ({
  // CHECK constraint ensures machineId is never null
  machineRequired: check("machine_required", sql`${table.machineId} IS NOT NULL`),
}));
```

**Application Pattern**:
```typescript
// Issue forms MUST include machineId
const createIssueSchema = z.object({
  title: z.string().min(1),
  machineId: z.string().uuid(), // Always required
  severity: z.enum(["minor", "playable", "unplayable"]),
});
```

**Key points**:
- Every issue must have exactly one machine (CORE-ARCH-004)
- Schema enforces with CHECK constraint
- Never create issue forms without machine selector

---

## Type Boundaries

### Database to Application Type Conversion

```typescript
// Database types (snake_case) stay in schema
// src/server/db/schema.ts
export const issues = pgTable("issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  machine_id: uuid("machine_id").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// Application types (camelCase) in lib/types
// src/lib/types/issue.ts
export type Issue = {
  id: string;
  machineId: string;
  createdAt: Date;
};

// Convert at query boundaries
const dbIssues = await db.query.issues.findMany();
const appIssues: Issue[] = dbIssues.map(issue => ({
  id: issue.id,
  machineId: issue.machine_id,
  createdAt: issue.created_at,
}));
```

**Key points**:
- DB schema uses snake_case (CORE-TS-004)
- Application code uses camelCase (CORE-TS-003)
- Convert at boundaries, not throughout the codebase
- Store shared types in `src/lib/types/`

---

## Severity Naming

### Player-Centric Language

```typescript
// Always use these three severity levels
type Severity = "minor" | "playable" | "unplayable";

// Examples:
// - minor: Cosmetic issues (light out, worn art)
// - playable: Affects gameplay but machine is playable (shot not registering)
// - unplayable: Machine cannot be played (display dead, ball stuck)
```

**Key points**:
- Use player-centric language, not technical terms
- Three levels only: minor, playable, unplayable
- Never use: low/medium/high, critical, or other severity names

---

## Progressive Enhancement

### Forms That Work Without JavaScript

```typescript
// Server Action form (works without JS)
export default function CreateIssueForm() {
  return (
    <form action={createIssueAction}>
      <input name="title" required />
      <select name="machineId" required>
        <option value="">Select machine...</option>
        {/* ... */}
      </select>
      <select name="severity" required>
        <option value="minor">Minor</option>
        <option value="playable">Playable</option>
        <option value="unplayable">Unplayable</option>
      </select>
      <button type="submit">Create Issue</button>
    </form>
  );
}

// Enhanced with Client Component for better UX (optional)
"use client";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create Issue"}
    </button>
  );
}
```

**Key points**:
- Forms must work without JavaScript (CORE-ARCH-002)
- Use Server Actions with `<form action={...}>`
- Enhance with Client Components for loading states (optional)

---

## Adding New Patterns

**When to add a pattern**:
1. You've implemented the same approach 2+ times
2. It's specific to PinPoint (not general Next.js/React knowledge)
3. Future agents would benefit from seeing the example

**How to add**:
1. Create a new section with clear heading
2. Include working code example
3. List 2-3 key points about why this pattern
4. Keep it concise - patterns, not tutorials

**What NOT to add**:
- General TypeScript/React patterns (use TYPESCRIPT_STRICTEST_PATTERNS.md)
- Library-specific patterns (use Context7 for current library docs)
- One-off solutions that won't be repeated
