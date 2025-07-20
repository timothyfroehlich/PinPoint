import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueWhereInputSchema } from '../inputTypeSchemas/IssueWhereInputSchema'
import { IssueOrderByWithAggregationInputSchema } from '../inputTypeSchemas/IssueOrderByWithAggregationInputSchema'
import { IssueScalarFieldEnumSchema } from '../inputTypeSchemas/IssueScalarFieldEnumSchema'
import { IssueScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/IssueScalarWhereWithAggregatesInputSchema'

export const IssueGroupByArgsSchema: z.ZodType<Prisma.IssueGroupByArgs> = z.object({
  where: IssueWhereInputSchema.optional(),
  orderBy: z.union([ IssueOrderByWithAggregationInputSchema.array(),IssueOrderByWithAggregationInputSchema ]).optional(),
  by: IssueScalarFieldEnumSchema.array(),
  having: IssueScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default IssueGroupByArgsSchema;
