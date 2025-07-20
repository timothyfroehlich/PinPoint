import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationTypeSchema } from './NotificationTypeSchema';

export const NestedEnumNotificationTypeFilterSchema: z.ZodType<Prisma.NestedEnumNotificationTypeFilter> = z.object({
  equals: z.lazy(() => NotificationTypeSchema).optional(),
  in: z.lazy(() => NotificationTypeSchema).array().optional(),
  notIn: z.lazy(() => NotificationTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => NotificationTypeSchema),z.lazy(() => NestedEnumNotificationTypeFilterSchema) ]).optional(),
}).strict();

export default NestedEnumNotificationTypeFilterSchema;
