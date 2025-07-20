import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PriorityWhereInputSchema } from "../inputTypeSchemas/PriorityWhereInputSchema";
import { PriorityOrderByWithAggregationInputSchema } from "../inputTypeSchemas/PriorityOrderByWithAggregationInputSchema";
import { PriorityScalarFieldEnumSchema } from "../inputTypeSchemas/PriorityScalarFieldEnumSchema";
import { PriorityScalarWhereWithAggregatesInputSchema } from "../inputTypeSchemas/PriorityScalarWhereWithAggregatesInputSchema";

export const PriorityGroupByArgsSchema: z.ZodType<Prisma.PriorityGroupByArgs> =
  z
    .object({
      where: PriorityWhereInputSchema.optional(),
      orderBy: z
        .union([
          PriorityOrderByWithAggregationInputSchema.array(),
          PriorityOrderByWithAggregationInputSchema,
        ])
        .optional(),
      by: PriorityScalarFieldEnumSchema.array(),
      having: PriorityScalarWhereWithAggregatesInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityGroupByArgs>;

export default PriorityGroupByArgsSchema;
