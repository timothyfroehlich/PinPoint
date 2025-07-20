import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringWithAggregatesFilterSchema } from './StringWithAggregatesFilterSchema';
import { IntWithAggregatesFilterSchema } from './IntWithAggregatesFilterSchema';
import { BoolWithAggregatesFilterSchema } from './BoolWithAggregatesFilterSchema';

export const PriorityScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.PriorityScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => PriorityScalarWhereWithAggregatesInputSchema),z.lazy(() => PriorityScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => PriorityScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => PriorityScalarWhereWithAggregatesInputSchema),z.lazy(() => PriorityScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  order: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  isDefault: z.union([ z.lazy(() => BoolWithAggregatesFilterSchema),z.boolean() ]).optional(),
}).strict();

export default PriorityScalarWhereWithAggregatesInputSchema;
