import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationCreateManyInputSchema } from '../inputTypeSchemas/NotificationCreateManyInputSchema'

export const NotificationCreateManyArgsSchema: z.ZodType<Prisma.NotificationCreateManyArgs> = z.object({
  data: z.union([ NotificationCreateManyInputSchema,NotificationCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default NotificationCreateManyArgsSchema;
