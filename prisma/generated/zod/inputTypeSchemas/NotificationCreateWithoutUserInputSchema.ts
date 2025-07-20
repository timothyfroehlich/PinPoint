import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationTypeSchema } from './NotificationTypeSchema';
import { NotificationEntitySchema } from './NotificationEntitySchema';

export const NotificationCreateWithoutUserInputSchema: z.ZodType<Prisma.NotificationCreateWithoutUserInput> = z.object({
  id: z.string().cuid().optional(),
  message: z.string(),
  read: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  type: z.lazy(() => NotificationTypeSchema),
  entityType: z.lazy(() => NotificationEntitySchema).optional().nullable(),
  entityId: z.string().optional().nullable(),
  actionUrl: z.string().optional().nullable()
}).strict();

export default NotificationCreateWithoutUserInputSchema;
