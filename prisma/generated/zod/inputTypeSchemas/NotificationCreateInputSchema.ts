import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationTypeSchema } from './NotificationTypeSchema';
import { NotificationEntitySchema } from './NotificationEntitySchema';
import { UserCreateNestedOneWithoutNotificationsInputSchema } from './UserCreateNestedOneWithoutNotificationsInputSchema';

export const NotificationCreateInputSchema: z.ZodType<Prisma.NotificationCreateInput> = z.object({
  id: z.string().cuid().optional(),
  message: z.string(),
  read: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  type: z.lazy(() => NotificationTypeSchema),
  entityType: z.lazy(() => NotificationEntitySchema).optional().nullable(),
  entityId: z.string().optional().nullable(),
  actionUrl: z.string().optional().nullable(),
  user: z.lazy(() => UserCreateNestedOneWithoutNotificationsInputSchema)
}).strict();

export default NotificationCreateInputSchema;
