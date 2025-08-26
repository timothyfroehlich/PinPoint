# Phase 1C: Server Actions Infrastructure

## 📋 Overview

**Goal**: Implement modern Server Actions infrastructure with 2025 performance patterns, replacing client-side tRPC mutations

**Current State**:
- All mutations through tRPC (`api.issue.create.useMutation()`)
- Client-side form handling with React state
- No Server Actions in codebase
- Client-side validation and error handling

**Target State**:
- Server Actions with React 19 cache() API for performance
- Next.js 15 Form component with built-in enhancements
- Server-side validation with useActionState (React 19)
- Background tasks with unstable_after API
- React Compiler optimization for automatic performance
- shadcn/ui blocks for rapid form development

## 🚨 CRITICAL: 2025 Tech Stack Updates

**Performance Requirements**:
- **Next.js 15**: Explicit caching required (defaults now uncached)
- **React 19**: useActionState replaces useFormState
- **Supabase**: @supabase/ssr patterns (auth-helpers deprecated)
- **React Compiler**: Automatic optimization enabled

## 🎯 Implementation Plan

### Step 1: Server Actions Foundation (2025 Patterns)

**Create `src/lib/actions/shared.ts`** (Updated for React 19 & Supabase SSR):
```typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react"; // React 19 cache API
import { unstable_after } from "next/server"; // Background tasks
import { z } from "zod";
import { createClient } from "~/lib/supabase/server"; // Updated SSR import

// UPDATED: Server-first auth with React 19 cache() for performance
export const getServerAuthContext = cache(async () => {
  const supabase = await createClient(); // Now async with SSR
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/sign-in");
  }

  const organizationId = user.user_metadata?.organizationId;
  if (!organizationId) {
    redirect("/onboarding");
  }

  return { user, organizationId };
});

// UPDATED: High-performance auth wrapper with caching
export async function withAuth<T>(
  action: (user: any, organizationId: string) => Promise<T>
) {
  const { user, organizationId } = await getServerAuthContext();
  return action(user, organizationId);
}

// UPDATED: Action result types for React 19 useActionState
export type ActionResult<T = any> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Success helper with optional message
export function actionSuccess<T>(data: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

// Error helpers with field-level validation
export function actionError(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}

// UPDATED: Enhanced form validation with better error formatting
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): ActionResult<T> {
  const rawData = Object.fromEntries(formData.entries());
  
  // Convert empty strings to undefined for optional fields
  const processedData = Object.entries(rawData).reduce((acc, [key, value]) => {
    acc[key] = value === '' ? undefined : value;
    return acc;
  }, {} as Record<string, any>);

  const result = schema.safeParse(processedData);
  
  if (result.success) {
    return actionSuccess(result.data);
  }

  // Format Zod errors for form display
  const fieldErrors = result.error.errors.reduce((acc, error) => {
    const path = error.path.join('.');
    if (!acc[path]) acc[path] = [];
    acc[path].push(error.message);
    return acc;
  }, {} as Record<string, string[]>);

  return actionError("Validation failed", fieldErrors);
}

// NEW: Background task helper
export function runAfterResponse(task: () => Promise<void>) {
  unstable_after(task);
}

// Form data validation helper
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const rawData = Object.fromEntries(formData.entries());
  
  // Convert empty strings to undefined for optional fields
  const processedData = Object.entries(rawData).reduce((acc, [key, value]) => {
    acc[key] = value === '' ? undefined : value;
    return acc;
  }, {} as Record<string, any>);

  const result = schema.safeParse(processedData);
  
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors for form display
  const errors = result.error.errors.reduce((acc, error) => {
    const path = error.path.join('.');
    if (!acc[path]) acc[path] = [];
    acc[path].push(error.message);
    return acc;
  }, {} as Record<string, string[]>);

  return { success: false, errors };
}

// Revalidation helpers
export function revalidateIssues() {
  revalidatePath("/issues");
  revalidateTag("issues");
}

export function revalidateMachines() {
  revalidatePath("/machines");
  revalidateTag("machines");
}

export function revalidateDashboard() {
  revalidatePath("/dashboard");
  revalidateTag("dashboard");
}
```

