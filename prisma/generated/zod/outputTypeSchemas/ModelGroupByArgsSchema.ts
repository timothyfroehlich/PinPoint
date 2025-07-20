import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ModelWhereInputSchema } from '../inputTypeSchemas/ModelWhereInputSchema'
import { ModelOrderByWithAggregationInputSchema } from '../inputTypeSchemas/ModelOrderByWithAggregationInputSchema'
import { ModelScalarFieldEnumSchema } from '../inputTypeSchemas/ModelScalarFieldEnumSchema'
import { ModelScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/ModelScalarWhereWithAggregatesInputSchema'

export const ModelGroupByArgsSchema: z.ZodType<Prisma.ModelGroupByArgs> = z.object({
  where: ModelWhereInputSchema.optional(),
  orderBy: z.union([ ModelOrderByWithAggregationInputSchema.array(),ModelOrderByWithAggregationInputSchema ]).optional(),
  by: ModelScalarFieldEnumSchema.array(),
  having: ModelScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default ModelGroupByArgsSchema;
