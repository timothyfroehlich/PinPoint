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
        OR: [
          // Custom games for this organization
          {
            organizationId: ctx.organization.id,
          },
          // Global OPDB games with instances in this organization
          {
            organizationId: null,
            machines: {
              some: {
                room: {
                  organizationId: ctx.organization.id,
                },
              },
            },
          },
        ],
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            machines: {
              where: {
                room: {
                  organizationId: ctx.organization.id,
                },
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
          OR: [
            // Custom games for this organization
            {
              organizationId: ctx.organization.id,
            },
            // Global OPDB games with instances in this organization
            {
              organizationId: null,
              machines: {
                some: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
                },
              },
            },
          ],
        },
        include: {
          _count: {
            select: {
              machines: {
                where: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
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
          OR: [
            // Custom games for this organization (can be deleted)
            {
              organizationId: ctx.organization.id,
            },
            // Global OPDB games (cannot be deleted, only instances can be removed)
            {
              organizationId: null,
              machines: {
                some: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
                },
              },
            },
          ],
        },
        include: {
          _count: {
            select: {
              machines: {
                where: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
                },
              },
            },
          },
        },
      });

      if (!model) {
        throw new Error("Game title not found");
      }

      // Don't allow deleting global OPDB games
      if (model.organizationId === null) {
        throw new Error(
          "Cannot delete global OPDB games. Remove game instances instead.",
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
