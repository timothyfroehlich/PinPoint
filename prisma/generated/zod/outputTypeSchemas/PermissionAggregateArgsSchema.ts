import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PermissionWhereInputSchema } from '../inputTypeSchemas/PermissionWhereInputSchema'
import { PermissionOrderByWithRelationInputSchema } from '../inputTypeSchemas/PermissionOrderByWithRelationInputSchema'
import { PermissionWhereUniqueInputSchema } from '../inputTypeSchemas/PermissionWhereUniqueInputSchema'

export const PermissionAggregateArgsSchema: z.ZodType<Prisma.PermissionAggregateArgs> = z.object({
  where: PermissionWhereInputSchema.optional(),
  orderBy: z.union([ PermissionOrderByWithRelationInputSchema.array(),PermissionOrderByWithRelationInputSchema ]).optional(),
  cursor: PermissionWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default PermissionAggregateArgsSchema;
