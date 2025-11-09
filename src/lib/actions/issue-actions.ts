/**
 * Issue Server Actions (2025 Performance Patterns)
 * Form handling and mutations for RSC architecture with React 19 cache API
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cache } from "react"; // React 19 cache API
import { z } from "zod";
import {
  titleSchema,
  commentContentSchema,
  uuidSchema,
  descriptionSchema,
  optionalPrioritySchema,
} from "~/lib/validation/schemas";
import { and, eq, inArray } from "drizzle-orm";
import {
  issues,
  issueStatuses,
  priorities,
  machines,
  comments,
} from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { transformKeysToSnakeCase } from "~/lib/utils/case-transformers";
import { getDb } from "~/lib/dal/shared";
import {
  validateFormData,
  actionSuccess,
  actionError,
  runAfterResponse,
  type ActionResult,
} from "./shared";
import { isError, getErrorMessage } from "~/lib/utils/type-guards";
import { getRequestAuthContext } from "~/server/auth/context";
import { requirePermission } from "./shared";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import {
  generateIssueCreationNotifications,
  generateStatusChangeNotifications,
  generateAssignmentNotifications,
} from "~/lib/services/notification-generator";
import { getInMemoryRateLimiter } from "~/lib/rate-limit/inMemory";
import { calculateEffectiveMachineVisibility } from "~/lib/utils/visibility-inheritance";

// Enhanced validation schemas with better error messages
// Accept either a UUID or a deterministic seeded machine id (e.g. "machine-mm-001")
const machineIdentifierSchema = z
  .string()
  .min(1, { message: "Please select a machine" })
  .refine(
    (v) =>
      /^machine-[a-z0-9_-]+$/i.test(v) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    { message: "Invalid machine selection" },
  );

const createIssueSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  machineId: machineIdentifierSchema,
  // Priority = internal scheduling weight (hidden for anonymous)
  priority: optionalPrioritySchema.default("medium"),
  // Severity = inherent impact (can be set by anonymous reporters)
  severity: z
    .enum(["low", "medium", "high", "critical"])
    .optional()
    .default("medium"),
  assigneeId: z.union([uuidSchema, z.literal("unassigned")]).optional(),
});

const updateIssueStatusSchema = z.object({
  statusId: uuidSchema, // uses centralized uuid validator (provides proper message)
});

const addCommentSchema = z.object({ content: commentContentSchema });

const updateIssueAssignmentSchema = z.object({
  assigneeId: z.union([uuidSchema, z.literal("unassigned")]).optional(),
});

const bulkUpdateIssuesSchema = z.object({
  issueIds: z
    .array(uuidSchema)
    .min(1, "No issues selected")
    .max(50, "Cannot update more than 50 issues at once"),
  statusId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
});

// Performance: Cached database queries for default values
const getDefaultStatus = cache(async (organizationId: string) => {
  return await getDb().query.issueStatuses.findFirst({
    where: and(
      eq(issueStatuses.is_default, true),
      eq(issueStatuses.organization_id, organizationId),
    ),
  });
});

const getDefaultPriority = cache(async (organizationId: string) => {
  return await getDb().query.priorities.findFirst({
    where: and(
      eq(priorities.is_default, true),
      eq(priorities.organization_id, organizationId),
    ),
  });
});

/**
 * Create new issue via Server Action (React 19 useActionState compatible)
 * Enhanced with performance optimizations and background processing
 */
