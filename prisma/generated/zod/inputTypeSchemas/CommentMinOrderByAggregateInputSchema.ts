import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const CommentMinOrderByAggregateInputSchema: z.ZodType<Prisma.CommentMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  content: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedBy: z.lazy(() => SortOrderSchema).optional(),
  issueId: z.lazy(() => SortOrderSchema).optional(),
  authorId: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default CommentMinOrderByAggregateInputSchema;
