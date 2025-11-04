---
applyTo: "src/lib/actions/**/*.ts,**/*actions*.ts"
---

# Server Actions Instructions

## Server Actions Overview
Server Actions are async functions that execute on the server, called from Client or Server Components. They enable progressive enhancement and type-safe mutations.

## Authentication Pattern (REQUIRED)

**Use withAuth wrapper for all authenticated actions**:
```typescript
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

export const withAuth = <T extends any[], R>(
  action: (userId: string, ...args: T) => Promise<R>
) => async (...args: T): Promise<R> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect("/login");
  }
  
  return action(user.id, ...args);
};

// ✅ Usage
export const updateIssue = withAuth(
  async (userId: string, issueId: string, data: UpdateIssueInput) => {
    // Implementation
  }
);
```

## Organization Scoping (CRITICAL)

**ALL multi-tenant operations MUST include organizationId**:
```typescript
// ✅ Organization-scoped action
export const createIssue = withAuth(
  async (userId: string, organizationId: string, data: CreateIssueInput) => {
    // Verify user belongs to organization
    const membership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId)
      ),
    });
    
    if (!membership) {
      throw new Error("Access denied");
    }
    
    // Create issue with organizationId
    const issue = await db.insert(issues).values({
      ...data,
      organizationId,
      createdBy: userId,
    });
    
    return issue;
  }
);

// ❌ SECURITY VIOLATION: Missing organization scoping
export const createIssue = withAuth(
  async (userId: string, data: CreateIssueInput) => {
    const issue = await db.insert(issues).values({
      ...data,
      createdBy: userId,
    }); // FORBIDDEN: No organizationId
    
    return issue;
  }
);
```

## Input Validation

**Use Zod schemas for validation**:
```typescript
import { z } from "zod";

const updateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
});

export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export const updateIssue = withAuth(
  async (userId: string, organizationId: string, issueId: string, rawData: unknown) => {
    // Validate input
    const data = updateIssueSchema.parse(rawData);
    
    // Verify access
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organizationId, organizationId)
      ),
    });
    
    if (!issue) {
      throw new Error("Issue not found");
    }
    
    // Update issue
    await db.update(issues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(issues.id, issueId));
    
    revalidatePath(`/issues/${issueId}`);
    
    return { success: true };
  }
);
```

## Error Handling

**Use structured errors, never expose internals**:
```typescript
import { AuthorizationError, ValidationError } from "~/lib/errors";

export const deleteIssue = withAuth(
  async (userId: string, organizationId: string, issueId: string) => {
    try {
      const issue = await db.query.issues.findFirst({
        where: and(
          eq(issues.id, issueId),
          eq(issues.organizationId, organizationId)
        ),
      });
      
      if (!issue) {
        throw new AuthorizationError("Access denied");
      }
      
      await db.delete(issues).where(eq(issues.id, issueId));
      
      revalidatePath("/issues");
      
      return { success: true };
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      
      // ✅ Generic error message
      throw new Error("Failed to delete issue");
      
      // ❌ FORBIDDEN: Exposing internal details
      // throw new Error(`Database error: ${error.message}`);
    }
  }
);
```

## Cache Revalidation

**Revalidate affected paths after mutations**:
```typescript
import { revalidatePath, revalidateTag } from "next/cache";

export const updateIssue = withAuth(
  async (userId: string, organizationId: string, issueId: string, data: UpdateIssueInput) => {
    // Update database
    await db.update(issues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(issues.id, issueId));
    
    // ✅ Revalidate affected paths
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    
    // Or use tags for more granular control
    revalidateTag(`issue-${issueId}`);
    
    return { success: true };
  }
);
```

## Type Safety

**Explicit return types for Server Actions**:
```typescript
// ✅ Explicit return type
export const createIssue = withAuth(
  async (
    userId: string,
    organizationId: string,
    data: CreateIssueInput
  ): Promise<{ success: boolean; issueId?: string; error?: string }> => {
    try {
      const result = await db.insert(issues).values({
        ...data,
        organizationId,
        createdBy: userId,
      }).returning();
      
      return { success: true, issueId: result[0].id };
    } catch (error) {
      return { success: false, error: "Failed to create issue" };
    }
  }
);

// ❌ No return type (inference may be incorrect)
export const createIssue = withAuth(
  async (userId: string, organizationId: string, data: CreateIssueInput) => {
    // Implementation
  }
);
```

## Database Operations

**Follow type boundary rules**:
```typescript
import type { Db } from "~/lib/types";
import { DrizzleToCamelCase } from "~/lib/utils/type-conversion";

export const getIssue = withAuth(
  async (userId: string, organizationId: string, issueId: string) => {
    // ✅ DB type in database layer
    const dbIssue: Db.Issue | undefined = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organizationId, organizationId)
      ),
    });
    
    if (!dbIssue) {
      throw new Error("Issue not found");
    }
    
    // ✅ Convert to camelCase at boundary
    return DrizzleToCamelCase(dbIssue);
  }
);
```

## Form Actions

**Progressive Enhancement Pattern**:
```tsx
// Server Action
export const submitContactForm = async (formData: FormData) => {
  "use server";
  
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const message = formData.get("message") as string;
  
  // Validate
  if (!name || !email || !message) {
    return { error: "All fields are required" };
  }
  
  // Process form
  await processContact({ name, email, message });
  
  return { success: true };
};

// Client Component
"use client";

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactForm, null);
  
  return (
    <form action={formAction}>
      <input name="name" required />
      <input name="email" type="email" required />
      <textarea name="message" required />
      <button type="submit">Submit</button>
      {state?.error && <p>{state.error}</p>}
      {state?.success && <p>Thank you!</p>}
    </form>
  );
}
```

## Testing Server Actions

**Use integration tests with worker-scoped database**:
```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

test("createIssue creates issue with organization scoping", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    const userId = SEED_TEST_IDS.USERS.ADMIN;
    const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
    
    const result = await createIssue(userId, orgId, {
      title: "Test Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      severity: "high",
    });
    
    expect(result.success).toBe(true);
    expect(result.issueId).toBeDefined();
    
    // Verify organization scoping
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, result.issueId!),
    });
    
    expect(issue?.organizationId).toBe(orgId);
  });
});
```

## Performance Considerations

- **Minimize database roundtrips**: Batch operations when possible
- **Use transactions**: For operations that must succeed or fail together
- **Avoid n+1 queries**: Use joins or batch fetching
- **Cache frequently accessed data**: Use React `cache()` for request-level caching

## Security Checklist

- [ ] Action uses `withAuth` wrapper
- [ ] Organization scoping is enforced
- [ ] Input is validated with Zod
- [ ] User permissions are checked
- [ ] Errors don't expose internal details
- [ ] Database queries include `organizationId` filter
- [ ] Cache is revalidated after mutations
