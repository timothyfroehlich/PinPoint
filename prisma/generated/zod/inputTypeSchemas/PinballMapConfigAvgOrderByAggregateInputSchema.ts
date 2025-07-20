import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const PinballMapConfigAvgOrderByAggregateInputSchema: z.ZodType<Prisma.PinballMapConfigAvgOrderByAggregateInput> = z.object({
  syncIntervalHours: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default PinballMapConfigAvgOrderByAggregateInputSchema;
