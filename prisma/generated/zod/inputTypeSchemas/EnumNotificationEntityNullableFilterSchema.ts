import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationEntitySchema } from './NotificationEntitySchema';
import { NestedEnumNotificationEntityNullableFilterSchema } from './NestedEnumNotificationEntityNullableFilterSchema';

export const EnumNotificationEntityNullableFilterSchema: z.ZodType<Prisma.EnumNotificationEntityNullableFilter> = z.object({
  equals: z.lazy(() => NotificationEntitySchema).optional().nullable(),
  in: z.lazy(() => NotificationEntitySchema).array().optional().nullable(),
  notIn: z.lazy(() => NotificationEntitySchema).array().optional().nullable(),
  not: z.union([ z.lazy(() => NotificationEntitySchema),z.lazy(() => NestedEnumNotificationEntityNullableFilterSchema) ]).optional().nullable(),
}).strict();

export default EnumNotificationEntityNullableFilterSchema;
