import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ActivityTypeSchema } from './ActivityTypeSchema';

export const NestedEnumActivityTypeFilterSchema: z.ZodType<Prisma.NestedEnumActivityTypeFilter> = z.object({
  equals: z.lazy(() => ActivityTypeSchema).optional(),
  in: z.lazy(() => ActivityTypeSchema).array().optional(),
  notIn: z.lazy(() => ActivityTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => ActivityTypeSchema),z.lazy(() => NestedEnumActivityTypeFilterSchema) ]).optional(),
}).strict();

export default NestedEnumActivityTypeFilterSchema;
