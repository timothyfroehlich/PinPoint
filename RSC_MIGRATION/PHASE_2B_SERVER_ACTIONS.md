# Phase 2B: Server Actions Infrastructure

**Goal**: Establish Server Actions pattern for form handling, mutations, and cache revalidation replacing client-side tRPC calls

**Success Criteria**:
- Issue creation and status update Server Actions with React 19 compatibility
- Comprehensive form validation with Zod schemas and field-level errors
- Cache revalidation patterns for updated data across Server Components
- Progressive enhancement ensuring forms work without JavaScript

---

## Core Infrastructure Files

### Server Actions Utilities (`src/lib/actions/shared.ts`)

**Purpose**: Common utilities for Server Actions with React 19 patterns

```typescript
import { cache } from "react";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { z } from "zod";

// Server Actions result types for useActionState compatibility
export type ActionResult<T = null> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionSuccess<T>(data: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function actionError(
  error: string, 
  fieldErrors?: Record<string, string[]>
): ActionResult<never> {
  return { success: false, error, fieldErrors };
}

// Authentication context for Server Actions
export const getActionAuthContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error("Authentication required");
  }
  
  const organizationId = user.user_metadata?.organizationId;
  if (!organizationId) {
    throw new Error("No organization selected");
  }
  
  return {
    user,
    userId: user.id,
    organizationId,
    supabase
  };
});

// Form validation helper
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): ActionResult<T> {
  const formObject: Record<string, unknown> = {};
  
  for (const [key, value] of formData.entries()) {
    const stringValue = value.toString().trim();
    formObject[key] = stringValue === "" ? undefined : stringValue;
  }
  
  const result = schema.safeParse(formObject);
  
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    result.error.errors.forEach((error) => {
      const field = error.path.join(".");
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(error.message);
    });
    
    return actionError("Validation failed", fieldErrors);
  }
  
  return actionSuccess(result.data);
}

// Cache revalidation utilities
export function revalidateIssues() {
  revalidateTag("issues");
  revalidatePath("/issues");
  revalidatePath("/dashboard");
}

export function revalidateDashboard() {
  revalidateTag("dashboard");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

// Background task runner for analytics/notifications
export async function runAfterResponse(task: () => Promise<void>) {
  // Future: Use Next.js unstable_after when available
  setTimeout(() => {
    task().catch(console.error);
  }, 0);
}
```

### Issue Server Actions (`src/lib/actions/issue-actions.ts`)

**Purpose**: Issue CRUD operations with organization scoping and cache revalidation

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { issues } from "~/db/schema";
import {
  getActionAuthContext,
  validateFormData,
  actionSuccess,
  actionError,
  revalidateIssues,
  runAfterResponse,
  type ActionResult
} from "./shared";

// Validation schemas
const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  machineId: z.string().uuid("Invalid machine selected"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assigneeId: z.string().uuid().optional()
});

const updateIssueStatusSchema = z.object({
  statusId: z.string().uuid("Invalid status selected")
});

