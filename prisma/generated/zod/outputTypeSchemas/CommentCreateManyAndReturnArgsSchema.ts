import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CommentCreateManyInputSchema } from '../inputTypeSchemas/CommentCreateManyInputSchema'

export const CommentCreateManyAndReturnArgsSchema: z.ZodType<Prisma.CommentCreateManyAndReturnArgs> = z.object({
  data: z.union([ CommentCreateManyInputSchema,CommentCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default CommentCreateManyAndReturnArgsSchema;