### Step 2: Issue Actions Implementation (2025 Performance Patterns)

**Create `src/lib/actions/issue-actions.ts`**:
```typescript
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { cache } from "react"; // React 19 performance
import { and, eq } from "drizzle-orm";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { issues, issueStatuses, priorities } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { transformKeysToSnakeCase } from "~/lib/utils/case-transformers";
import { 
  getServerAuthContext, 
  validateFormData, 
  actionSuccess, 
  actionError, 
  runAfterResponse,
  type ActionResult 
} from "./shared";

// UPDATED: Enhanced validation schemas with better error messages
const createIssueSchema = z.object({
  title: z.string()
    .min(1, "Issue title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z.string().optional(),
  machineId: z.string()
    .min(1, "Please select a machine")
    .uuid("Invalid machine selected"),
  priority: z.enum(['low', 'medium', 'high'])
    .optional()
    .default('medium'),
  assigneeId: z.string().uuid().optional(),
});

const updateIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assigneeId: z.string().optional(),
});

const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
  issueId: z.string().min(1, "Issue ID is required"),
});

// UPDATED: High-performance create issue action (2025 patterns)
export async function createIssueAction(
  prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, organizationId } = await getServerAuthContext();
    
    // Validate input data
    const validation = validateFormData(formData, createIssueSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    
    // PERFORMANCE: Cached database queries
    const getDefaultStatus = cache(async (orgId: string) => {
      return await db.query.issueStatuses.findFirst({
        where: and(
          eq(issueStatuses.is_default, true),
          eq(issueStatuses.organization_id, orgId)
        )
      });
    });

    const getDefaultPriority = cache(async (orgId: string) => {
      return await db.query.priorities.findFirst({
        where: and(
          eq(priorities.is_default, true),
          eq(priorities.organization_id, orgId)
        )
      });
    });

    const [defaultStatus, defaultPriority] = await Promise.all([
      getDefaultStatus(organizationId),
      getDefaultPriority(organizationId)
    ]);
    
    if (!defaultStatus || !defaultPriority) {
      return actionError("System configuration error. Please contact support.");
    }
    
    // Create issue in database
    const issueData = {
      id: generatePrefixedId("issue"),
      title: validation.data.title,
      description: validation.data.description || "",
      machineId: validation.data.machineId,
      organizationId,
      statusId: defaultStatus.id,
      priorityId: defaultPriority.id,
      assigneeId: validation.data.assigneeId,
      createdById: user.id,
    };

    await db.insert(issues).values(
      transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert,
    );

    // PERFORMANCE: Granular cache invalidation
    revalidatePath("/issues");
    revalidatePath(`/issues/${issueData.id}`);
    revalidatePath("/dashboard");
    revalidateTag("issues");
    
    // BACKGROUND: Run analytics after response
    runAfterResponse(async () => {
      // Analytics, notifications, etc.
      console.log(`Issue ${issueData.id} created by ${user.email}`);
    });
    
    // Redirect to new issue
    redirect(`/issues/${issueData.id}`);
    
  } catch (error) {
    console.error("Create issue error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to create issue. Please try again."
    );
  }
}

// Update issue action
export async function updateIssueAction(issueId: string, formData: FormData) {
  return withAuth(async (user, organizationId, dal) => {
    try {
      const validation = validateFormData(formData, updateIssueSchema);
      
      if (!validation.success) {
        return actionError("Validation failed", validation.errors);
      }

      const updatedIssue = await dal.issues.update(issueId, validation.data);

      revalidateIssues();
      
      return actionSuccess(updatedIssue);
      
    } catch (error) {
      console.error("Update issue error:", error);
      if (error.message.includes("not found")) {
        return actionError("Issue not found or access denied");
      }
      return actionError("Failed to update issue. Please try again.");
    }
  });
}

// Delete issue action
export async function deleteIssueAction(issueId: string) {
  return withAuth(async (user, organizationId, dal) => {
    try {
      await dal.issues.delete(issueId);

      revalidateIssues();
      
      return actionSuccess({ deleted: true });
      
    } catch (error) {
      console.error("Delete issue error:", error);
      if (error.message.includes("not found")) {
        return actionError("Issue not found or access denied");
      }
      return actionError("Failed to delete issue. Please try again.");
    }
  });
}

// Add comment action
export async function addCommentAction(formData: FormData) {
  return withAuth(async (user, organizationId, dal) => {
    try {
      const validation = validateFormData(formData, commentSchema);
      
      if (!validation.success) {
        return actionError("Validation failed", validation.errors);
      }

      const comment = await dal.issues.addComment({
        ...validation.data,
        userId: user.id,
      });

      revalidateIssues();
      
      return actionSuccess(comment);
      
    } catch (error) {
      console.error("Add comment error:", error);
      return actionError("Failed to add comment. Please try again.");
    }
  });
}

// Bulk actions
export async function bulkUpdateIssuesAction(issueIds: string[], updates: any) {
  return withAuth(async (user, organizationId, dal) => {
    try {
      const results = await Promise.allSettled(
        issueIds.map(id => dal.issues.update(id, updates))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - successful;

      revalidateIssues();
      
      return actionSuccess({
        successful,
        failed,
        message: `Updated ${successful} issues${failed > 0 ? `, ${failed} failed` : ''}`
      });
      
    } catch (error) {
      console.error("Bulk update error:", error);
      return actionError("Failed to update issues. Please try again.");
    }
  });
}
```

