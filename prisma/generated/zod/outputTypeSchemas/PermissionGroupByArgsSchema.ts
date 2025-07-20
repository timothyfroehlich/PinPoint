import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PermissionWhereInputSchema } from '../inputTypeSchemas/PermissionWhereInputSchema'
import { PermissionOrderByWithAggregationInputSchema } from '../inputTypeSchemas/PermissionOrderByWithAggregationInputSchema'
import { PermissionScalarFieldEnumSchema } from '../inputTypeSchemas/PermissionScalarFieldEnumSchema'
import { PermissionScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/PermissionScalarWhereWithAggregatesInputSchema'

export const PermissionGroupByArgsSchema: z.ZodType<Prisma.PermissionGroupByArgs> = z.object({
  where: PermissionWhereInputSchema.optional(),
  orderBy: z.union([ PermissionOrderByWithAggregationInputSchema.array(),PermissionOrderByWithAggregationInputSchema ]).optional(),
  by: PermissionScalarFieldEnumSchema.array(),
  having: PermissionScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default PermissionGroupByArgsSchema;
