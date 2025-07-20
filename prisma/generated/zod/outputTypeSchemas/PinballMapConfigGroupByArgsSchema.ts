import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PinballMapConfigWhereInputSchema } from '../inputTypeSchemas/PinballMapConfigWhereInputSchema'
import { PinballMapConfigOrderByWithAggregationInputSchema } from '../inputTypeSchemas/PinballMapConfigOrderByWithAggregationInputSchema'
import { PinballMapConfigScalarFieldEnumSchema } from '../inputTypeSchemas/PinballMapConfigScalarFieldEnumSchema'
import { PinballMapConfigScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/PinballMapConfigScalarWhereWithAggregatesInputSchema'

export const PinballMapConfigGroupByArgsSchema: z.ZodType<Prisma.PinballMapConfigGroupByArgs> = z.object({
  where: PinballMapConfigWhereInputSchema.optional(),
  orderBy: z.union([ PinballMapConfigOrderByWithAggregationInputSchema.array(),PinballMapConfigOrderByWithAggregationInputSchema ]).optional(),
  by: PinballMapConfigScalarFieldEnumSchema.array(),
  having: PinballMapConfigScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default PinballMapConfigGroupByArgsSchema;
