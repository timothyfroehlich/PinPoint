import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ModelWhereInputSchema } from "../inputTypeSchemas/ModelWhereInputSchema";
import { ModelOrderByWithRelationInputSchema } from "../inputTypeSchemas/ModelOrderByWithRelationInputSchema";
import { ModelWhereUniqueInputSchema } from "../inputTypeSchemas/ModelWhereUniqueInputSchema";

export const ModelAggregateArgsSchema: z.ZodType<Prisma.ModelAggregateArgs> = z
  .object({
    where: ModelWhereInputSchema.optional(),
    orderBy: z
      .union([
        ModelOrderByWithRelationInputSchema.array(),
        ModelOrderByWithRelationInputSchema,
      ])
      .optional(),
    cursor: ModelWhereUniqueInputSchema.optional(),
    take: z.number().optional(),
    skip: z.number().optional(),
  })
  .strict() as z.ZodType<Prisma.ModelAggregateArgs>;

export default ModelAggregateArgsSchema;
