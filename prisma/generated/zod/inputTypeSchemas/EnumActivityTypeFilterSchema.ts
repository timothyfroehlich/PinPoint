import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ActivityTypeSchema } from './ActivityTypeSchema';
import { NestedEnumActivityTypeFilterSchema } from './NestedEnumActivityTypeFilterSchema';

export const EnumActivityTypeFilterSchema: z.ZodType<Prisma.EnumActivityTypeFilter> = z.object({
  equals: z.lazy(() => ActivityTypeSchema).optional(),
  in: z.lazy(() => ActivityTypeSchema).array().optional(),
  notIn: z.lazy(() => ActivityTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => ActivityTypeSchema),z.lazy(() => NestedEnumActivityTypeFilterSchema) ]).optional(),
}).strict();

export default EnumActivityTypeFilterSchema;
