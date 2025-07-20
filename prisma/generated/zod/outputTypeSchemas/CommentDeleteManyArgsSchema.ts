import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CommentWhereInputSchema } from '../inputTypeSchemas/CommentWhereInputSchema'

export const CommentDeleteManyArgsSchema: z.ZodType<Prisma.CommentDeleteManyArgs> = z.object({
  where: CommentWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default CommentDeleteManyArgsSchema;
