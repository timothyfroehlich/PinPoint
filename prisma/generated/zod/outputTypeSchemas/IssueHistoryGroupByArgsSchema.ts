import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueHistoryWhereInputSchema } from '../inputTypeSchemas/IssueHistoryWhereInputSchema'
import { IssueHistoryOrderByWithAggregationInputSchema } from '../inputTypeSchemas/IssueHistoryOrderByWithAggregationInputSchema'
import { IssueHistoryScalarFieldEnumSchema } from '../inputTypeSchemas/IssueHistoryScalarFieldEnumSchema'
import { IssueHistoryScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/IssueHistoryScalarWhereWithAggregatesInputSchema'

export const IssueHistoryGroupByArgsSchema: z.ZodType<Prisma.IssueHistoryGroupByArgs> = z.object({
  where: IssueHistoryWhereInputSchema.optional(),
  orderBy: z.union([ IssueHistoryOrderByWithAggregationInputSchema.array(),IssueHistoryOrderByWithAggregationInputSchema ]).optional(),
  by: IssueHistoryScalarFieldEnumSchema.array(),
  having: IssueHistoryScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default IssueHistoryGroupByArgsSchema;
