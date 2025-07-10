import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { syncLocationGames } from "~/server/services/pinballmapService";

export const locationRouter = createTRPCRouter({
  create: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.location.create({
        data: {
          name: input.name,
          notes: input.notes,
          organizationId: ctx.organization.id,
        },
      });
    }),

  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.location.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      include: {
        rooms: {
          include: {
            _count: {
              select: {
                gameInstances: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.location.update({
        where: {
          id: input.id,
          organizationId: ctx.organization.id, // Ensure user can only update their org's locations
        },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });
    }),

  // Get a single location with detailed info
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const location = await ctx.db.location.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          rooms: {
            include: {
              gameInstances: {
                include: {
                  gameTitle: true,
                  owner: {
                    select: {
                      id: true,
                      name: true,
                      profilePicture: true,
                    },
                  },
                },
                orderBy: { name: "asc" },
              },
              _count: {
                select: {
                  gameInstances: true,
                },
              },
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!location) {
        throw new Error("Location not found");
      }

      return location;
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.location.delete({
        where: {
          id: input.id,
          organizationId: ctx.organization.id, // Ensure user can only delete their org's locations
        },
      });
    }),

  // Admin-only PinballMap sync operations
  setPinballMapId: adminProcedure
    .input(
      z.object({
        locationId: z.string(),
        pinballMapId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.location.update({
        where: {
          id: input.locationId,
          organizationId: ctx.organization.id,
        },
        data: {
          pinballMapId: input.pinballMapId,
        },
      });
    }),

  syncWithPinballMap: adminProcedure
    .input(z.object({ locationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await syncLocationGames(ctx.db, input.locationId);

      if (!result.success) {
        throw new Error(result.error ?? "Sync failed");
      }

      return result;
    }),
});
