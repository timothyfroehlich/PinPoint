import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CommentWhereInputSchema } from '../inputTypeSchemas/CommentWhereInputSchema'
import { CommentOrderByWithAggregationInputSchema } from '../inputTypeSchemas/CommentOrderByWithAggregationInputSchema'
import { CommentScalarFieldEnumSchema } from '../inputTypeSchemas/CommentScalarFieldEnumSchema'
import { CommentScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/CommentScalarWhereWithAggregatesInputSchema'

export const CommentGroupByArgsSchema: z.ZodType<Prisma.CommentGroupByArgs> = z.object({
  where: CommentWhereInputSchema.optional(),
  orderBy: z.union([ CommentOrderByWithAggregationInputSchema.array(),CommentOrderByWithAggregationInputSchema ]).optional(),
  by: CommentScalarFieldEnumSchema.array(),
  having: CommentScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default CommentGroupByArgsSchema;
