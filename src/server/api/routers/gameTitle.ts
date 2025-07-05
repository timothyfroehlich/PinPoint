import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";

export const gameTitleRouter = createTRPCRouter({
  create: organizationProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gameTitle.create({
        data: {
          name: input.name,
          organizationId: ctx.organization.id,
        },
      });
    }),

  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.gameTitle.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      orderBy: { name: "asc" },
    });
  }),
});
