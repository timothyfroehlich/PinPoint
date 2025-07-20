import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const PinballMapConfigSumOrderByAggregateInputSchema: z.ZodType<Prisma.PinballMapConfigSumOrderByAggregateInput> = z.object({
  syncIntervalHours: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default PinballMapConfigSumOrderByAggregateInputSchema;
