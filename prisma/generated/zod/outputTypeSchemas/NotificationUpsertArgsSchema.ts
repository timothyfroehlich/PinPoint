import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationIncludeSchema } from '../inputTypeSchemas/NotificationIncludeSchema'
import { NotificationWhereUniqueInputSchema } from '../inputTypeSchemas/NotificationWhereUniqueInputSchema'
import { NotificationCreateInputSchema } from '../inputTypeSchemas/NotificationCreateInputSchema'
import { NotificationUncheckedCreateInputSchema } from '../inputTypeSchemas/NotificationUncheckedCreateInputSchema'
import { NotificationUpdateInputSchema } from '../inputTypeSchemas/NotificationUpdateInputSchema'
import { NotificationUncheckedUpdateInputSchema } from '../inputTypeSchemas/NotificationUncheckedUpdateInputSchema'
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

export const NotificationUpsertArgsSchema: z.ZodType<Prisma.NotificationUpsertArgs> = z.object({
  select: NotificationSelectSchema.optional(),
  include: z.lazy(() => NotificationIncludeSchema).optional(),
  where: NotificationWhereUniqueInputSchema,
  create: z.union([ NotificationCreateInputSchema,NotificationUncheckedCreateInputSchema ]),
  update: z.union([ NotificationUpdateInputSchema,NotificationUncheckedUpdateInputSchema ]),
}).strict() ;

export default NotificationUpsertArgsSchema;
