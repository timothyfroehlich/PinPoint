import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationWhereInputSchema } from '../inputTypeSchemas/OrganizationWhereInputSchema'
import { OrganizationOrderByWithAggregationInputSchema } from '../inputTypeSchemas/OrganizationOrderByWithAggregationInputSchema'
import { OrganizationScalarFieldEnumSchema } from '../inputTypeSchemas/OrganizationScalarFieldEnumSchema'
import { OrganizationScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/OrganizationScalarWhereWithAggregatesInputSchema'

export const OrganizationGroupByArgsSchema: z.ZodType<Prisma.OrganizationGroupByArgs> = z.object({
  where: OrganizationWhereInputSchema.optional(),
  orderBy: z.union([ OrganizationOrderByWithAggregationInputSchema.array(),OrganizationOrderByWithAggregationInputSchema ]).optional(),
  by: OrganizationScalarFieldEnumSchema.array(),
  having: OrganizationScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default OrganizationGroupByArgsSchema;