export async function createIssueAction(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;

    // Enhanced validation with Zod
    // Perform validation but adapt success shape to our expected return type later
    const validation = validateFormData(formData, createIssueSchema);
    if (!validation.success) {
      // Pass through error/fieldErrors (already correct shape)
      return validation as ActionResult<{ id: string }>;
    }
    // Extract validated fields (do not return validation directly since type expects id)
    const validated = validation.data;

    // Determine creation permission tier
    let hasFull = false;
    try {
      await requirePermission(
        { role_id: membership.role.id },
        PERMISSIONS.ISSUE_CREATE_FULL,
      );
      hasFull = true;
    } catch {
      // Try basic (or legacy) permission
      try {
        await requirePermission(
          { role_id: membership.role.id },
          PERMISSIONS.ISSUE_CREATE_BASIC,
        );
      } catch {
        return actionError("Not authorized to create issues");
      }
    }

    // Parallel queries for better performance
    const [defaultStatus, defaultPriority] = await Promise.all([
      getDefaultStatus(organizationId),
      getDefaultPriority(organizationId),
    ]);
    let resolvedStatus = defaultStatus;
    let resolvedPriority = defaultPriority;
    // Fallback: pick first available status/priority to avoid hard failure in mis-seeded envs
    if (!resolvedStatus) {
      resolvedStatus = await getDb().query.issueStatuses.findFirst({
        where: eq(issueStatuses.organization_id, organizationId),
      });
      if (!resolvedStatus) {
        return actionError(
          "No issue statuses configured for organization. Please contact support.",
        );
      }
    }
    if (!resolvedPriority) {
      resolvedPriority = await getDb().query.priorities.findFirst({
        where: eq(priorities.organization_id, organizationId),
      });
      if (!resolvedPriority) {
        return actionError(
          "No priorities configured for organization. Please contact support.",
        );
      }
    }

    // Handle special "unassigned" case
    const assigneeId = hasFull
      ? validated.assigneeId === "unassigned"
        ? null
        : (validated.assigneeId ?? null)
      : null; // Basic cannot assign

    // Create issue with validated data
    const issueData = {
      id: generatePrefixedId("issue"),
      title: validated.title,
      description: validated.description ?? "",
      machineId: validated.machineId,
      organizationId,
      statusId: resolvedStatus.id,
      priorityId: resolvedPriority.id, // Basic cannot override (UI hides)
      assigneeId,
      createdById: user.id,
      severity: validated.severity,
    };

    // Create issue in database
    // SAFE TYPE ASSERTION: transformKeysToSnakeCase is deterministic key transformation
    // - issueData object explicitly constructed with all required schema fields above (lines 197-208)
    // - All fields validated via Zod schema before reaching this point
    // - Transformer only renames keys (camelCase → snake_case), preserves values
    // - TypeScript validates field types at object construction (line 197)
    // LIMITATION: If schema adds new required field without default, error occurs at runtime
    // MITIGATION: Integration tests validate all insert paths against live schema
    await getDb()
      .insert(issues)
      .values(
        transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert,
      );

    // Granular cache invalidation
    revalidatePath("/issues");
    revalidatePath(`/issues/${issueData.id}`);
    revalidatePath("/dashboard");
    revalidateTag("issues", "max");

    // Background processing (runs after response sent to user)
    runAfterResponse(async () => {
      console.log(`Issue ${issueData.id} created by ${user.email}`);

      // Generate notifications for issue creation
      try {
        await generateIssueCreationNotifications(issueData.id, {
          organizationId,
          actorId: user.id,
          actorName: user.name ?? user.email,
        });
      } catch (error) {
        console.error(
          "Failed to generate issue creation notifications:",
          getErrorMessage(error),
        );
      }
    });

    // Return success (client enhancement layer will handle navigation)
    return actionSuccess({ id: issueData.id }, "Issue created successfully");
  } catch (error) {
    // (Legacy redirect handling removed – action now returns success and client redirects)
    console.error("Create issue error:", error);
    return actionError(getErrorMessage(error));
  }
}

/**
 * Public (anonymous or guest) issue creation.
 * - No authentication required.
 * - Restricts ability to set priority / assignee.
 * - Allows specifying severity + title/description + machine.
 * - Records reporter metadata (optional name/email).
 *
 * SECURITY ARCHITECTURE:
 * This Server Action uses manual visibility validation rather than RLS because:
 * 1. Server Actions run with service role credentials (bypass RLS for performance)
 * 2. Manual validation mirrors RLS policies defined in 01-rls-policies.sql
 * 3. Provides clearer error messages to anonymous users
 * 4. See inline comments below for detailed policy mapping
 *
 * CONSISTENCY:
 * - Must stay synchronized with RLS policies:
 *   - machines_public_read (01-rls-policies.sql:317-345)
 *   - organizations_context_read (01-rls-policies.sql:150-154)
 *   - issues_public_read (01-rls-policies.sql:415-445)
 * - Changes to RLS policies require corresponding updates here
 * - Validated by RLS integration tests in supabase/tests/
 */
