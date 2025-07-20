import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationTypeSchema } from './NotificationTypeSchema';

export const EnumNotificationTypeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumNotificationTypeFieldUpdateOperationsInput> = z.object({
  set: z.lazy(() => NotificationTypeSchema).optional()
}).strict();

export default EnumNotificationTypeFieldUpdateOperationsInputSchema;
