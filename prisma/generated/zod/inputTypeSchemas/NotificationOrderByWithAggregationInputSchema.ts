import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { NotificationCountOrderByAggregateInputSchema } from './NotificationCountOrderByAggregateInputSchema';
import { NotificationMaxOrderByAggregateInputSchema } from './NotificationMaxOrderByAggregateInputSchema';
import { NotificationMinOrderByAggregateInputSchema } from './NotificationMinOrderByAggregateInputSchema';

export const NotificationOrderByWithAggregationInputSchema: z.ZodType<Prisma.NotificationOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  message: z.lazy(() => SortOrderSchema).optional(),
  read: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  entityType: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  entityId: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  actionUrl: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  _count: z.lazy(() => NotificationCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => NotificationMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => NotificationMinOrderByAggregateInputSchema).optional()
}).strict();

export default NotificationOrderByWithAggregationInputSchema;
