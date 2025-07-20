import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteWhereInputSchema } from "../inputTypeSchemas/UpvoteWhereInputSchema";

export const UpvoteDeleteManyArgsSchema: z.ZodType<Prisma.UpvoteDeleteManyArgs> =
  z
    .object({
      where: UpvoteWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteDeleteManyArgs>;

export default UpvoteDeleteManyArgsSchema;
