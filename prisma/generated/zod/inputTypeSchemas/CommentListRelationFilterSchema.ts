import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentWhereInputSchema } from './CommentWhereInputSchema';

export const CommentListRelationFilterSchema: z.ZodType<Prisma.CommentListRelationFilter> = z.object({
  every: z.lazy(() => CommentWhereInputSchema).optional(),
  some: z.lazy(() => CommentWhereInputSchema).optional(),
  none: z.lazy(() => CommentWhereInputSchema).optional()
}).strict();

export default CommentListRelationFilterSchema;
