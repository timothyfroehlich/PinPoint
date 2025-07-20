import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationFrequencySchema } from './NotificationFrequencySchema';
import { NestedEnumNotificationFrequencyFilterSchema } from './NestedEnumNotificationFrequencyFilterSchema';

export const EnumNotificationFrequencyFilterSchema: z.ZodType<Prisma.EnumNotificationFrequencyFilter> = z.object({
  equals: z.lazy(() => NotificationFrequencySchema).optional(),
  in: z.lazy(() => NotificationFrequencySchema).array().optional(),
  notIn: z.lazy(() => NotificationFrequencySchema).array().optional(),
  not: z.union([ z.lazy(() => NotificationFrequencySchema),z.lazy(() => NestedEnumNotificationFrequencyFilterSchema) ]).optional(),
}).strict();

export default EnumNotificationFrequencyFilterSchema;