// Create Issue Server Action
export async function createIssueAction(
  _prevState: ActionResult<{ issueId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ issueId: string }>> {
  try {
    // 1. Validate form data
    const validation = validateFormData(formData, createIssueSchema);
    if (!validation.success) {
      return validation;
    }
    
    // 2. Get authentication context
    const { userId, organizationId } = await getActionAuthContext();
    
    // 3. Create issue with organization scoping
    const [newIssue] = await db.insert(issues).values({
      ...validation.data,
      organizationId,
      createdBy: userId,
      status: "open",
      createdAt: new Date()
    }).returning({ id: true });
    
    // 4. Background processing
    runAfterResponse(async () => {
      // Analytics logging
      console.log("📊 Issue created:", newIssue.id, "by user:", userId);
      
      // TODO: Notification delivery
      // TODO: Activity logging
    });
    
    // 5. Cache revalidation
    revalidateIssues();
    
    return actionSuccess(
      { issueId: newIssue.id },
      "Issue created successfully"
    );
    
  } catch (error) {
    console.error("Create issue error:", error);
    
    if (error instanceof Error) {
      return actionError(error.message);
    }
    
    return actionError("Failed to create issue");
  }
}

// Update Issue Status Server Action
export async function updateIssueStatusAction(
  issueId: string,
  _prevState: ActionResult<{ issueId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ issueId: string }>> {
  try {
    // 1. Validate form data
    const validation = validateFormData(formData, updateIssueStatusSchema);
    if (!validation.success) {
      return validation;
    }
    
    // 2. Get authentication context
    const { userId, organizationId } = await getActionAuthContext();
    
    // 3. Verify issue exists and user has access
    const existingIssue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organizationId, organizationId)
      ),
      columns: { id: true, status: true }
    });
    
    if (!existingIssue) {
      return actionError("Issue not found or access denied");
    }
    
    // 4. Update issue status
    const [updatedIssue] = await db.update(issues)
      .set({ 
        status: validation.data.statusId,
        updatedAt: new Date()
      })
      .where(eq(issues.id, issueId))
      .returning({ id: true, status: true });
    
    // 5. Background processing
    runAfterResponse(async () => {
      console.log("📊 Issue status updated:", issueId, "by user:", userId);
      // TODO: Status change notifications
      // TODO: Workflow automation
    });
    
    // 6. Cache revalidation
    revalidateIssues();
    
    return actionSuccess(
      { issueId: updatedIssue.id },
      "Issue status updated successfully"
    );
    
  } catch (error) {
    console.error("Update issue status error:", error);
    
    if (error instanceof Error) {
      return actionError(error.message);
    }
    
    return actionError("Failed to update issue status");
  }
}

// Delete Issue Server Action
export async function deleteIssueAction(
  issueId: string,
  _prevState: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  try {
    const { userId, organizationId } = await getActionAuthContext();
    
    // Verify issue exists and user has access
    const existingIssue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organizationId, organizationId)
      ),
      columns: { id: true, createdBy: true }
    });
    
    if (!existingIssue) {
      return actionError("Issue not found or access denied");
    }
    
    // Only creator can delete (or admin - TODO: permission system)
    if (existingIssue.createdBy !== userId) {
      return actionError("Only issue creator can delete");
    }
    
    // Delete issue
    await db.delete(issues).where(eq(issues.id, issueId));
    
    // Background processing
    runAfterResponse(async () => {
      console.log("📊 Issue deleted:", issueId, "by user:", userId);
    });
    
    // Cache revalidation and redirect
    revalidateIssues();
    redirect("/issues");
    
  } catch (error) {
    console.error("Delete issue error:", error);
    
    if (error instanceof Error) {
      return actionError(error.message);
    }
    
    return actionError("Failed to delete issue");
  }
}
```

---

## React 19 Form Integration Components

### Issue Creation Form (`src/components/issues/issue-create-form.tsx`)

**Purpose**: Client Component using React 19 useActionState for enhanced UX

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { createIssueAction } from "~/lib/actions/issue-actions";

interface IssueCreateFormProps {
  machines: Array<{ id: string; name: string; model: string }>;
  users: Array<{ id: string; name: string; email: string }>;
}

export function IssueCreateForm({ machines, users }: IssueCreateFormProps) {
  const [state, formAction, isPending] = useActionState(createIssueAction, null);
  
  // Success handling
  if (state?.success) {
    return (
      <div className="rounded-md bg-green-50 p-4">
        <p className="text-green-800">
          ✅ {state.message} 
          <a href={`/issues/${state.data.issueId}`} className="underline ml-2">
            View Issue
          </a>
        </p>
      </div>
    );
  }
  
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title *
        </label>
        <Input
          id="title"
          name="title"
          type="text"
          required
          disabled={isPending}
          className={state?.fieldErrors?.title ? "border-red-500" : ""}
        />
        {state?.fieldErrors?.title && (
          <p className="text-red-600 text-sm mt-1">{state.fieldErrors.title[0]}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          disabled={isPending}
          rows={3}
        />
      </div>
      
      <div>
        <label htmlFor="machineId" className="block text-sm font-medium mb-1">
          Machine *
        </label>
        <Select name="machineId" required disabled={isPending}>
          <SelectTrigger className={state?.fieldErrors?.machineId ? "border-red-500" : ""}>
            <SelectValue placeholder="Select a machine" />
          </SelectTrigger>
          <SelectContent>
            {machines.map((machine) => (
              <SelectItem key={machine.id} value={machine.id}>
                {machine.name} - {machine.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.fieldErrors?.machineId && (
          <p className="text-red-600 text-sm mt-1">{state.fieldErrors.machineId[0]}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="priority" className="block text-sm font-medium mb-1">
          Priority
        </label>
        <Select name="priority" defaultValue="medium" disabled={isPending}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <label htmlFor="assigneeId" className="block text-sm font-medium mb-1">
          Assignee
        </label>
        <Select name="assigneeId" disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {state?.error && !state?.fieldErrors && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-red-800">❌ {state.error}</p>
        </div>
      )}
      
      <Button 
        type="submit" 
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Creating Issue..." : "Create Issue"}
      </Button>
    </form>
  );
}
```

