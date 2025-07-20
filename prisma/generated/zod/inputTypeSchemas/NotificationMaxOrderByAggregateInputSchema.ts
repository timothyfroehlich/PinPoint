import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const NotificationMaxOrderByAggregateInputSchema: z.ZodType<Prisma.NotificationMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  message: z.lazy(() => SortOrderSchema).optional(),
  read: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  entityType: z.lazy(() => SortOrderSchema).optional(),
  entityId: z.lazy(() => SortOrderSchema).optional(),
  actionUrl: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default NotificationMaxOrderByAggregateInputSchema;
