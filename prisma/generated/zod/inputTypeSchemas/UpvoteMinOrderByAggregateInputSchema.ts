import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const UpvoteMinOrderByAggregateInputSchema: z.ZodType<Prisma.UpvoteMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  issueId: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default UpvoteMinOrderByAggregateInputSchema;