### Step 3: Machine Actions Implementation

**Create `src/lib/actions/machine-actions.ts`**:
```typescript
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { withAuth, actionSuccess, actionError, validateFormData, revalidateMachines } from "./base";

const createMachineSchema = z.object({
  name: z.string().min(1, "Machine name is required").max(100, "Name too long"),
  serialNumber: z.string().optional(),
  modelId: z.string().min(1, "Model is required"),
  locationId: z.string().min(1, "Location is required"),
  status: z.enum(['active', 'maintenance', 'inactive']).default('active'),
  notes: z.string().optional(),
});

const updateMachineSchema = createMachineSchema.partial();

export async function createMachineAction(formData: FormData) {
  return withAuth(async (user, organizationId, dal) => {
    try {
      const validation = validateFormData(formData, createMachineSchema);
      
      if (!validation.success) {
        return actionError("Validation failed", validation.errors);
      }

      const machine = await dal.machines.create({
        ...validation.data,
        createdBy: user.id,
      });

      revalidateMachines();
      
      const redirectTo = formData.get('_redirect') as string;
      if (redirectTo) {
        redirect(redirectTo === 'new' ? `/machines/${machine.id}` : redirectTo);
      }

      return actionSuccess(machine);
      
    } catch (error) {
      console.error("Create machine error:", error);
      return actionError("Failed to create machine. Please try again.");
    }
  });
}

export async function updateMachineAction(machineId: string, formData: FormData) {
  return withAuth(async (user, organizationId, dal) => {
    try {
      const validation = validateFormData(formData, updateMachineSchema);
      
      if (!validation.success) {
        return actionError("Validation failed", validation.errors);
      }

      const updatedMachine = await dal.machines.update(machineId, validation.data);

      revalidateMachines();
      
      return actionSuccess(updatedMachine);
      
    } catch (error) {
      console.error("Update machine error:", error);
      if (error.message.includes("not found")) {
        return actionError("Machine not found or access denied");
      }
      return actionError("Failed to update machine. Please try again.");
    }
  });
}
```

