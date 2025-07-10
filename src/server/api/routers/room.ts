import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  adminProcedure,
} from "~/server/api/trpc";

export const roomRouter = createTRPCRouter({
  // Get all rooms for an organization
  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.room.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            gameInstances: true,
          },
        },
      },
      orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
    });
  }),

  // Get rooms by location
  getByLocation: organizationProcedure
    .input(z.object({ locationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.room.findMany({
        where: {
          locationId: input.locationId,
          organizationId: ctx.organization.id,
        },
        include: {
          _count: {
            select: {
              gameInstances: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Admin-only: Update room description
  updateDescription: adminProcedure
    .input(
      z.object({
        roomId: z.string(),
        description: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.room.update({
        where: {
          id: input.roomId,
          organizationId: ctx.organization.id,
        },
        data: {
          description: input.description,
        },
      });
    }),

  // Admin-only: Create new room
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().nullable(),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.room.create({
        data: {
          name: input.name,
          description: input.description,
          locationId: input.locationId,
          organizationId: ctx.organization.id,
        },
      });
    }),
});
