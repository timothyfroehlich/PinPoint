import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteWhereInputSchema } from "../inputTypeSchemas/UpvoteWhereInputSchema";
import { UpvoteOrderByWithAggregationInputSchema } from "../inputTypeSchemas/UpvoteOrderByWithAggregationInputSchema";
import { UpvoteScalarFieldEnumSchema } from "../inputTypeSchemas/UpvoteScalarFieldEnumSchema";
import { UpvoteScalarWhereWithAggregatesInputSchema } from "../inputTypeSchemas/UpvoteScalarWhereWithAggregatesInputSchema";

export const UpvoteGroupByArgsSchema: z.ZodType<Prisma.UpvoteGroupByArgs> = z
  .object({
    where: UpvoteWhereInputSchema.optional(),
    orderBy: z
      .union([
        UpvoteOrderByWithAggregationInputSchema.array(),
        UpvoteOrderByWithAggregationInputSchema,
      ])
      .optional(),
    by: UpvoteScalarFieldEnumSchema.array(),
    having: UpvoteScalarWhereWithAggregatesInputSchema.optional(),
    take: z.number().optional(),
    skip: z.number().optional(),
  })
  .strict() as z.ZodType<Prisma.UpvoteGroupByArgs>;

export default UpvoteGroupByArgsSchema;
