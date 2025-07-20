import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionWhereInputSchema } from "../inputTypeSchemas/CollectionWhereInputSchema";
import { CollectionOrderByWithRelationInputSchema } from "../inputTypeSchemas/CollectionOrderByWithRelationInputSchema";
import { CollectionWhereUniqueInputSchema } from "../inputTypeSchemas/CollectionWhereUniqueInputSchema";

export const CollectionAggregateArgsSchema: z.ZodType<Prisma.CollectionAggregateArgs> =
  z
    .object({
      where: CollectionWhereInputSchema.optional(),
      orderBy: z
        .union([
          CollectionOrderByWithRelationInputSchema.array(),
          CollectionOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: CollectionWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionAggregateArgs>;

export default CollectionAggregateArgsSchema;
