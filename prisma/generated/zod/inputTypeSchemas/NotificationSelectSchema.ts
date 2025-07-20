import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"

export const NotificationSelectSchema: z.ZodType<Prisma.NotificationSelect> = z.object({
  id: z.boolean().optional(),
  message: z.boolean().optional(),
  read: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  userId: z.boolean().optional(),
  type: z.boolean().optional(),
  entityType: z.boolean().optional(),
  entityId: z.boolean().optional(),
  actionUrl: z.boolean().optional(),
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

export default NotificationSelectSchema;
