import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueStatusWhereInputSchema } from '../inputTypeSchemas/IssueStatusWhereInputSchema'
import { IssueStatusOrderByWithRelationInputSchema } from '../inputTypeSchemas/IssueStatusOrderByWithRelationInputSchema'
import { IssueStatusWhereUniqueInputSchema } from '../inputTypeSchemas/IssueStatusWhereUniqueInputSchema'

export const IssueStatusAggregateArgsSchema: z.ZodType<Prisma.IssueStatusAggregateArgs> = z.object({
  where: IssueStatusWhereInputSchema.optional(),
  orderBy: z.union([ IssueStatusOrderByWithRelationInputSchema.array(),IssueStatusOrderByWithRelationInputSchema ]).optional(),
  cursor: IssueStatusWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default IssueStatusAggregateArgsSchema;
