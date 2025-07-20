import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationIncludeSchema } from '../inputTypeSchemas/NotificationIncludeSchema'
import { NotificationWhereUniqueInputSchema } from '../inputTypeSchemas/NotificationWhereUniqueInputSchema'
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

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

export const NotificationFindUniqueArgsSchema: z.ZodType<Prisma.NotificationFindUniqueArgs> = z.object({
  select: NotificationSelectSchema.optional(),
  include: z.lazy(() => NotificationIncludeSchema).optional(),
  where: NotificationWhereUniqueInputSchema,
}).strict() ;

export default NotificationFindUniqueArgsSchema;