### Step 4: Form Components with Server Actions (2025 Patterns)

**Create `src/components/forms/IssueForm.tsx`** (React 19 + Next.js Form):
```typescript
"use client";

import { useActionState, useFormStatus } from "react-dom"; // UPDATED: React 19 hook
import { Form } from "next/form"; // NEW: Next.js Form component
import { createIssueAction, updateIssueAction } from "~/lib/actions/issue-actions";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface IssueFormProps {
  machines: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  initialData?: {
    id?: string;
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    machineId?: string;
    assigneeId?: string;
  };
  redirectTo?: string;
}

function SubmitButton({ isEdit = false, isPending }: { isEdit?: boolean; isPending: boolean }) {
  const { pending: formPending } = useFormStatus();
  const isSubmitting = isPending || formPending;
  
  return (
    <Button type="submit" disabled={isSubmitting}>
      {isSubmitting ? 'Saving...' : isEdit ? 'Update Issue' : 'Create Issue'}
    </Button>
  );
}

export function IssueForm({ machines, users, initialData, redirectTo }: IssueFormProps) {
  const isEdit = !!initialData?.id;
  const action = isEdit 
    ? updateIssueAction.bind(null, initialData.id!)
    : createIssueAction;
  
  // UPDATED: React 19 useActionState with pending state
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <Form action={formAction} className="space-y-6">
      {/* Hidden redirect field */}
      {redirectTo && <input type="hidden" name="_redirect" value={redirectTo} />}
      
      {/* Error display */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Title field */}
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">
          Title *
        </label>
        <Input
          id="title"
          name="title"
          defaultValue={initialData?.title}
          placeholder="Enter issue title"
          aria-invalid={state?.fieldErrors?.title ? 'true' : 'false'}
        />
        {state?.fieldErrors?.title && (
          <p className="text-sm text-red-600">{state.fieldErrors.title[0]}</p>
        )}
      </div>

      {/* Description field */}
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initialData?.description}
          placeholder="Describe the issue in detail"
          rows={4}
        />
        {state?.fieldErrors?.description && (
          <p className="text-sm text-red-600">{state.fieldErrors.description[0]}</p>
        )}
      </div>

      {/* Priority field */}
      <div className="space-y-2">
        <label htmlFor="priority" className="text-sm font-medium">
          Priority
        </label>
        <Select name="priority" defaultValue={initialData?.priority || 'medium'}>
          <SelectTrigger>
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status field (edit only) */}
      {isEdit && (
        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <Select name="status" defaultValue={initialData?.status}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Machine field */}
      <div className="space-y-2">
        <label htmlFor="machineId" className="text-sm font-medium">
          Machine *
        </label>
        <Select name="machineId" defaultValue={initialData?.machineId}>
          <SelectTrigger>
            <SelectValue placeholder="Select machine" />
          </SelectTrigger>
          <SelectContent>
            {machines.map((machine) => (
              <SelectItem key={machine.id} value={machine.id}>
                {machine.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.fieldErrors?.machineId && (
          <p className="text-sm text-red-600">{state.fieldErrors.machineId[0]}</p>
        )}
      </div>

      {/* Assignee field */}
      <div className="space-y-2">
        <label htmlFor="assigneeId" className="text-sm font-medium">
          Assignee
        </label>
        <Select name="assigneeId" defaultValue={initialData?.assigneeId || ""}>
          <SelectTrigger>
            <SelectValue placeholder="Select assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unassigned</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submit button */}
      <div className="flex gap-3">
        <SubmitButton isEdit={isEdit} isPending={isPending} />
        {redirectTo && (
          <Button type="button" variant="outline" asChild>
            <a href={redirectTo}>Cancel</a>
          </Button>
        )}
      </div>
    </Form>
  );
}
```

### Step 5: Progressive Enhancement Patterns (2025 Optimizations)

