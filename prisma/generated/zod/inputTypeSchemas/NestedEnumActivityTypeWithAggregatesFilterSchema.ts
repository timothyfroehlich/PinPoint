import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ActivityTypeSchema } from './ActivityTypeSchema';
import { NestedIntFilterSchema } from './NestedIntFilterSchema';
import { NestedEnumActivityTypeFilterSchema } from './NestedEnumActivityTypeFilterSchema';

export const NestedEnumActivityTypeWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumActivityTypeWithAggregatesFilter> = z.object({
  equals: z.lazy(() => ActivityTypeSchema).optional(),
  in: z.lazy(() => ActivityTypeSchema).array().optional(),
  notIn: z.lazy(() => ActivityTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => ActivityTypeSchema),z.lazy(() => NestedEnumActivityTypeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumActivityTypeFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumActivityTypeFilterSchema).optional()
}).strict();

export default NestedEnumActivityTypeWithAggregatesFilterSchema;
