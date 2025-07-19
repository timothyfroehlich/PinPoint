import { z } from "zod";
import {
  type Location,
  type Machine,
  type Model,
  type User,
} from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  locationEditProcedure,
  locationDeleteProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { type LocationSyncResult } from "~/server/services/PinballMapService";

type LocationWithMachines = Location & {
  machines: (Machine & {
    _count: {
      issues: number;
    };
  })[];
};

type LocationWithDetailedMachines = Location & {
  machines: (Machine & {
    model: Model | null;
    owner: Pick<User, "id" | "name" | "image"> | null;
  })[];
};

export const locationRouter = createTRPCRouter({
  create: locationEditProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }): Promise<Location> => {
      return ctx.db.location.create({
        data: {
          name: input.name,
          organizationId: ctx.organization.id,
        },
      });
    }),

  getAll: organizationProcedure.query(
    ({ ctx }): Promise<LocationWithMachines[]> => {
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
    },
  ),

  update: locationEditProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(({ ctx, input }): Promise<Location> => {
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
    .query(async ({ ctx, input }): Promise<LocationWithDetailedMachines> => {
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

      return location as LocationWithDetailedMachines;
    }),

  delete: locationDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }): Promise<Location> => {
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
    .mutation(({ ctx, input }): Promise<Location> => {
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
    .mutation(async ({ ctx, input }): Promise<LocationSyncResult> => {
      const pinballMapService = ctx.services.createPinballMapService();
      const result = await pinballMapService.syncLocation(input.locationId);

      if (!result.success) {
        throw new Error(result.error ?? "Sync failed");
      }

      return result;
    }),
});
