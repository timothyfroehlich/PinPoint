import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const ModelAvgOrderByAggregateInputSchema: z.ZodType<Prisma.ModelAvgOrderByAggregateInput> = z.object({
  year: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default ModelAvgOrderByAggregateInputSchema;
