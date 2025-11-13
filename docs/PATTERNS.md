# PinPoint Code Patterns

**Last Updated**: November 14, 2025
**Version**: 2.0 (Greenfield)

**For AI Agents**: This is a living document. When you implement a pattern more than once, add it here so future agents can follow the same approach. Keep examples concise and focused on PinPoint-specific conventions.

---

## Table of Contents

- [Data Fetching](#data-fetching)
- [Mutations](#mutations)
- [Authentication](#authentication)
- [File Organization](#file-organization)
- [Domain Rules](#domain-rules)
- [Type Boundaries](#type-boundaries)
- [Severity Naming](#severity-naming)
- [Progressive Enhancement](#progressive-enhancement)
- [Machine Status Derivation](#machine-status-derivation)
- [Testing Patterns](#testing-patterns)
- [Adding New Patterns](#adding-new-patterns)

---

## Data Fetching

### Server Component + Direct Drizzle Query

```typescript
// src/app/machines/[machineId]/page.tsx
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const { machineId } = await params; // Next.js 16: params is now a Promise

  // Direct query in Server Component - no DAL/repository layer
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    with: {
      issues: {
        columns: {
          id: true,
          title: true,
          status: true,
          severity: true,
          createdAt: true,
        },
        orderBy: desc(issues.createdAt),
      },
    },
  });

  return <MachineDetailView machine={machine} />;
}
```

**Key points**:

- Query directly in Server Component, no intermediate layers (CORE-ARCH-003)
- Use `with` for relations instead of separate queries
- Select specific columns to avoid over-fetching
- Next.js 16: `params` is a Promise, must `await` before accessing properties

---

## Mutations

### Server Action + Zod Validation + Redirect

```typescript
// src/app/machines/schemas.ts
import { z } from "zod";

export const createMachineSchema = z.object({
  name: z
    .string()
    .min(1, "Machine name is required")
    .max(100, "Machine name must be less than 100 characters")
    .trim(),
});
```

```typescript
// src/app/machines/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { createMachineSchema } from "./schemas";
import { setFlash } from "~/lib/flash";

export async function createMachineAction(formData: FormData): Promise<void> {
  // 1. Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized. Please log in." });
    redirect("/login");
  }

  // 2. Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse({
    name: formData.get("name"),
  });

  if (!validation.success) {
    const firstError = validation.error.issues[0];
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/machines/new");
  }

  const { name } = validation.data;

  // 3. Database operation
  try {
    const [machine] = await db.insert(machines).values({ name }).returning();

    if (!machine) throw new Error("Machine creation failed");

    // 4. Flash + revalidate + redirect on success
    await setFlash({
      type: "success",
      message: `Machine "${name}" created successfully`,
    });
    revalidatePath("/machines");
    redirect(`/machines/${machine.id}`);
  } catch {
    await setFlash({
      type: "error",
      message: "Failed to create machine. Please try again.",
    });
    redirect("/machines/new");
  }
}
```

**Key points**:

- Separate Zod schemas from Server Actions (Next.js requirement)
- Always validate and authenticate before mutations
- Use flash messages + redirect for Post-Redirect-Get pattern
- Revalidate affected paths after mutations
- `redirect()` throws internally to exit the function
- Return type is `Promise<void>` (not `Result<T>`)

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
import { setFlash } from "~/lib/flash";

export async function updateProfileAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
  }

  // Mutation logic here...
}
```

**Key points**:

- Always call `auth.getUser()` immediately after creating client (CORE-SSR-002)
- Use `redirect()` for unauthenticated users
- Never skip auth checks in protected routes (CORE-SEC-001)

### Protected Route Pattern

When a route requires authentication, use this pattern at the top of the page component:

```typescript
// src/app/issues/page.tsx (or any protected route)
import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";

export default async function ProtectedPage(): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // User is guaranteed to be authenticated here
  return <div>Protected content</div>;
}
```

**Key points**:

- Check auth at the very start of the component (before any other logic)
- Use `redirect("/login")` to send unauthenticated users to login page
- After the guard, `user` is guaranteed to exist (type narrowing)
- This pattern reached Rule of Three (used in `/dashboard`, `/issues`, `/machines`)

### Logout Action Pattern

```typescript
// src/app/(auth)/actions.ts
export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      await setFlash({
        type: "error",
        message: "Failed to sign out",
      });
      return; // Early exit without redirect
    }

    await setFlash({
      type: "success",
      message: "Signed out successfully",
    });
  } catch (error) {
    await setFlash({
      type: "error",
      message: "Something went wrong",
    });
  } finally {
    // Always redirect to home after logout attempt
    redirect("/");
  }
}
```

**Key points**:

- `finally` block guarantees redirect on all paths
- Flash messages persist across redirect via secure session cookie
- No return value needed; `redirect()` throws internally

---

## File Organization

### Project Structure Conventions

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group for auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   └── actions.ts            # Auth Server Actions
│   ├── (app)/                    # Route group for protected pages
│   │   ├── dashboard/
│   │   ├── machines/
│   │   │   ├── [machineId]/
│   │   │   │   └── page.tsx     # Server Component
│   │   │   ├── new/page.tsx
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts       # Server Actions for this route
│   │   │   └── schemas.ts       # Zod validation schemas
│   │   └── issues/
│   └── layout.tsx
├── components/                    # Shared UI components
│   ├── ui/                       # shadcn/ui components
│   ├── layout/                   # Navigation, headers
│   └── password-strength.tsx     # Domain components
├── lib/                          # Shared utilities
│   ├── supabase/
│   │   └── server.ts
│   ├── machines/                 # Domain logic
│   │   ├── status.ts
│   │   └── status.test.ts
│   ├── types/                    # Shared TypeScript types
│   ├── flash.ts                  # Flash messages
│   └── utils.ts
└── server/                       # Server-only code
    └── db/
        ├── schema.ts             # Drizzle schema
        └── index.ts              # DB instance
```

**Conventions**:

- Server Actions co-located with routes in `actions.ts` files
- Zod schemas in separate `schemas.ts` files (Next.js requirement)
- Domain components in `src/components/` (default to Server Components)
- Client Components have `"use client"` at top
- Database schema in `src/server/db/schema.ts`
- Types in `src/lib/types/`
- Domain logic in `src/lib/<domain>/` (e.g., `src/lib/machines/status.ts`)

---

## Domain Rules

### Issues Always Require Machine

**Schema Enforcement**:

```typescript
// src/server/db/schema.ts
export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  severity: text("severity", { enum: ["minor", "playable", "unplayable"] })
    .notNull()
    .default("playable"),
  // ...
});
// machineId NOT NULL constraint enforces CORE-ARCH-004
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
- Schema enforces with `NOT NULL` constraint and foreign key
- `onDelete: "cascade"` removes issues when machine is deleted
- Never create issue forms without machine selector

---

## Type Boundaries

### Database to Application Type Conversion

```typescript
// Database types (snake_case) stay in schema
// src/server/db/schema.ts
export const issues = pgTable("issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  machineId: uuid("machine_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Application types (camelCase) in lib/types
// src/lib/types/index.ts
export type Issue = {
  id: string;
  machineId: string;
  createdAt: Date;
};

// Drizzle handles conversion automatically in relational queries
const dbIssues = await db.query.issues.findMany();
// dbIssues already has camelCase properties due to Drizzle's automatic conversion
```

**Key points**:

- DB schema uses snake_case (CORE-TS-004)
- Application code uses camelCase (CORE-TS-003)
- Drizzle ORM handles conversion automatically in relational queries
- For raw SQL, convert at boundaries manually
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
- Defined in schema enum for type safety

---

## Progressive Enhancement

### Forms That Work Without JavaScript

```typescript
// Server Action form (works without JS)
export default async function CreateMachineForm() {
  return (
    <form action={createMachineAction}>
      <input name="name" required />
      <button type="submit">Create Machine</button>
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
      {pending ? "Creating..." : "Create Machine"}
    </button>
  );
}
```

**Key points**:

- Forms must work without JavaScript (CORE-ARCH-002)
- Use Server Actions with `<form action={serverAction}>`
- Never wrap Server Actions in inline async functions (breaks serialization)
- Enhance with Client Components for loading states (optional)
- Use `useFormStatus()` hook for pending state

---

## Machine Status Derivation

### Deriving Machine Status from Issues

Machine operational status is derived from associated open issues, not stored in the database.

```typescript
// src/lib/machines/status.ts
export type MachineStatus = "unplayable" | "needs_service" | "operational";

export interface IssueForStatus {
  status: "new" | "in_progress" | "resolved";
  severity: "minor" | "playable" | "unplayable";
}

/**
 * Derive machine status from its issues
 *
 * Logic:
 * - `unplayable`: At least one unplayable issue that's not resolved
 * - `needs_service`: At least one playable/minor issue that's not resolved
 * - `operational`: No open issues
 */
export function deriveMachineStatus(issues: IssueForStatus[]): MachineStatus {
  // Filter to only open issues (not resolved)
  const openIssues = issues.filter((issue) => issue.status !== "resolved");

  if (openIssues.length === 0) {
    return "operational";
  }

  const hasUnplayable = openIssues.some(
    (issue) => issue.severity === "unplayable"
  );
  if (hasUnplayable) {
    return "unplayable";
  }

  return "needs_service";
}

// Helper functions for UI
export function getMachineStatusLabel(status: MachineStatus): string {
  switch (status) {
    case "operational":
      return "Operational";
    case "needs_service":
      return "Needs Service";
    case "unplayable":
      return "Unplayable";
  }
}

export function getMachineStatusStyles(status: MachineStatus): string {
  switch (status) {
    case "operational":
      return "bg-green-100 text-green-800 border-green-300";
    case "needs_service":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "unplayable":
      return "bg-red-100 text-red-800 border-red-300";
  }
}
```

**Usage in Server Component**:

```typescript
// src/app/machines/page.tsx
import { deriveMachineStatus, type IssueForStatus } from "~/lib/machines/status";

export default async function MachinesPage() {
  const machines = await db.query.machines.findMany({
    with: {
      issues: {
        columns: { status: true, severity: true },
      },
    },
  });

  const machinesWithStatus = machines.map((machine) => ({
    ...machine,
    status: deriveMachineStatus(machine.issues as IssueForStatus[]),
  }));

  return <MachineList machines={machinesWithStatus} />;
}
```

**Key points**:

- Status is derived, not stored (single source of truth)
- Only open issues (not resolved) affect status
- Hierarchy: unplayable > needs_service > operational
- Helper functions for labels and styling separate from logic
- Query only needed columns (`status`, `severity`) for performance

---

## Testing Patterns

### Playwright E2E Tests

#### Login Helper + Landmark-Scoped Locators

```typescript
// e2e/support/actions.ts
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/dashboard");
}
```

```typescript
// e2e/smoke/navigation.spec.ts
import { loginAs } from "../support/actions";
import { TEST_USERS } from "../support/constants";

test("authenticated navigation", async ({ page }) => {
  await loginAs(page, TEST_USERS.member.email, TEST_USERS.member.password);

  // Scope locators to landmarks to avoid strict-mode collisions
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: /Machines/i })).toBeVisible();
  await expect(nav.getByText(TEST_USERS.member.name)).toBeVisible();
});
```

**Key points**:

- Keep reusable flows in `e2e/support/actions.ts`
- Scope locators to landmarks (`getByRole("navigation")`, `getByRole("main")`) to avoid collisions
- Use constants for test data in `e2e/support/constants.ts`
- When tests share state, use `test.describe.serial` for deterministic execution
- Prefer semantic locators (`getByRole`, `getByLabel`) over test IDs

### Integration Tests with PGlite

```typescript
// src/test/integration/machines.test.ts
import { describe, it, expect } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines } from "~/server/db/schema";

describe("Machine CRUD Operations (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  it("should create a machine", async () => {
    const db = await getTestDb();

    const [machine] = await db
      .insert(machines)
      .values({ name: "Test Machine" })
      .returning();

    expect(machine).toBeDefined();
    expect(machine.name).toBe("Test Machine");
  });
});
```

**Key points**:

- Use worker-scoped PGlite (CORE-TEST-001)
- Never create per-test instances (causes system lockups)
- Use `setupTestDb()` helper for automatic cleanup
- Test database operations, not Server Components
- Integration tests in `src/test/integration/`

### Unit Tests

```typescript
// src/lib/machines/status.test.ts
import { describe, it, expect } from "vitest";
import { deriveMachineStatus, type IssueForStatus } from "./status";

