import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  organizationProcedure,
  locationEditProcedure,
  locationDeleteProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const locationRouter = createTRPCRouter({
  create: locationEditProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.location.create({
        data: {
          name: input.name,
          organizationId: ctx.organization.id,
        },
      });
    }),

  getAll: organizationProcedure.query(({ ctx }) => {
    return ctx.db.location.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      include: {
        machines: {
          include: {
            _count: {
              select: {
                issues: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  // Public endpoint for unified dashboard - no authentication required
  getPublic: publicProcedure.query(({ ctx }) => {
    if (!ctx.organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    return ctx.db.location.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            machines: true,
          },
        },
        machines: {
          select: {
            id: true,
            name: true,
            model: {
              select: {
                name: true,
                manufacturer: true,
              },
            },
            _count: {
              select: {
                issues: {
                  where: {
                    status: {
                      category: {
                        not: "RESOLVED",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  update: locationEditProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.location.update({
        where: {
          id: input.id,
          organizationId: ctx.organization.id, // Ensure user can only update their org's locations
        },
        data: {
          ...(input.name && { name: input.name }),
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
          machines: {
            include: {
              model: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      if (!location) {
        throw new Error("Location not found");
      }

      return location;
    }),

  delete: locationDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.location.delete({
        where: {
          id: input.id,
          organizationId: ctx.organization.id, // Ensure user can only delete their org's locations
        },
      });
    }),

  // Admin-only PinballMap sync operations
  setPinballMapId: organizationManageProcedure
    .input(
      z.object({
        locationId: z.string(),
        pinballMapId: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) => {
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

  syncWithPinballMap: organizationManageProcedure
    .input(z.object({ locationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pinballMapService = ctx.services.createPinballMapService();
      const result = await pinballMapService.syncLocation(input.locationId);

      if (!result.success) {
        throw new Error(result.error ?? "Sync failed");
      }

      return result;
    }),
});