export async function createPublicIssueAction(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  // =============================================================================
  // RATE LIMITING: In-Memory Implementation
  // =============================================================================
  // ARCHITECTURE: Naive in-memory rate limiting for single-instance deployments
  //
  // LIMITATIONS:
  // 1. Single-instance only: State not shared across multiple server instances
  // 2. Memory loss on restart: Limits reset when server restarts/redeploys
  // 3. No persistence: Limits not stored in database or cache
  // 4. Easy bypass: Users can evade limits by changing IP or machine
  // 5. Testing override: Uses global variable hack for test environments
  //
  // CONFIGURATION:
  // - Window: 60 seconds (60_000ms)
  // - Max requests: 5 per IP+machine combination
  // - Key format: "public_issue:{ip}:{machineId}"
  //
  // PRODUCTION CONSIDERATIONS:
  // - For multi-instance deployments, migrate to Redis-based rate limiting
  // - Consider using edge middleware (Cloudflare, Vercel) for distributed limits
  // - Add database-level throttling as defense-in-depth
  // - Monitor for abuse patterns and adjust limits accordingly
  //
  // SECURITY:
  // - IP spoofing possible (honors X-Forwarded-For headers)
  // - Not suitable for high-security scenarios
  // - Provides basic protection against simple automated abuse
  // =============================================================================

  let rateLimitIp = "unknown";
  let rateLimitMachineId = "none";

  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const raw =
      h.get("x-forwarded-for") ??
      h.get("cf-connecting-ip") ??
      h.get("x-real-ip") ??
      "";
    const issueRateLimitIp =
      "ISSUE_RATE_LIMIT_IP" in globalThis
        ? (globalThis as unknown as { ISSUE_RATE_LIMIT_IP: string })
            .ISSUE_RATE_LIMIT_IP
        : undefined;
    rateLimitIp = issueRateLimitIp ?? raw.split(",")[0]?.trim() ?? "unknown";
    const machineIdValue = formData.get("machineId");
    rateLimitMachineId =
      machineIdValue && typeof machineIdValue === "string"
        ? machineIdValue
        : "none";
    const key = `public_issue:${rateLimitIp}:${rateLimitMachineId}`;
    const limiter = getInMemoryRateLimiter();
    if (!limiter.check(key, { windowMs: 60_000, max: 5 })) {
      console.warn("[RATE_LIMIT] Throttled anonymous issue creation", {
        ip: rateLimitIp,
        machineId: rateLimitMachineId,
        action: "createPublicIssue",
        limit: "5 per minute",
      });
      return actionError(
        "Too many submissions. Please wait a minute and try again.",
      );
    }
  } catch (error) {
    // Rate limiting is best-effort only. Failures are logged but don't block requests.
    // Possible failure scenarios:
    // - Header parsing errors (malformed X-Forwarded-For)
    // - Rate limiter initialization failures
    // - Memory pressure causing eviction failures
    // Rationale: Better to allow anonymous issue creation than block legitimate users
    // due to rate limiting infrastructure issues.
    console.error("[RATE_LIMIT] Rate limiting check failed (non-blocking)", {
      ip: rateLimitIp,
      machineId: rateLimitMachineId,
      action: "createPublicIssue",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  // Validate (priority/assignee will be ignored even if passed)
  const validation = validateFormData(formData, createIssueSchema);
  if (!validation.success) {
    if (validation.fieldErrors) {
      delete validation.fieldErrors["priority"];
      delete validation.fieldErrors["assigneeId"];
    }
    return validation as ActionResult<{ id: string }>;
  }
  const { machineId, title, description, severity } = validation.data;

  try {
    // =============================================================================
    // SECURITY MODEL: Manual Visibility Validation
    // =============================================================================
    // Server Actions use the global database provider (db from ~/lib/dal/shared)
    // which bypasses RLS (Row-Level Security). This differs from tRPC procedures
    // which use RLS-scoped clients that automatically enforce policies.
    //
    // We manually validate visibility here to mirror the RLS policies:
    // - machines_public_read policy (01-rls-policies.sql lines 317-345):
    //   Allows anon/authenticated users to read machines where is_public = true
    //   or inherits public status from location/organization
    // - organizations_context_read policy (01-rls-policies.sql lines 150-154):
    //   Allows anon users to read the current organization in context
    // - issues_public_read policy (01-rls-policies.sql lines 415-445):
    //   Allows anon users to read public issues with nested visibility checks
    //
    // This ensures anonymous users can only create issues for:
    // 1. Explicitly public machines (is_public = true)
    // 2. In organizations that allow anonymous reporting (allow_anonymous_issues = true)
    // 3. In organizations that are public (is_public = true)
    //
    // Why manual validation instead of RLS?
    // - Server Actions run with admin/service role credentials for performance
    // - RLS policies require per-request session context setup
    // - Manual validation provides clearer error messages for users
    // - Keeps validation logic co-located with the action for maintainability
    //
    // Related validations:
    // - createIssueAction (lines 116-249): Uses permission checks for members
    // - tRPC issueRouter: Uses RLS-scoped client for automatic policy enforcement
    // =============================================================================

    // Fetch machine with visibility flags
    const machineRecord = await getDb().query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: {
        id: true,
        organization_id: true,
        is_public: true,
      },
      with: {
        location: {
          columns: {
            id: true,
            organization_id: true,
            is_public: true,
          },
        },
        organization: {
          columns: {
            id: true,
            allow_anonymous_issues: true,
            is_public: true,
          },
        },
      },
    });
    if (!machineRecord) {
      return actionError("Machine not found");
    }

    const organizationRecord = machineRecord.organization;

    // Validate organization allows anonymous issue creation
    if (!organizationRecord.allow_anonymous_issues) {
      return actionError("Anonymous reporting disabled");
    }

    const machineVisible = calculateEffectiveMachineVisibility(
      { is_public: organizationRecord.is_public },
      { is_public: machineRecord.location.is_public },
      { is_public: machineRecord.is_public ?? null },
    );

    if (!machineVisible) {
      return actionError("Machine not available for public reporting");
    }

    // At public path we implicitly allow BASIC creation only (no priority / assignee fields honored)

    const organizationId = machineRecord.organization_id;
    const [defaultStatus, defaultPriority] = await Promise.all([
      getDefaultStatus(organizationId),
      getDefaultPriority(organizationId),
    ]);
    if (!defaultStatus || !defaultPriority)
      return actionError("Organization not fully configured for issues");

    const reporterEmailValue = formData.get("reporterEmail");
    const reporterNameValue = formData.get("reporterName");
    const reporterEmail =
      reporterEmailValue && typeof reporterEmailValue === "string"
        ? reporterEmailValue
        : null;
    const reporterName =
      reporterNameValue && typeof reporterNameValue === "string"
        ? reporterNameValue
        : null;

    const issueData = {
      id: generatePrefixedId("issue"),
      title,
      description: description ?? "",
      machineId,
      organizationId,
      statusId: defaultStatus.id,
      priorityId: defaultPriority.id,
      assigneeId: null,
      createdById: null,
      reporterType: "anonymous" as const,
      reporterEmail,
      submitterName: reporterName,
      severity,
    };

    // SAFE TYPE ASSERTION: transformKeysToSnakeCase is deterministic key transformation
    // - issueData object explicitly constructed with all required schema fields above (lines 397-411)
    // - Public creation validated via manual visibility checks (lines 352-374)
    // - Transformer only renames keys (camelCase → snake_case), preserves values
    // - TypeScript validates field types at object construction (line 397)
    // LIMITATION: If schema adds new required field without default, error occurs at runtime
    // MITIGATION: Integration tests validate all insert paths against live schema
    await getDb()
      .insert(issues)
      .values(
        transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert,
      );

    revalidatePath(`/machines/${machineId}`);
    revalidateTag("issues", "max");
    return actionSuccess({ id: issueData.id }, "Issue reported successfully");
  } catch (error) {
    console.error("createPublicIssueAction error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to submit issue",
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
  formData: FormData,
): Promise<ActionResult<{ statusId: string }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;

    // Enhanced validation
    const validation = validateFormData(formData, updateIssueStatusSchema);
    if (!validation.success) {
      return validation as ActionResult<{ statusId: string }>;
    }

    await requirePermission(
      { role_id: membership.role.id },
      PERMISSIONS.ISSUE_EDIT,
    );

    // Update with organization scoping for security
    const [updatedIssue] = await getDb()
      .update(issues)
      .set({ status_id: validation.data.statusId })
      .where(
        and(eq(issues.id, issueId), eq(issues.organization_id, organizationId)),
      )
      .returning({ status_id: issues.status_id });

    if (!updatedIssue) {
      return actionError("Issue not found or access denied");
    }

    // Granular cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath("/dashboard");
    revalidateTag("issues", "max");

    // Background processing
    runAfterResponse(async () => {
      console.log(`Issue ${issueId} status updated by ${user.email}`);

      // Generate notifications for status change
      try {
        // Get status name for notification message
        const statusResult = await getDb().query.issueStatuses.findFirst({
          where: eq(issueStatuses.id, validation.data.statusId),
          columns: { name: true },
        });

        if (statusResult) {
          await generateStatusChangeNotifications(issueId, statusResult.name, {
            organizationId,
            actorId: user.id,
            actorName: user.name ?? user.email,
          });
        }
      } catch (error) {
        console.error(
          "Failed to generate status change notifications:",
          getErrorMessage(error),
        );
      }
    });

    return actionSuccess(
      { statusId: updatedIssue.status_id },
      "Issue status updated successfully",
    );
  } catch (error) {
    console.error("Update issue status error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to update issue status",
    );
  }
}

