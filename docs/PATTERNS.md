## Common Patterns & Examples

This document captures recurring patterns and best practices discovered during development.

---

## Server Actions with Redirect Pattern

When a Server Action needs to either redirect on success or on validation failure, use `redirect()` which throws internally to exit the function. This pattern aligns with Next.js best practices and the Post-Redirect-Get (PRG) pattern.

### Logout Action Example

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

## Machine CRUD Patterns

### Create Machine Server Action

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
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({
      type: "error",
      message: "Unauthorized. Please log in.",
    });
    redirect("/login");
  }

  // Validate input (CORE-SEC-002)
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

  try {
    // Insert machine (direct Drizzle query)
    const [machine] = await db.insert(machines).values({ name }).returning();

    if (!machine) throw new Error("Machine creation failed");

    // Set success flash and revalidate
    await setFlash({
      type: "success",
      message: `Machine "${name}" created successfully`,
    });
    revalidatePath("/machines");

    // Redirect to machine detail page (redirect throws to exit function)
    redirect(`/machines/${machine.id}`);
  } catch (error) {
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
- `redirect()` throws; all validation/auth failures redirect to appropriate page

---

## Machine Status Derivation

### Deriving Machine Status from Issues

Machine operational status is derived from associated open issues, not stored in the database.

```typescript
// src/lib/machines/status.ts
export type MachineStatus = "unplayable" | "needs_service" | "operational";

export type IssueForStatus = {
  status: "new" | "in_progress" | "resolved";
  severity: "minor" | "playable" | "unplayable";
};

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
```

**Usage in Server Component**:

```typescript
// src/app/machines/page.tsx
import { deriveMachineStatus } from "~/lib/machines/status";

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
    status: deriveMachineStatus(machine.issues),
  }));

  return <MachineList machines={machinesWithStatus} />;
}
```

**Key points**:

- Status is derived, not stored (single source of truth)
- Only open issues (not resolved) affect status
- Hierarchy: unplayable > needs_service > operational
- Helper functions for labels and styling separate from logic

---

## Playwright E2E Tests

### Login Helper + Landmark-Scoped Locators

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
// e2e/smoke/auth-flows.spec.ts
test("authenticated navigation", async ({ page }) => {
  await loginAs(page, "user@example.com", "password");

  // Scope locators to landmarks to avoid strict-mode collisions
  await expect(
    page.getByRole("navigation").getByText("Dashboard")
  ).toBeVisible();
  await expect(page.getByRole("main").getByText("Profile")).toBeVisible();
});
```

**Key points**:

- Scope locators to landmarks (`getByRole("navigation")`, `getByRole("main")`) to avoid strict-mode collisions when the same text appears elsewhere.
- When tests share authenticated state (same seeded user), wrap the suite with `test.describe.serial` to keep runs deterministic across workers.

---

## Adding New Patterns

**When to add a pattern**:

- Repeated across multiple files/features (≥2 instances)
- Non-obvious or requires context to understand
- Benefits from a documented example

**How to add**:

1. Choose a clear, descriptive section heading
2. Show minimal, complete example code
3. Bullet-list the key points
4. Reference relevant CORE rules (e.g., `CORE-SEC-001`)