---

## Implementation Steps

### 1. Server Actions Utilities Setup
**Files**: `src/lib/actions/shared.ts`
- [ ] Create ActionResult types for React 19 compatibility
- [ ] Implement authentication context utilities  
- [ ] Add form validation helper with Zod integration
- [ ] Create cache revalidation utilities
- [ ] Add background task runner

### 2. Issue Server Actions Implementation
**Files**: `src/lib/actions/issue-actions.ts`  
- [ ] Create `createIssueAction` with comprehensive validation
- [ ] Implement `updateIssueStatusAction` with permission checks
- [ ] Add `deleteIssueAction` with creator validation
- [ ] Ensure organization scoping on all mutations
- [ ] Add background processing hooks

### 3. React 19 Form Components
**Files**: `src/components/issues/issue-create-form.tsx`
- [ ] Create form with `useActionState` hook integration
- [ ] Add real-time validation feedback
- [ ] Implement loading states and error handling
- [ ] Ensure progressive enhancement compatibility

### 4. Form Integration Testing
- [ ] Test Server Actions with valid/invalid data
- [ ] Verify organization scoping prevents cross-tenant mutations
- [ ] Validate React 19 hooks integration
- [ ] Test progressive enhancement (forms work without JS)

---

## Architectural Alignment

### Server Actions Pattern Compliance
- ✅ **"use server"**: All Server Actions properly marked
- ✅ **React 19 Compatibility**: ActionResult types work with useActionState
- ✅ **Progressive Enhancement**: Forms function without JavaScript
- ✅ **Organization Scoping**: All mutations enforced by organizationId
- ✅ **Type Safety**: Zod validation with structured error handling

### Cache Management Integration  
- ✅ **Granular Revalidation**: revalidatePath() for specific pages
- ✅ **Tag-Based Invalidation**: revalidateTag() for related data
- ✅ **Background Processing**: runAfterResponse() for non-critical tasks
- ✅ **Request-Level Consistency**: Cache invalidation triggers immediate updates

---

## Dependencies & Prerequisites

### Complete Before Starting  
- [x] Phase 2A: Data Access Layer Foundation (authentication context, query patterns)
- [x] Supabase SSR authentication working
- [x] shadcn/ui form components available

### Required for Next Phase
- [ ] Issue Server Actions operational and tested
- [ ] React 19 form integration working
- [ ] Cache revalidation patterns validated  
- [ ] Progressive enhancement verified

---

## Success Validation

### Functional Tests
- [ ] Issue creation Server Action works with valid data
- [ ] Form validation catches invalid inputs with field-level errors
- [ ] Cache revalidation updates issue lists immediately
- [ ] Progressive enhancement: forms work without JavaScript
- [ ] Organization scoping prevents cross-tenant mutations

### React 19 Integration Tests
- [ ] `useActionState` provides loading states and error handling
- [ ] `useFormStatus` shows submission progress
- [ ] ActionResult types properly structured for hooks
- [ ] Optimistic updates work correctly

### Security Tests
- [ ] Authentication required for all Server Actions
- [ ] Organization context enforced on all mutations
- [ ] Cross-organization mutations properly denied
- [ ] Input validation prevents SQL injection and XSS

---

**Next Phase**: [Phase 2C: Authentication Integration](./PHASE_2C_AUTHENTICATION.md)

**User Goal Progress**: Server Actions enable form submissions and data mutations, providing the mutation layer needed for interactive dashboard features.