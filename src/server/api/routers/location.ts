import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";

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
        _count: {
          select: {
            gameInstances: true,
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
});
