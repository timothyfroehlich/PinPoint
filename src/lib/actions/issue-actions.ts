/**
 * Issue Server Actions (2025 Performance Patterns)
 * Form handling and mutations for RSC architecture with React 19 cache API
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react"; // React 19 cache API
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { issues, issueStatuses, priorities } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { transformKeysToSnakeCase } from "~/lib/utils/case-transformers";
import { 
  getActionAuthContext, 
  validateFormData, 
  actionSuccess, 
  actionError, 
  runAfterResponse,
  type ActionResult 
} from "./shared";

// Enhanced validation schemas with better error messages
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

const updateIssueStatusSchema = z.object({
  statusId: z.string().uuid("Invalid status selected"),
});

// Performance: Cached database queries for default values
const getDefaultStatus = cache(async (organizationId: string) => {
  const db = getGlobalDatabaseProvider().getClient();
  return await db.query.issueStatuses.findFirst({
    where: and(
      eq(issueStatuses.is_default, true),
      eq(issueStatuses.organization_id, organizationId)
    )
  });
});

const getDefaultPriority = cache(async (organizationId: string) => {
  const db = getGlobalDatabaseProvider().getClient();
  return await db.query.priorities.findFirst({
    where: and(
      eq(priorities.is_default, true),
      eq(priorities.organization_id, organizationId)
    )
  });
});

/**
 * Create new issue via Server Action (React 19 useActionState compatible)
 * Enhanced with performance optimizations and background processing
 */
export async function createIssueAction(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, organizationId } = await getActionAuthContext();
    
    // Enhanced validation with Zod
    const validation = validateFormData(formData, createIssueSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    
    // Parallel queries for better performance
    const [defaultStatus, defaultPriority] = await Promise.all([
      getDefaultStatus(organizationId),
      getDefaultPriority(organizationId)
    ]);
    
    if (!defaultStatus || !defaultPriority) {
      return actionError("System configuration error. Please contact support.");
    }
    
    // Create issue with validated data
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

    // Create issue in database
    await db.insert(issues).values(
      transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert,
    );

    // Granular cache invalidation
    revalidatePath("/issues");
    revalidatePath(`/issues/${issueData.id}`);
    revalidatePath("/dashboard");
    revalidateTag("issues");
    
    // Background processing (runs after response sent to user)
    runAfterResponse(async () => {
      console.log(`Issue ${issueData.id} created by ${user.email}`);
      // Here you can add: analytics, notifications, webhooks, etc.
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

/**
 * Update issue status via Server Action (React 19 useActionState compatible)
 * Enhanced with validation and background processing
 */
export async function updateIssueStatusAction(
  issueId: string,
  _prevState: ActionResult<{ statusId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ statusId: string }>> {
  try {
    const { user, organizationId } = await getActionAuthContext();
    
    // Enhanced validation
    const validation = validateFormData(formData, updateIssueStatusSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();

    // Update with organization scoping for security
    const [updatedIssue] = await db
      .update(issues)
      .set({ status_id: validation.data.statusId })
      .where(and(
        eq(issues.id, issueId),
        eq(issues.organization_id, organizationId)
      ))
      .returning({ status_id: issues.status_id });

    if (!updatedIssue) {
      return actionError("Issue not found or access denied");
    }

    // Granular cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath("/dashboard");
    revalidateTag("issues");

    // Background processing
    runAfterResponse(async () => {
      console.log(`Issue ${issueId} status updated by ${user.email}`);
      // Analytics, status change notifications, etc.
    });

    return actionSuccess({ statusId: updatedIssue.status_id }, "Issue status updated successfully");
    
  } catch (error) {
    console.error("Update issue status error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to update issue status"
    );
  }
}