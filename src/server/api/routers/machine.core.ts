import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  machineEditProcedure,
  machineDeleteProcedure,
} from "~/server/api/trpc";

export const machineCoreRouter = createTRPCRouter({
  create: machineEditProcedure
    .input(
      z.object({
        name: z.string().min(1),
        modelId: z.string(),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify that the model and room belong to the same organization
      const model = await ctx.db.model.findFirst({
        where: {
          id: input.modelId,
          OR: [
            { organizationId: ctx.organization.id }, // Organization-specific games
            { organizationId: null }, // Global OPDB games
          ],
        },
      });

      const room = await ctx.db.room.findFirst({
        where: {
          id: input.locationId,
          organizationId: ctx.organization.id,
        },
      });

      if (!model || !room) {
        throw new Error("Invalid game title or room");
      }

      return ctx.db.machine.create({
        data: {
          name: input.name,
          modelId: input.modelId,
          locationId: input.locationId,
        },
        include: {
          model: {
            include: {
              _count: {
                select: {
                  machines: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
    }),

  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.machine.findMany({
      where: {
        room: {
          organizationId: ctx.organization.id,
        },
      },
      include: {
        model: {
          include: {
            _count: {
              select: {
                machines: true,
              },
            },
          },
        },
        room: {
          include: {
            location: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  // Public endpoint for issue reporting - returns minimal data needed for issue form
  getAllForIssues: publicProcedure.query(async ({ ctx }) => {
    // Use the organization resolved from subdomain context
    const organization = ctx.organization;

    return ctx.db.machine.findMany({
      where: {
        room: {
          organizationId: organization.id,
        },
      },
      select: {
        id: true,
        name: true,
        model: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const machine = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          room: {
            organizationId: ctx.organization.id,
          },
        },
        include: {
          model: {
            include: {
              _count: {
                select: {
                  machines: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });

      if (!machine) {
        throw new Error("Game instance not found");
      }

      return machine;
    }),

  update: machineEditProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        modelId: z.string().optional(),
        locationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the game instance belongs to this organization
      const existingInstance = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          room: {
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      // If updating model or location, verify they belong to the organization
      if (input.modelId) {
        const model = await ctx.db.model.findFirst({
          where: {
            id: input.modelId,
            organizationId: ctx.organization.id,
          },
        });
        if (!model) {
          throw new Error("Invalid game title");
        }
      }

      if (input.locationId) {
        const location = await ctx.db.location.findFirst({
          where: {
            id: input.locationId,
            organizationId: ctx.organization.id,
          },
        });
        if (!location) {
          throw new Error("Invalid location");
        }
      }

      return ctx.db.machine.update({
        where: { id: input.id },
        data: {
          name: input.name,
          ...(input.modelId && { modelId: input.modelId }),
          ...(input.locationId && { locationId: input.locationId }),
        },
        include: {
          model: {
            include: {
              _count: {
                select: {
                  machines: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
    }),

  delete: machineDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance belongs to this organization
      const existingInstance = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          room: {
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      return ctx.db.machine.delete({
        where: { id: input.id },
      });
    }),
});
