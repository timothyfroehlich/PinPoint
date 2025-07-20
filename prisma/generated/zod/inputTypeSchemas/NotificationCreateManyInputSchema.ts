import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationTypeSchema } from './NotificationTypeSchema';
import { NotificationEntitySchema } from './NotificationEntitySchema';

export const NotificationCreateManyInputSchema: z.ZodType<Prisma.NotificationCreateManyInput> = z.object({
  id: z.string().cuid().optional(),
  message: z.string(),
  read: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  userId: z.string(),
  type: z.lazy(() => NotificationTypeSchema),
  entityType: z.lazy(() => NotificationEntitySchema).optional().nullable(),
  entityId: z.string().optional().nullable(),
  actionUrl: z.string().optional().nullable()
}).strict();

export default NotificationCreateManyInputSchema;
