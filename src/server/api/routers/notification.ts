import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const notificationRouter = createTRPCRouter({
  // Get user's notifications
  getNotifications: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      return service.getUserNotifications(ctx.user.id, options);
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.createNotificationService();
    return service.getUnreadCount(ctx.user.id);
  }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.createNotificationService();
      await service.markAsRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const service = ctx.services.createNotificationService();
    await service.markAllAsRead(ctx.user.id);
    return { success: true };
  }),
});
