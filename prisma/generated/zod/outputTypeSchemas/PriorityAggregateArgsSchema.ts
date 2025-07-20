import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PriorityWhereInputSchema } from "../inputTypeSchemas/PriorityWhereInputSchema";
import { PriorityOrderByWithRelationInputSchema } from "../inputTypeSchemas/PriorityOrderByWithRelationInputSchema";
import { PriorityWhereUniqueInputSchema } from "../inputTypeSchemas/PriorityWhereUniqueInputSchema";

export const PriorityAggregateArgsSchema: z.ZodType<Prisma.PriorityAggregateArgs> =
  z
    .object({
      where: PriorityWhereInputSchema.optional(),
      orderBy: z
        .union([
          PriorityOrderByWithRelationInputSchema.array(),
          PriorityOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: PriorityWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityAggregateArgs>;

export default PriorityAggregateArgsSchema;
