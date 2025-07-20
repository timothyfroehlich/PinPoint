import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MembershipWhereInputSchema } from '../inputTypeSchemas/MembershipWhereInputSchema'
import { MembershipOrderByWithAggregationInputSchema } from '../inputTypeSchemas/MembershipOrderByWithAggregationInputSchema'
import { MembershipScalarFieldEnumSchema } from '../inputTypeSchemas/MembershipScalarFieldEnumSchema'
import { MembershipScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/MembershipScalarWhereWithAggregatesInputSchema'

export const MembershipGroupByArgsSchema: z.ZodType<Prisma.MembershipGroupByArgs> = z.object({
  where: MembershipWhereInputSchema.optional(),
  orderBy: z.union([ MembershipOrderByWithAggregationInputSchema.array(),MembershipOrderByWithAggregationInputSchema ]).optional(),
  by: MembershipScalarFieldEnumSchema.array(),
  having: MembershipScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default MembershipGroupByArgsSchema;
