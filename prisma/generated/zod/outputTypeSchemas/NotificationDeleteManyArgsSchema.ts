import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationWhereInputSchema } from '../inputTypeSchemas/NotificationWhereInputSchema'

export const NotificationDeleteManyArgsSchema: z.ZodType<Prisma.NotificationDeleteManyArgs> = z.object({
  where: NotificationWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default NotificationDeleteManyArgsSchema;
