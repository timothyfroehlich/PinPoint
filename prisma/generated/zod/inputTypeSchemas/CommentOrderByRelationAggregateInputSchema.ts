import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const CommentOrderByRelationAggregateInputSchema: z.ZodType<Prisma.CommentOrderByRelationAggregateInput> = z.object({
  _count: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default CommentOrderByRelationAggregateInputSchema;
