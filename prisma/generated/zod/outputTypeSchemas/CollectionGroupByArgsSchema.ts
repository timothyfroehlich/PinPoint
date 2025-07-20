import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionWhereInputSchema } from '../inputTypeSchemas/CollectionWhereInputSchema'
import { CollectionOrderByWithAggregationInputSchema } from '../inputTypeSchemas/CollectionOrderByWithAggregationInputSchema'
import { CollectionScalarFieldEnumSchema } from '../inputTypeSchemas/CollectionScalarFieldEnumSchema'
import { CollectionScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/CollectionScalarWhereWithAggregatesInputSchema'

export const CollectionGroupByArgsSchema: z.ZodType<Prisma.CollectionGroupByArgs> = z.object({
  where: CollectionWhereInputSchema.optional(),
  orderBy: z.union([ CollectionOrderByWithAggregationInputSchema.array(),CollectionOrderByWithAggregationInputSchema ]).optional(),
  by: CollectionScalarFieldEnumSchema.array(),
  having: CollectionScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default CollectionGroupByArgsSchema;
