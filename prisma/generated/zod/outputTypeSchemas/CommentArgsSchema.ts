import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CommentSelectSchema } from '../inputTypeSchemas/CommentSelectSchema';
import { CommentIncludeSchema } from '../inputTypeSchemas/CommentIncludeSchema';

export const CommentArgsSchema: z.ZodType<Prisma.CommentDefaultArgs> = z.object({
  select: z.lazy(() => CommentSelectSchema).optional(),
  include: z.lazy(() => CommentIncludeSchema).optional(),
}).strict();

export default CommentArgsSchema;
