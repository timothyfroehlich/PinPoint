import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { UserOrderByWithRelationInputSchema } from './UserOrderByWithRelationInputSchema';

export const NotificationOrderByWithRelationInputSchema: z.ZodType<Prisma.NotificationOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  message: z.lazy(() => SortOrderSchema).optional(),
  read: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  entityType: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  entityId: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  actionUrl: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputSchema).optional()
}).strict();

export default NotificationOrderByWithRelationInputSchema;
