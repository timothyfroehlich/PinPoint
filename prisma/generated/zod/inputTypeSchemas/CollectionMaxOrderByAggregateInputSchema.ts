import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const CollectionMaxOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  typeId: z.lazy(() => SortOrderSchema).optional(),
  locationId: z.lazy(() => SortOrderSchema).optional(),
  isSmart: z.lazy(() => SortOrderSchema).optional(),
  isManual: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  sortOrder: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default CollectionMaxOrderByAggregateInputSchema;
