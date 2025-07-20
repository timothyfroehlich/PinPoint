import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { AttachmentWhereInputSchema } from '../inputTypeSchemas/AttachmentWhereInputSchema'
import { AttachmentOrderByWithAggregationInputSchema } from '../inputTypeSchemas/AttachmentOrderByWithAggregationInputSchema'
import { AttachmentScalarFieldEnumSchema } from '../inputTypeSchemas/AttachmentScalarFieldEnumSchema'
import { AttachmentScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/AttachmentScalarWhereWithAggregatesInputSchema'

export const AttachmentGroupByArgsSchema: z.ZodType<Prisma.AttachmentGroupByArgs> = z.object({
  where: AttachmentWhereInputSchema.optional(),
  orderBy: z.union([ AttachmentOrderByWithAggregationInputSchema.array(),AttachmentOrderByWithAggregationInputSchema ]).optional(),
  by: AttachmentScalarFieldEnumSchema.array(),
  having: AttachmentScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default AttachmentGroupByArgsSchema;
