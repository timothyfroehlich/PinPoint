import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const CollectionTypeOrderByRelationAggregateInputSchema: z.ZodType<Prisma.CollectionTypeOrderByRelationAggregateInput> = z.object({
  _count: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default CollectionTypeOrderByRelationAggregateInputSchema;