**Create `src/components/forms/CommentForm.tsx`** (React Compiler + Optimistic Updates):
```typescript
"use client";

import { useOptimistic, useTransition, useRef } from "react";
import { useActionState } from "react-dom"; // React 19
import { addCommentAction } from "~/lib/actions/issue-actions";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

interface Comment {
  id: string;
  content: string;
  user: { name: string; avatarUrl?: string };
  createdAt: Date;
}

interface CommentFormProps {
  issueId: string;
  comments: Comment[];
  currentUser: { name: string; avatarUrl?: string };
}

export function CommentForm({ issueId, comments, currentUser }: CommentFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    (state, newComment: string) => [
      ...state,
      {
        id: `temp-${Date.now()}`,
        content: newComment,
        user: currentUser,
        createdAt: new Date(),
      },
    ]
  );

  // ENHANCED: Better optimistic updates with error handling
  const [commentState, commentAction, isAddingComment] = useActionState(addCommentAction, null);

  async function handleSubmit(formData: FormData) {
    const content = formData.get('content') as string;
    if (!content.trim()) return;

    startTransition(() => {
      // Add optimistic comment
      addOptimisticComment(content);
      
      // Reset form immediately for better UX
      formRef.current?.reset();
      
      // Server Action handles the rest
      commentAction(formData);
    });
  }

  // Show error if comment failed
  if (commentState?.error) {
    console.error("Comment failed:", commentState.error);
  }

  return (
    <div className="space-y-4">
      {/* Comments list */}
      <div className="space-y-3">
        {optimisticComments.map((comment) => (
          <div key={comment.id} className="flex space-x-3">
            <img
              src={comment.user.avatarUrl || '/default-avatar.png'}
              alt={comment.user.name}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-medium">{comment.user.name}</span>
                <span className="text-gray-500 ml-2">
                  {comment.createdAt.toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Comment form with Next.js Form */}
      <Form ref={formRef} action={handleSubmit} className="space-y-3">
        <input type="hidden" name="issueId" value={issueId} />
        <Textarea
          name="content"
          placeholder="Add a comment..."
          rows={3}
          required
          disabled={isPending}
        />
        <Button type="submit" size="sm" disabled={isPending || isAddingComment}>
          {(isPending || isAddingComment) ? 'Adding...' : 'Add Comment'}
        </Button>
        
        {commentState?.error && (
          <p className="text-sm text-destructive mt-2">
            {commentState.error}
          </p>
        )}
      </Form>
    </div>
  );
}
```

### Step 6: File Upload Actions (2025 Performance + Background Processing)

