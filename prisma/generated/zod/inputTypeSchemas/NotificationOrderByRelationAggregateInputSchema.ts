import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const NotificationOrderByRelationAggregateInputSchema: z.ZodType<Prisma.NotificationOrderByRelationAggregateInput> = z.object({
  _count: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default NotificationOrderByRelationAggregateInputSchema;
