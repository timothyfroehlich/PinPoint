/**
 * Notification Server Actions (2025 Performance Patterns)
 * Form handling and mutations for notification management with React 19 cache API
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { notifications } from "~/server/db/schema";
import { db } from "~/lib/dal/shared";
import {
  requireAuthContextWithRole,
  validateFormData,
  actionSuccess,
  actionError,
  runAfterResponse,
  type ActionResult,
} from "./shared";

// Validation schemas
const markAsReadSchema = z.object({
  notificationId: z
    .string()
    .refine(
      (val) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          val,
        ),
      { message: "Invalid notification ID" },
    ),
});

const bulkMarkAsReadSchema = z.object({
  notificationIds: z
    .array(
      z
        .string()
        .refine(
          (val) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              val,
            ),
          { message: "Invalid notification ID" },
        ),
    )
    .min(1, "No notifications selected")
    .max(50, "Cannot update more than 50 notifications at once"),
});

const markAllAsReadSchema = z.object({
  confirm: z.literal("true", { message: "Confirmation required" }),
});

/**
 * Mark single notification as read via Server Action (React 19 useActionState compatible)
 */
export async function markNotificationAsReadAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId } = await requireAuthContextWithRole();

    // Enhanced validation
    const validation = validateFormData(formData, markAsReadSchema);
    if (!validation.success) {
      return validation;
    }

    // Update notification with proper access control
    const [updatedNotification] = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, validation.data.notificationId),
          eq(notifications.user_id, user.id),
          eq(notifications.organization_id, organizationId),
        ),
      )
      .returning({ id: notifications.id });

    if (!updatedNotification) {
      return actionError("Notification not found or access denied");
    }

    // Granular cache invalidation
    revalidatePath("/notifications");
    revalidateTag(`notifications-${user.id}`);
    revalidateTag(`notification-count-${user.id}`);

    // Background processing
    runAfterResponse(() => {
      console.log(
        `Notification ${validation.data.notificationId} marked as read by ${user.email ?? "unknown"}`,
      );
      return Promise.resolve();
    });

    return actionSuccess({ success: true }, "Notification marked as read");
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to mark notification as read",
    );
  }
}

/**
 * Mark multiple notifications as read via Server Action (React 19 useActionState compatible)
 */
export async function bulkMarkNotificationsAsReadAction(
  _prevState: ActionResult<{ updatedCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const { user, organizationId } = await requireAuthContextWithRole();

    // Parse JSON data from form with proper type safety
    const jsonData = formData.get("data");
    if (typeof jsonData !== "string") {
      return actionError("No data provided for bulk update");
    }

    let data: unknown;
    try {
      data = JSON.parse(jsonData);
    } catch {
      return actionError("Invalid JSON data provided");
    }
    const validation = bulkMarkAsReadSchema.safeParse(data);
    if (!validation.success) {
      return actionError("Invalid bulk update data");
    }

    const { notificationIds } = validation.data;

    // Bulk update with proper access control
    const updatedNotifications = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.user_id, user.id),
          eq(notifications.organization_id, organizationId),
          inArray(notifications.id, notificationIds),
          eq(notifications.read, false), // Only update unread notifications
        ),
      )
      .returning({ id: notifications.id });

    // Cache invalidation
    revalidatePath("/notifications");
    revalidateTag(`notifications-${user.id}`);
    revalidateTag(`notification-count-${user.id}`);

    // Background processing
    runAfterResponse(() => {
      console.log(
        `Bulk marked ${String(updatedNotifications.length)} notifications as read by ${user.email ?? "unknown"}`,
      );
      return Promise.resolve();
    });

    return actionSuccess(
      { updatedCount: updatedNotifications.length },
      `Successfully marked ${String(updatedNotifications.length)} notification${updatedNotifications.length !== 1 ? "s" : ""} as read`,
    );
  } catch (error) {
    console.error("Bulk mark notifications as read error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to bulk mark notifications as read",
    );
  }
}

/**
 * Mark all notifications as read via Server Action (React 19 useActionState compatible)
 */
export async function markAllNotificationsAsReadAction(
  _prevState: ActionResult<{ updatedCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const { user, organizationId } = await requireAuthContextWithRole();

    // Enhanced validation
    const validation = validateFormData(formData, markAllAsReadSchema);
    if (!validation.success) {
      return validation;
    }

    // Mark all unread notifications as read
    const updatedNotifications = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.user_id, user.id),
          eq(notifications.organization_id, organizationId),
          eq(notifications.read, false),
        ),
      )
      .returning({ id: notifications.id });

    // Cache invalidation
    revalidatePath("/notifications");
    revalidateTag(`notifications-${user.id}`);
    revalidateTag(`notification-count-${user.id}`);

    // Background processing
    runAfterResponse(() => {
      console.log(
        `All notifications marked as read by ${user.email ?? "unknown"} (${String(updatedNotifications.length)} notifications)`,
      );
      return Promise.resolve();
    });

    return actionSuccess(
      { updatedCount: updatedNotifications.length },
      `Successfully marked all ${String(updatedNotifications.length)} notification${updatedNotifications.length !== 1 ? "s" : ""} as read`,
    );
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to mark all notifications as read",
    );
  }
}

/**
 * Mark notification as unread (for testing or undo functionality)
 */
export async function markNotificationAsUnreadAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId } = await requireAuthContextWithRole();

    const validation = validateFormData(formData, markAsReadSchema);
    if (!validation.success) {
      return validation;
    }

    // Update notification with proper access control
    const [updatedNotification] = await db
      .update(notifications)
      .set({ read: false })
      .where(
        and(
          eq(notifications.id, validation.data.notificationId),
          eq(notifications.user_id, user.id),
          eq(notifications.organization_id, organizationId),
        ),
      )
      .returning({ id: notifications.id });

    if (!updatedNotification) {
      return actionError("Notification not found or access denied");
    }

    // Cache invalidation
    revalidatePath("/notifications");
    revalidateTag(`notifications-${user.id}`);
    revalidateTag(`notification-count-${user.id}`);

    // Background processing
    runAfterResponse(() => {
      console.log(
        `Notification ${validation.data.notificationId} marked as unread by ${user.email ?? "unknown"}`,
      );
      return Promise.resolve();
    });

    return actionSuccess({ success: true }, "Notification marked as unread");
  } catch (error) {
    console.error("Mark notification as unread error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to mark notification as unread",
    );
  }
}
