import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringWithAggregatesFilterSchema } from './StringWithAggregatesFilterSchema';
import { BoolWithAggregatesFilterSchema } from './BoolWithAggregatesFilterSchema';
import { DateTimeWithAggregatesFilterSchema } from './DateTimeWithAggregatesFilterSchema';
import { EnumNotificationTypeWithAggregatesFilterSchema } from './EnumNotificationTypeWithAggregatesFilterSchema';
import { NotificationTypeSchema } from './NotificationTypeSchema';
import { EnumNotificationEntityNullableWithAggregatesFilterSchema } from './EnumNotificationEntityNullableWithAggregatesFilterSchema';
import { NotificationEntitySchema } from './NotificationEntitySchema';
import { StringNullableWithAggregatesFilterSchema } from './StringNullableWithAggregatesFilterSchema';

export const NotificationScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.NotificationScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => NotificationScalarWhereWithAggregatesInputSchema),z.lazy(() => NotificationScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => NotificationScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => NotificationScalarWhereWithAggregatesInputSchema),z.lazy(() => NotificationScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  message: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  read: z.union([ z.lazy(() => BoolWithAggregatesFilterSchema),z.boolean() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
  userId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  type: z.union([ z.lazy(() => EnumNotificationTypeWithAggregatesFilterSchema),z.lazy(() => NotificationTypeSchema) ]).optional(),
  entityType: z.union([ z.lazy(() => EnumNotificationEntityNullableWithAggregatesFilterSchema),z.lazy(() => NotificationEntitySchema) ]).optional().nullable(),
  entityId: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
  actionUrl: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
}).strict();

export default NotificationScalarWhereWithAggregatesInputSchema;
