import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const modelCoreRouter = createTRPCRouter({
  // Enhanced getAll with OPDB metadata
  getAll: organizationProcedure.query(async ({ ctx }) => {
    // Get all game titles that are either:
    // 1. Custom games belonging to this organization
    // 2. Global OPDB games that have instances in this organization
    return ctx.db.model.findMany({
      where: {
        machines: {
          some: {
            organizationId: ctx.organization.id,
          },
        },
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            machines: {
              where: {
                organizationId: ctx.organization.id,
              },
            },
          },
        },
      },
    });
  }),

  // Get single game title by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const model = await ctx.db.model.findFirst({
        where: {
          id: input.id,
          machines: {
            some: {
              organizationId: ctx.organization.id,
            },
          },
        },
        include: {
          _count: {
            select: {
              machines: {
                where: {
                  organizationId: ctx.organization.id,
                },
              },
            },
          },
        },
      });

      if (!model) {
        throw new Error("Game title not found");
      }

      return model;
    }),

  // Delete game title (only if no game instances exist)
  delete: organizationManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the game title belongs to this organization or is a global OPDB game
      const model = await ctx.db.model.findFirst({
        where: {
          id: input.id,
          machines: {
            some: {
              organizationId: ctx.organization.id,
            },
          },
        },
        include: {
          _count: {
            select: {
              machines: {
                where: {
                  organizationId: ctx.organization.id,
                },
              },
            },
          },
        },
      });

      if (!model) {
        throw new Error("Game title not found");
      }

      if (model.isCustom) {
        throw new Error(
          "Cannot delete custom games. Remove game instances instead.",
        );
      }

      if (model._count.machines > 0) {
        throw new Error("Cannot delete game title that has game instances");
      }

      return ctx.db.model.delete({
        where: { id: input.id },
      });
    }),
});
