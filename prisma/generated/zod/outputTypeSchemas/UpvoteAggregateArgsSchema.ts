import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteWhereInputSchema } from "../inputTypeSchemas/UpvoteWhereInputSchema";
import { UpvoteOrderByWithRelationInputSchema } from "../inputTypeSchemas/UpvoteOrderByWithRelationInputSchema";
import { UpvoteWhereUniqueInputSchema } from "../inputTypeSchemas/UpvoteWhereUniqueInputSchema";

export const UpvoteAggregateArgsSchema: z.ZodType<Prisma.UpvoteAggregateArgs> =
  z
    .object({
      where: UpvoteWhereInputSchema.optional(),
      orderBy: z
        .union([
          UpvoteOrderByWithRelationInputSchema.array(),
          UpvoteOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: UpvoteWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteAggregateArgs>;

export default UpvoteAggregateArgsSchema;
