/**
 * Administrative Server Actions (2025 Performance Patterns)
 * Form handling and mutations for admin operations with React 19 cache API
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { emailSchema, uuidSchema } from "~/lib/validation/schemas";
import { eq, and } from "drizzle-orm";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { users, memberships, roles } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { updateSystemSettings } from "~/lib/dal/system-settings";
import {
  logActivity,
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
  exportActivityLog,
} from "~/lib/dal/activity-log";
import {
  requireAuthContextWithRole,
  validateFormData,
  actionSuccess,
  actionError,
  runAfterResponse,
  type ActionResult,
} from "./shared";
import { requirePermission } from "./shared";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
// Removed unused getDB alias import

// Enhanced validation schemas with better error messages
const inviteUserSchema = z.object({
  email: emailSchema.transform((s) => s.toLowerCase()),
  name: z.string().max(100, "Name must be less than 100 characters").optional(),
  roleId: uuidSchema.optional(),
  message: z
    .string()
    .max(500, "Message must be less than 500 characters")
    .optional(),
});

const updateUserRoleSchema = z.object({
  userId: uuidSchema,
  roleId: uuidSchema,
});

const removeUserSchema = z.object({
  userId: uuidSchema,
  confirmEmail: emailSchema,
});

const updateSystemSettingsSchema = z.object({
  settings: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    issueUpdates: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    maintenanceAlerts: z.boolean().optional(),
    twoFactorRequired: z.boolean().optional(),
    sessionTimeout: z.number().int().min(0).max(1440).optional(),
    passwordMinLength: z.number().int().min(6).max(128).optional(),
    loginAttempts: z.number().int().min(0).max(10).optional(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    language: z.string().optional(),
    itemsPerPage: z.number().int().min(10).max(100).optional(),
  }),
});

/**
 * Invite user to organization via Server Action (React 19 useActionState compatible)
 * Enhanced with validation and background processing
 */
export async function inviteUserAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Enhanced validation with Zod
    const validation = validateFormData(formData, inviteUserSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.USER_MANAGE, db);

    // Check if user already exists in the system
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validation.data.email),
    });

    if (existingUser) {
      // Check if user is already a member of this organization
      const existingMembership = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.user_id, existingUser.id),
          eq(memberships.organization_id, organizationId),
        ),
      });

      if (existingMembership) {
        return actionError("User is already a member of this organization");
      }
    }

    // Get default role if none specified
    let roleId = validation.data.roleId;
    if (!roleId) {
      const defaultRole = await db.query.roles.findFirst({
        where: and(
          eq(roles.organization_id, organizationId),
          eq(roles.is_default, true),
        ),
      });

      if (!defaultRole) {
        return actionError(
          "No default role configured. Please contact support.",
        );
      }

      roleId = defaultRole.id;
    }

    // Create user record if they don't exist
    let userId = existingUser?.id;
    if (!existingUser) {
      // Create a new user record with unverified email
      const newUser = await db
        .insert(users)
        .values({
          id: generatePrefixedId("user"),
          email: validation.data.email,
          name: validation.data.name || null,
          email_verified: null, // Email not verified until they complete signup
        })
        .returning({ id: users.id });

      userId = newUser[0]?.id;
      if (!userId) {
        return actionError("Failed to create user record");
      }
    }

    // Type guard to ensure userId is defined
    if (!userId) {
      return actionError("User ID not available");
    }

    // Create membership for the user
    const [newMembership] = await db
      .insert(memberships)
      .values({
        id: generatePrefixedId("membership"),
        user_id: userId,
        organization_id: organizationId,
        role_id: roleId,
      })
      .returning({ id: memberships.id });

    if (!newMembership) {
      return actionError("Failed to create user membership");
    }

    console.log("User invitation processed:", {
      email: validation.data.email,
      userId,
      organizationId,
      roleId,
      membershipId: newMembership.id,
    });

    // Cache invalidation
    revalidatePath("/settings/users");
    revalidatePath("/settings");
    revalidateTag("admin");
    revalidateTag("users");

    // Background processing
    runAfterResponse(async () => {
      console.log(
        `User invitation processed for ${validation.data.email} by ${user.email}`,
        {
          userId,
          membershipId: newMembership.id,
          organizationId,
          roleId,
        },
      );

      // Log the activity
      await logActivity({
        organizationId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.INVITATION_SENT,
        entity: ACTIVITY_ENTITIES.USER,
        entityId: userId,
        details: `Invited ${validation.data.email} to join the organization`,
        severity: "info",
      });

      // TODO: Send actual invitation email with signup/login link
      // The email should include:
      // - Welcome message with personal note if provided
      // - Link to complete account setup (for new users)
      // - Link to login and accept invitation (for existing users)
      // - Organization details and role information
      //
      // Example implementation:
      // await sendInvitationEmail({
      //   to: validation.data.email,
      //   userExists: !!existingUser,
      //   organizationName: organization.name,
      //   organizationId,
      //   inviterName: user.name || user.email,
      //   roleName: role.name,
      //   personalMessage: validation.data.message,
      //   signupUrl: existingUser
      //     ? `${baseUrl}/auth/sign-in?invitation=${invitationToken}`
      //     : `${baseUrl}/auth/sign-up?invitation=${invitationToken}`,
      // });
    });

    return actionSuccess(
      { success: true },
      "User invitation sent successfully",
    );
  } catch (error) {
    console.error("Invite user error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to send invitation. Please try again.",
    );
  }
}

