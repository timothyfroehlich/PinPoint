import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { LocationWhereInputSchema } from '../inputTypeSchemas/LocationWhereInputSchema'
import { LocationOrderByWithAggregationInputSchema } from '../inputTypeSchemas/LocationOrderByWithAggregationInputSchema'
import { LocationScalarFieldEnumSchema } from '../inputTypeSchemas/LocationScalarFieldEnumSchema'
import { LocationScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/LocationScalarWhereWithAggregatesInputSchema'

export const LocationGroupByArgsSchema: z.ZodType<Prisma.LocationGroupByArgs> = z.object({
  where: LocationWhereInputSchema.optional(),
  orderBy: z.union([ LocationOrderByWithAggregationInputSchema.array(),LocationOrderByWithAggregationInputSchema ]).optional(),
  by: LocationScalarFieldEnumSchema.array(),
  having: LocationScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default LocationGroupByArgsSchema;
