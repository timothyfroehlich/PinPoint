import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const CollectionSumOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionSumOrderByAggregateInput> = z.object({
  sortOrder: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default CollectionSumOrderByAggregateInputSchema;
