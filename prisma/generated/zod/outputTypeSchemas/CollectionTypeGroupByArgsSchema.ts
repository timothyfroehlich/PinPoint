import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionTypeWhereInputSchema } from "../inputTypeSchemas/CollectionTypeWhereInputSchema";
import { CollectionTypeOrderByWithAggregationInputSchema } from "../inputTypeSchemas/CollectionTypeOrderByWithAggregationInputSchema";
import { CollectionTypeScalarFieldEnumSchema } from "../inputTypeSchemas/CollectionTypeScalarFieldEnumSchema";
import { CollectionTypeScalarWhereWithAggregatesInputSchema } from "../inputTypeSchemas/CollectionTypeScalarWhereWithAggregatesInputSchema";

export const CollectionTypeGroupByArgsSchema: z.ZodType<Prisma.CollectionTypeGroupByArgs> =
  z
    .object({
      where: CollectionTypeWhereInputSchema.optional(),
      orderBy: z
        .union([
          CollectionTypeOrderByWithAggregationInputSchema.array(),
          CollectionTypeOrderByWithAggregationInputSchema,
        ])
        .optional(),
      by: CollectionTypeScalarFieldEnumSchema.array(),
      having: CollectionTypeScalarWhereWithAggregatesInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeGroupByArgs>;

export default CollectionTypeGroupByArgsSchema;
