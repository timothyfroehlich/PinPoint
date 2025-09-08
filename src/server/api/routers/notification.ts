// External libraries (alphabetical)
import { z } from "zod";
import { notificationPaginationSchema } from "~/lib/validation/schemas";

// Internal types (alphabetical)
import type {
  NotificationResponse,
  UnreadCountResponse,
} from "~/lib/types/api";

// Internal utilities (alphabetical)
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";

// Server modules (alphabetical)
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const notificationRouter = createTRPCRouter({
  // Get user's notifications
  getNotifications: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().optional(),
        ...notificationPaginationSchema.shape,
      }),
    )
    .query(async ({ ctx, input }): Promise<NotificationResponse[]> => {
      const service = ctx.services.createNotificationService();

      // Build options object to avoid exactOptionalPropertyTypes issues
      const options: {
        unreadOnly?: boolean;
        limit?: number;
        offset?: number;
      } = {};

      if (input.unreadOnly !== undefined) {
        options.unreadOnly = input.unreadOnly;
      }
      if (input.limit !== undefined) {
        options.limit = input.limit;
      }
      if (input.offset !== undefined) {
        options.offset = input.offset;
      }

      const notifications = await service.getUserNotifications(
        ctx.user.id,
        options,
      );
      return transformKeysToCamelCase(notifications) as NotificationResponse[];
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(
    async ({ ctx }): Promise<UnreadCountResponse> => {
      const service = ctx.services.createNotificationService();
      const count = await service.getUnreadCount(ctx.user.id);
      return { count };
    },
  ),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      const service = ctx.services.createNotificationService();
      await service.markAsRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(
    async ({ ctx }): Promise<{ success: boolean }> => {
      const service = ctx.services.createNotificationService();
      await service.markAllAsRead(ctx.user.id);
      return { success: true };
    },
  ),
});