**Create `src/lib/actions/upload-actions.ts`**:
```typescript
"use server";

import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { cache } from "react"; // Performance
import { 
  getServerAuthContext, 
  actionSuccess, 
  actionError, 
  runAfterResponse, 
  type ActionResult 
} from "./shared";

const uploadSchema = z.object({
  file: z.instanceof(File).refine(file => file.size <= 10 * 1024 * 1024, {
    message: "File size must be less than 10MB"
  }),
  type: z.enum(['avatar', 'attachment', 'machine_photo']),
  entityId: z.string().optional(),
});

export async function uploadFileAction(
  prevState: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<{ url: string; fileName: string; size: number; type: string }>> {
  try {
    const { user, organizationId } = await getServerAuthContext();
    try {
      const file = formData.get('file') as File;
      const type = formData.get('type') as string;
      const entityId = formData.get('entityId') as string;

      const validation = uploadSchema.safeParse({ file, type, entityId });
      
      if (!validation.success) {
        return actionError("Invalid file or parameters", validation.error.flatten().fieldErrors);
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop();
      const randomName = randomBytes(16).toString('hex');
      const fileName = `${randomName}.${fileExtension}`;
      
      // Create upload directory
      const uploadDir = join(process.cwd(), 'public', 'uploads', organizationId, type);
      await mkdir(uploadDir, { recursive: true });
      
      // Write file
      const filePath = join(uploadDir, fileName);
      const bytes = await file.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));
      
      // Generate public URL
      const publicUrl = `/uploads/${organizationId}/${type}/${fileName}`;
      
      // Store file record in database if needed
      if (entityId) {
        // Add file attachment record to database
        // This would depend on your schema for attachments
      }

      // BACKGROUND: Process file after response (thumbnails, virus scan, etc.)
      runAfterResponse(async () => {
        console.log(`File uploaded: ${fileName} for org ${organizationId}`);
        // Generate thumbnails, scan for viruses, update analytics, etc.
      });

      return actionSuccess({
        url: publicUrl,
        fileName: file.name,
        size: file.size,
        type: file.type,
      });
      
    } catch (error) {
      console.error("Upload error:", error);
      return actionError(
        error instanceof Error ? error.message : "Failed to upload file. Please try again."
      );
    }
  }
}

export async function deleteFileAction(filePath: string) {
  return withAuth(async (user, organizationId, dal) => {
    try {
      // Security check - ensure file belongs to user's org
      if (!filePath.includes(organizationId)) {
        return actionError("Access denied");
      }

      const fullPath = join(process.cwd(), 'public', filePath);
      await unlink(fullPath);
      
      return actionSuccess({ deleted: true });
      
    } catch (error) {
      console.error("Delete file error:", error);
      return actionError("Failed to delete file");
    }
  });
}
```

## 🎯 Success Criteria (2025 Standards)

**Phase 1C Complete When**:
1. ✅ Server Actions with React 19 cache() API for performance
2. ✅ useActionState replaces useFormState throughout
3. ✅ Next.js Form component with progressive enhancement
4. ✅ Background processing with unstable_after API
5. ✅ React Compiler optimization enabled
6. ✅ shadcn/ui blocks for complex forms
7. ✅ Explicit caching for Next.js 15 performance
8. ✅ Modern Supabase SSR authentication patterns
9. ✅ Optimistic updates with proper error handling
10. ✅ File uploads with background processing

**2025 Performance Targets**:
- Server Action execution under 200ms (improved with caching)
- Form submission feedback within 50ms (React Compiler optimization)
- Request-level memoization eliminates duplicate queries
- Background tasks don't block user response
- Automatic form optimization with React Compiler

## 🚨 Risk Mitigation

**High-Risk Areas**:
- **Form State Management**: Complex validation and error states
- **File Upload Security**: Proper validation and storage
- **Progressive Enhancement**: Graceful fallbacks when JS disabled

**Mitigation Strategies**:
- Comprehensive validation on both client and server
- Secure file handling with type checking and size limits
- Fallback forms work without JavaScript
- Extensive error handling and logging

**2025 Testing Strategy**:
- Unit tests for each Server Action with modern mocking patterns
- Integration tests with PGlite for database operations  
- React Compiler optimization verification
- Performance testing with cache() API patterns
- Security testing for file uploads and background tasks
- Progressive enhancement testing with Next.js Form component

## ⏭️ Next Steps

Once Phase 1C is complete:
- **Phase 1D**: Layout system conversion with Server Components
- **React Compiler Integration**: Enable automatic performance optimization
- **shadcn/ui Blocks**: Implement pre-built form patterns
- **Performance Monitoring**: Verify cache() API effectiveness
- **Background Task Optimization**: Expand unstable_after usage

## 🚀 2025 Enhancements

**React Compiler Configuration** (next.config.mjs):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true, // Automatic optimization
  },
}

export default nextConfig
```

**shadcn/ui Blocks Integration**:
```bash
# Install form blocks for rapid development
npx shadcn@latest add block form-01
npx shadcn@latest add block dashboard-01
npx shadcn@latest add block authentication-01
```

Server Actions with 2025 patterns provide the foundation for ultra-high-performance form handling and mutations in the server-first architecture.