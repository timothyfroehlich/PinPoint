import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationCreateManyInputSchema } from '../inputTypeSchemas/NotificationCreateManyInputSchema'

export const NotificationCreateManyAndReturnArgsSchema: z.ZodType<Prisma.NotificationCreateManyAndReturnArgs> = z.object({
  data: z.union([ NotificationCreateManyInputSchema,NotificationCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default NotificationCreateManyAndReturnArgsSchema;
