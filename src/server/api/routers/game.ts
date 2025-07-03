import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const gameRouter = createTRPCRouter({
  create: publicProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.game.create({
        data: {
          title: input.title,
        },
      });
    }),

  getAll: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.db.game.findMany({
        orderBy: { createdAt: "desc" },
      });
    }),
});