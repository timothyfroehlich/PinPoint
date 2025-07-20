import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationWhereInputSchema } from '../inputTypeSchemas/NotificationWhereInputSchema'
import { NotificationOrderByWithRelationInputSchema } from '../inputTypeSchemas/NotificationOrderByWithRelationInputSchema'
import { NotificationWhereUniqueInputSchema } from '../inputTypeSchemas/NotificationWhereUniqueInputSchema'

export const NotificationAggregateArgsSchema: z.ZodType<Prisma.NotificationAggregateArgs> = z.object({
  where: NotificationWhereInputSchema.optional(),
  orderBy: z.union([ NotificationOrderByWithRelationInputSchema.array(),NotificationOrderByWithRelationInputSchema ]).optional(),
  cursor: NotificationWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default NotificationAggregateArgsSchema;