/**
 * Add comment to issue via Server Action (React 19 useActionState compatible)
 */
export async function addCommentAction(
  issueId: string,
  _prevState: ActionResult<{ commentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ commentId: string }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;

    // Enhanced validation
    const validation = validateFormData(formData, addCommentSchema);
    if (!validation.success) {
      return validation as ActionResult<{ commentId: string }>;
    }

    await requirePermission(
      { role_id: membership.role.id },
      PERMISSIONS.ISSUE_CREATE_BASIC,
    );

    // Verify issue exists and user has access
    const issue = await getDb().query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, organizationId),
      ),
      columns: { id: true },
    });

    if (!issue) {
      return actionError("Issue not found or access denied");
    }

    // Create comment
    const commentData = {
      id: generatePrefixedId("comment"),
      content: validation.data.content,
      issue_id: issueId,
      author_id: user.id,
      organization_id: organizationId,
    };

    await getDb().insert(comments).values(commentData);

    // Cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidateTag("issues", "max");
    revalidateTag(`comments-${issueId}`, "max");

    // Background processing
    runAfterResponse(() => {
      console.log(`Comment added to issue ${issueId} by ${user.email}`);
      return Promise.resolve();
    });

    return actionSuccess(
      { commentId: commentData.id },
      "Comment added successfully",
    );
  } catch (error) {
    console.error("Add comment error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to add comment",
    );
  }
}