describe("deriveMachineStatus", () => {
  it("returns operational when no issues", () => {
    expect(deriveMachineStatus([])).toBe("operational");
  });

  it("returns unplayable when has unplayable issue", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("unplayable");
  });

  it("ignores resolved issues", () => {
    const issues: IssueForStatus[] = [
      { status: "resolved", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("operational");
  });
});
```

**Key points**:

- Test pure functions in unit tests
- Test edge cases (empty arrays, resolved issues, etc.)
- Keep tests focused and readable
- Unit tests in same directory as source (e.g., `status.test.ts` next to `status.ts`)

---

---

## Logging

### Structured Logging in Server Actions

```typescript
// src/app/(auth)/actions.ts
"use server";

import { log } from "~/lib/logger";
import { createClient } from "~/lib/supabase/server";

export async function loginAction(formData: FormData): Promise<LoginResult> {
  // Validate input
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    log.warn(
      { errors: parsed.error.issues, action: "login" },
      "Login validation failed"
    );
    return err("VALIDATION", "Invalid input");
  }

  const { email, password } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      log.warn(
        { email, error: error?.message, action: "login" },
        "Login authentication failed"
      );
      return err("AUTH", error?.message ?? "Authentication failed");
    }

    log.info(
      { userId: data.user.id, email: data.user.email, action: "login" },
      "User logged in successfully"
    );

    return ok({ userId: data.user.id });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "login",
      },
      "Login server error"
    );
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}
```

**Key points**:

- Use `log.info()` for successful operations
- Use `log.warn()` for recoverable errors (validation, auth failures)
- Use `log.error()` for server errors with stack traces
- Always include context fields (`userId`, `email`, `action`, etc.)
- Keep message concise; details go in the context object

**Log format**:

```json
{
  "level": "info",
  "time": "2025-11-13T03:19:13.061Z",
  "msg": "User logged in successfully",
  "userId": "abc123",
  "email": "user@example.com",
  "action": "login"
}
```

**Testing**:

- Unit tests don't need to verify logging (implementation detail)
- E2E tests can check for log files if critical

---

## Adding New Patterns

**When to add a pattern**:

1. You've implemented the same approach 2+ times (Rule of Three)
2. It's specific to PinPoint (not general Next.js/React knowledge)
3. Future agents would benefit from seeing the example
4. It's non-obvious or requires context to understand

**How to add**:

1. Create a new section with clear heading
2. Include minimal, working code example
3. List 2-3 key points explaining why this pattern
4. Reference relevant CORE rules (e.g., `CORE-SEC-001`)
5. Keep it concise - patterns, not tutorials

**What NOT to add**:

- General TypeScript/React patterns (use `TYPESCRIPT_STRICTEST_PATTERNS.md`)
- Library-specific patterns (use Context7 for current library docs)
- One-off solutions that won't be repeated
- Implementation details that are already in the code

**Template**:

````markdown
### Pattern Name

Brief description of when to use this pattern.

```typescript
// Minimal working example
```
````

**Key points**:

- Point 1 about why this matters
- Point 2 about gotchas or non-obvious behavior
- Reference to CORE rule if applicable (e.g., CORE-SEC-001)

```

```
