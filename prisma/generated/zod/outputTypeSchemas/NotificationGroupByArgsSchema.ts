import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { NotificationWhereInputSchema } from '../inputTypeSchemas/NotificationWhereInputSchema'
import { NotificationOrderByWithAggregationInputSchema } from '../inputTypeSchemas/NotificationOrderByWithAggregationInputSchema'
import { NotificationScalarFieldEnumSchema } from '../inputTypeSchemas/NotificationScalarFieldEnumSchema'
import { NotificationScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/NotificationScalarWhereWithAggregatesInputSchema'

export const NotificationGroupByArgsSchema: z.ZodType<Prisma.NotificationGroupByArgs> = z.object({
  where: NotificationWhereInputSchema.optional(),
  orderBy: z.union([ NotificationOrderByWithAggregationInputSchema.array(),NotificationOrderByWithAggregationInputSchema ]).optional(),
  by: NotificationScalarFieldEnumSchema.array(),
  having: NotificationScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default NotificationGroupByArgsSchema;
