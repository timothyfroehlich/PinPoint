import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CommentUpdateManyMutationInputSchema } from '../inputTypeSchemas/CommentUpdateManyMutationInputSchema'
import { CommentUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/CommentUncheckedUpdateManyInputSchema'
import { CommentWhereInputSchema } from '../inputTypeSchemas/CommentWhereInputSchema'

export const CommentUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.CommentUpdateManyAndReturnArgs> = z.object({
  data: z.union([ CommentUpdateManyMutationInputSchema,CommentUncheckedUpdateManyInputSchema ]),
  where: CommentWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default CommentUpdateManyAndReturnArgsSchema;
