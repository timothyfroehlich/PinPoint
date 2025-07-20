import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationEntitySchema } from './NotificationEntitySchema';
import { NestedIntNullableFilterSchema } from './NestedIntNullableFilterSchema';
import { NestedEnumNotificationEntityNullableFilterSchema } from './NestedEnumNotificationEntityNullableFilterSchema';

export const NestedEnumNotificationEntityNullableWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumNotificationEntityNullableWithAggregatesFilter> = z.object({
  equals: z.lazy(() => NotificationEntitySchema).optional().nullable(),
  in: z.lazy(() => NotificationEntitySchema).array().optional().nullable(),
  notIn: z.lazy(() => NotificationEntitySchema).array().optional().nullable(),
  not: z.union([ z.lazy(() => NotificationEntitySchema),z.lazy(() => NestedEnumNotificationEntityNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumNotificationEntityNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumNotificationEntityNullableFilterSchema).optional()
}).strict();

export default NestedEnumNotificationEntityNullableWithAggregatesFilterSchema;
