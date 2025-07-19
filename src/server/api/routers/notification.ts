import { z } from "zod";
import { type Notification } from "@prisma/client";

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
    .query(async ({ ctx, input }): Promise<Notification[]> => {
      const service = ctx.services.createNotificationService();
      return service.getUserNotifications(ctx.session.user.id, input);
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }): Promise<number> => {
    const service = ctx.services.createNotificationService();
    return service.getUnreadCount(ctx.session.user.id);
  }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      const service = ctx.services.createNotificationService();
      await service.markAsRead(input.notificationId, ctx.session.user.id);
      return { success: true };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(
    async ({ ctx }): Promise<{ success: boolean }> => {
      const service = ctx.services.createNotificationService();
      await service.markAllAsRead(ctx.session.user.id);
      return { success: true };
    },
  ),
});
