import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationFrequencySchema } from './NotificationFrequencySchema';
import { NestedEnumNotificationFrequencyWithAggregatesFilterSchema } from './NestedEnumNotificationFrequencyWithAggregatesFilterSchema';
import { NestedIntFilterSchema } from './NestedIntFilterSchema';
import { NestedEnumNotificationFrequencyFilterSchema } from './NestedEnumNotificationFrequencyFilterSchema';

export const EnumNotificationFrequencyWithAggregatesFilterSchema: z.ZodType<Prisma.EnumNotificationFrequencyWithAggregatesFilter> = z.object({
  equals: z.lazy(() => NotificationFrequencySchema).optional(),
  in: z.lazy(() => NotificationFrequencySchema).array().optional(),
  notIn: z.lazy(() => NotificationFrequencySchema).array().optional(),
  not: z.union([ z.lazy(() => NotificationFrequencySchema),z.lazy(() => NestedEnumNotificationFrequencyWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumNotificationFrequencyFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumNotificationFrequencyFilterSchema).optional()
}).strict();

export default EnumNotificationFrequencyWithAggregatesFilterSchema;
