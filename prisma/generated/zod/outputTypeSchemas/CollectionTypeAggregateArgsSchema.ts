import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionTypeWhereInputSchema } from "../inputTypeSchemas/CollectionTypeWhereInputSchema";
import { CollectionTypeOrderByWithRelationInputSchema } from "../inputTypeSchemas/CollectionTypeOrderByWithRelationInputSchema";
import { CollectionTypeWhereUniqueInputSchema } from "../inputTypeSchemas/CollectionTypeWhereUniqueInputSchema";

export const CollectionTypeAggregateArgsSchema: z.ZodType<Prisma.CollectionTypeAggregateArgs> =
  z
    .object({
      where: CollectionTypeWhereInputSchema.optional(),
      orderBy: z
        .union([
          CollectionTypeOrderByWithRelationInputSchema.array(),
          CollectionTypeOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: CollectionTypeWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeAggregateArgs>;

export default CollectionTypeAggregateArgsSchema;