/**
 * Update issue assignment via Server Action (React 19 useActionState compatible)
 */
export async function updateIssueAssignmentAction(
  issueId: string,
  _prevState: ActionResult<{ assigneeId: string | null }> | null,
  formData: FormData,
): Promise<ActionResult<{ assigneeId: string | null }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;

    // Enhanced validation
    const validation = validateFormData(formData, updateIssueAssignmentSchema);
    if (!validation.success) {
      return validation as ActionResult<{ assigneeId: string | null }>;
    }

    await requirePermission(
      { role_id: membership.role.id },
      PERMISSIONS.ISSUE_EDIT,
    ); // was ISSUE_ASSIGN (deprecated)

    // Get current assignee for notification comparison
    const currentIssue = await getDb().query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, organizationId),
      ),
      columns: { assigned_to_id: true },
    });

    const previousAssigneeId = currentIssue?.assigned_to_id ?? null;

    // Handle special "unassigned" case
    const assigneeId =
      validation.data.assigneeId === "unassigned"
        ? null
        : (validation.data.assigneeId ?? null);

    // Update assignment with organization scoping
    const [updatedIssue] = await getDb()
      .update(issues)
      .set({ assigned_to_id: assigneeId })
      .where(
        and(eq(issues.id, issueId), eq(issues.organization_id, organizationId)),
      )
      .returning({ assigned_to_id: issues.assigned_to_id });

    if (!updatedIssue) {
      return actionError("Issue not found or access denied");
    }

    // Cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath("/dashboard");
    revalidateTag("issues", "max");

    // Background processing
    runAfterResponse(async () => {
      console.log(`Issue ${issueId} assignment updated by ${user.email}`);

      // Generate notifications for assignment change
      try {
        await generateAssignmentNotifications(
          issueId,
          assigneeId,
          previousAssigneeId,
          {
            organizationId,
            actorId: user.id,
            actorName: user.name ?? user.email,
          },
        );
      } catch (error) {
        console.error(
          "Failed to generate assignment change notifications:",
          getErrorMessage(error),
        );
      }
    });

    return actionSuccess(
      { assigneeId: updatedIssue.assigned_to_id },
      "Issue assignment updated successfully",
    );
  } catch (error) {
    console.error("Update issue assignment error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to update assignment",
    );
  }
}

