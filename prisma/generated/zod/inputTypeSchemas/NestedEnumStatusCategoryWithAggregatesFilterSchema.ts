import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StatusCategorySchema } from './StatusCategorySchema';
import { NestedIntFilterSchema } from './NestedIntFilterSchema';
import { NestedEnumStatusCategoryFilterSchema } from './NestedEnumStatusCategoryFilterSchema';

export const NestedEnumStatusCategoryWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumStatusCategoryWithAggregatesFilter> = z.object({
  equals: z.lazy(() => StatusCategorySchema).optional(),
  in: z.lazy(() => StatusCategorySchema).array().optional(),
  notIn: z.lazy(() => StatusCategorySchema).array().optional(),
  not: z.union([ z.lazy(() => StatusCategorySchema),z.lazy(() => NestedEnumStatusCategoryWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumStatusCategoryFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumStatusCategoryFilterSchema).optional()
}).strict();

export default NestedEnumStatusCategoryWithAggregatesFilterSchema;
