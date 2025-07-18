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
        name: z.string().min(1, "Name is required"),
        modelId: z.string(),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify that the model and room belong to the same organization
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const model = await ctx.db.model.findFirst({
        where: {
          id: input.modelId,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const location = await ctx.db.location.findFirst({
        where: {
          id: input.locationId,
          organizationId: ctx.organization.id,
        },
      });

      if (!model || !location) {
        throw new Error("Invalid game title or location");
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const machine = await ctx.db.machine.create({
        data: {
          name: input.name,
          modelId: input.modelId,
          locationId: input.locationId,
          organizationId: ctx.organization.id,
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
          location: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      // Auto-generate QR code for the new machine
      try {
        const qrCodeService = ctx.services.createQRCodeService();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        await qrCodeService.generateQRCode(machine.id);
      } catch (error) {
        // Log error but don't fail machine creation
        console.warn(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
          `Failed to generate QR code for machine ${machine.id}:`,
          error,
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return machine;
    }),

  getAll: organizationProcedure.query(({ ctx }) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return ctx.db.machine.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      include: {
        model: true,
        location: true,
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { model: { name: "asc" } },
    });
  }),

  // Public endpoint for issue reporting - returns minimal data needed for issue form
  getAllForIssues: publicProcedure.query(({ ctx }) => {
    // Use the organization resolved from subdomain context
    const organization = ctx.organization;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return ctx.db.machine.findMany({
      where: {
        organizationId: organization.id,
      },
      select: {
        id: true,
        model: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { model: { name: "asc" } },
    });
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const machine = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
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
          location: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      if (!machine) {
        throw new Error("Game instance not found");
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return machine;
    }),

  update: machineEditProcedure
    .input(
      z.object({
        id: z.string(),
        modelId: z.string().optional(),
        locationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the game instance belongs to this organization
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const existingInstance = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      // If updating model or location, verify they belong to the organization
      if (input.modelId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const model = await ctx.db.model.findFirst({
          where: {
            id: input.modelId,
          },
        });
        if (!model) {
          throw new Error("Invalid game title");
        }
      }

      if (input.locationId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return ctx.db.machine.update({
        where: { id: input.id },
        data: {
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
          location: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });
    }),

  delete: machineDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance belongs to this organization
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const existingInstance = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return ctx.db.machine.delete({
        where: { id: input.id },
      });
    }),
});
