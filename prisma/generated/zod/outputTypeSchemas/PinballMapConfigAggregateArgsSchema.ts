import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PinballMapConfigWhereInputSchema } from "../inputTypeSchemas/PinballMapConfigWhereInputSchema";
import { PinballMapConfigOrderByWithRelationInputSchema } from "../inputTypeSchemas/PinballMapConfigOrderByWithRelationInputSchema";
import { PinballMapConfigWhereUniqueInputSchema } from "../inputTypeSchemas/PinballMapConfigWhereUniqueInputSchema";

export const PinballMapConfigAggregateArgsSchema: z.ZodType<Prisma.PinballMapConfigAggregateArgs> =
  z
    .object({
      where: PinballMapConfigWhereInputSchema.optional(),
      orderBy: z
        .union([
          PinballMapConfigOrderByWithRelationInputSchema.array(),
          PinballMapConfigOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: PinballMapConfigWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigAggregateArgs>;

export default PinballMapConfigAggregateArgsSchema;
