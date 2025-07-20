import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationUpdateManyMutationInputSchema } from '../inputTypeSchemas/NotificationUpdateManyMutationInputSchema'
import { NotificationUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/NotificationUncheckedUpdateManyInputSchema'
import { NotificationWhereInputSchema } from '../inputTypeSchemas/NotificationWhereInputSchema'

export const NotificationUpdateManyArgsSchema: z.ZodType<Prisma.NotificationUpdateManyArgs> = z.object({
  data: z.union([ NotificationUpdateManyMutationInputSchema,NotificationUncheckedUpdateManyInputSchema ]),
  where: NotificationWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default NotificationUpdateManyArgsSchema;
