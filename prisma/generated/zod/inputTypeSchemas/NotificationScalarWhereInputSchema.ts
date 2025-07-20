import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { EnumNotificationTypeFilterSchema } from './EnumNotificationTypeFilterSchema';
import { NotificationTypeSchema } from './NotificationTypeSchema';
import { EnumNotificationEntityNullableFilterSchema } from './EnumNotificationEntityNullableFilterSchema';
import { NotificationEntitySchema } from './NotificationEntitySchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';

export const NotificationScalarWhereInputSchema: z.ZodType<Prisma.NotificationScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => NotificationScalarWhereInputSchema),z.lazy(() => NotificationScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => NotificationScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => NotificationScalarWhereInputSchema),z.lazy(() => NotificationScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  message: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  read: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  type: z.union([ z.lazy(() => EnumNotificationTypeFilterSchema),z.lazy(() => NotificationTypeSchema) ]).optional(),
  entityType: z.union([ z.lazy(() => EnumNotificationEntityNullableFilterSchema),z.lazy(() => NotificationEntitySchema) ]).optional().nullable(),
  entityId: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  actionUrl: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
}).strict();

export default NotificationScalarWhereInputSchema;
