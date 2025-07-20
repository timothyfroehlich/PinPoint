import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationSelectSchema } from '../inputTypeSchemas/NotificationSelectSchema';
import { NotificationIncludeSchema } from '../inputTypeSchemas/NotificationIncludeSchema';

export const NotificationArgsSchema: z.ZodType<Prisma.NotificationDefaultArgs> = z.object({
  select: z.lazy(() => NotificationSelectSchema).optional(),
  include: z.lazy(() => NotificationIncludeSchema).optional(),
}).strict();

export default NotificationArgsSchema;