/**
 * Bulk update issues via Server Action (React 19 useActionState compatible)
 */
export async function bulkUpdateIssuesAction(
  _prevState: ActionResult<{ updatedCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;

    // Parse JSON data from form
    const jsonData = formData.get("data");
    if (!jsonData || typeof jsonData !== "string") {
      return actionError("No data provided for bulk update");
    }

    const data: unknown = JSON.parse(jsonData);
    const validation = bulkUpdateIssuesSchema.safeParse(data);
    if (!validation.success) {
      return actionError("Invalid bulk update data");
    }

    await requirePermission(
      { role_id: membership.role.id },
      PERMISSIONS.ISSUE_EDIT,
    ); // was ISSUE_BULK_MANAGE (deprecated)
    const { issueIds, statusId, assigneeId } = validation.data;

    // Build update object
    const updateData: Partial<typeof issues.$inferInsert> = {};
    if (statusId) updateData.status_id = statusId;
    if (assigneeId !== undefined) updateData.assigned_to_id = assigneeId;

    if (Object.keys(updateData).length === 0) {
      return actionError("No updates specified");
    }

    // Bulk update with organization scoping
    const updatedIssues = await getDb()
      .update(issues)
      .set(updateData)
      .where(
        and(
          eq(issues.organization_id, organizationId),
          inArray(issues.id, issueIds),
        ),
      )
      .returning({ id: issues.id });

    // Cache invalidation
    revalidatePath("/issues");
    revalidatePath("/dashboard");
    revalidateTag("issues", "max");

    // Background processing
    runAfterResponse(() => {
      console.log(
        `Bulk updated ${String(updatedIssues.length)} issues by ${user.email}`,
      );
      return Promise.resolve();
    });

    return actionSuccess(
      { updatedCount: updatedIssues.length },
      `Successfully updated ${String(updatedIssues.length)} issue${updatedIssues.length !== 1 ? "s" : ""}`,
    );
  } catch (error) {
    console.error("Bulk update issues error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to bulk update issues",
    );
  }
}