/**
 * Update user role via Server Action (React 19 useActionState compatible)
 */
export async function updateUserRoleAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Enhanced validation
    const validation = validateFormData(formData, updateUserRoleSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.USER_MANAGE, db);

    // Verify role exists in this organization
    const role = await db.query.roles.findFirst({
      where: and(
        eq(roles.id, validation.data.roleId),
        eq(roles.organization_id, organizationId),
      ),
    });

    if (!role) {
      return actionError("Role not found or access denied");
    }

    // Update user role (membership)
    const [updatedMembership] = await db
      .update(memberships)
      .set({ role_id: validation.data.roleId })
      .where(
        and(
          eq(memberships.user_id, validation.data.userId),
          eq(memberships.organization_id, organizationId),
        ),
      )
      .returning({ user_id: memberships.user_id });

    if (!updatedMembership) {
      return actionError("User not found or access denied");
    }

    // Cache invalidation
    revalidatePath("/settings/users");
    revalidatePath("/settings/roles");
    revalidateTag("admin");
    revalidateTag("users");

    // Background processing
    runAfterResponse(async () => {
      console.log(
        `User role updated by ${user.email}: ${validation.data.userId} -> ${role.name}`,
      );

      // Log the activity
      await logActivity({
        organizationId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.ROLE_CHANGED,
        entity: ACTIVITY_ENTITIES.USER,
        entityId: validation.data.userId,
        details: `Changed user role to ${role.name}`,
        severity: "warning",
      });
    });

    return actionSuccess(
      { success: true },
      `User role updated to ${role.name}`,
    );
  } catch (error) {
    console.error("Update user role error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to update user role",
    );
  }
}

/**
 * Remove user from organization via Server Action (React 19 useActionState compatible)
 */
export async function removeUserAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Enhanced validation
    const validation = validateFormData(formData, removeUserSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.USER_MANAGE, db);

    // Verify user exists and email matches (safety check)
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, validation.data.userId),
      columns: { id: true, email: true },
    });

    if (!targetUser || targetUser.email !== validation.data.confirmEmail) {
      return actionError("User not found or email confirmation doesn't match");
    }

    // Remove membership (soft delete would be better for audit trail)
    const [removedMembership] = await db
      .delete(memberships)
      .where(
        and(
          eq(memberships.user_id, validation.data.userId),
          eq(memberships.organization_id, organizationId),
        ),
      )
      .returning({ user_id: memberships.user_id });

    if (!removedMembership) {
      return actionError("User not found in this organization");
    }

    // Cache invalidation
    revalidatePath("/settings/users");
    revalidateTag("admin");
    revalidateTag("users");

    // Background processing
    runAfterResponse(async () => {
      console.log(
        `User removed from organization by ${user.email}: ${validation.data.confirmEmail}`,
      );

      // Log the activity
      await logActivity({
        organizationId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.USER_DELETED,
        entity: ACTIVITY_ENTITIES.USER,
        entityId: validation.data.userId,
        details: `Removed user ${validation.data.confirmEmail} from organization`,
        severity: "warning",
      });
    });

    return actionSuccess(
      { success: true },
      "User removed from organization successfully",
    );
  } catch (error) {
    console.error("Remove user error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to remove user",
    );
  }
}

/**
 * Update system settings via Server Action (React 19 useActionState compatible)
 */
export async function updateSystemSettingsAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Parse JSON data from form
    const settingsData = formData.get("settings") as string;
    if (!settingsData) {
      return actionError("No settings data provided");
    }

    const data = JSON.parse(settingsData);
    const validation = updateSystemSettingsSchema.safeParse({ settings: data });

    if (!validation.success) {
      return actionError("Invalid settings data");
    }

    // Permission check for settings update
    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.ORGANIZATION_MANAGE, db);

    // Update system settings in database
    // TODO: Fix type mismatch between flat form schema and nested SystemSettingsData interface
    await updateSystemSettings(organizationId, validation.data.settings as any);

    // Cache invalidation
    revalidatePath("/settings/system");
    revalidatePath("/settings");
    revalidateTag("admin");
    revalidateTag("settings");

    // Background processing
    runAfterResponse(async () => {
      console.log(`System settings updated by ${user.email}`);

      // Log the activity
      await logActivity({
        organizationId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.SETTINGS_UPDATED,
        entity: ACTIVITY_ENTITIES.SETTINGS,
        entityId: "system-settings",
        details: `Updated system settings: ${Object.keys(validation.data.settings).join(", ")}`,
        severity: "info",
      });
    });

    return actionSuccess(
      { success: true },
      "System settings updated successfully",
    );
  } catch (error) {
    console.error("Update system settings error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to update system settings",
    );
  }
}

/**
 * Export activity log to CSV via Server Action
 */
export async function exportActivityLogAction(): Promise<Response> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.ADMIN_VIEW_ANALYTICS, db);

    // Export activity log to CSV
    const csvData = await exportActivityLog(organizationId, {
      // Export all data with reasonable limit
      limit: 10000,
    });

    // Log the export activity
    await logActivity({
      organizationId,
      userId: user.id,
      action: ACTIVITY_ACTIONS.EXPORT_GENERATED,
      entity: ACTIVITY_ENTITIES.EXPORT,
      entityId: "activity-log-csv",
      details: "Exported activity log to CSV file",
      severity: "info",
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `activity-log-${timestamp}.csv`;

    // Return CSV file response
    return new Response(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export activity log error:", error);

    // Return error response
    return new Response("Failed to export activity log", {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}
