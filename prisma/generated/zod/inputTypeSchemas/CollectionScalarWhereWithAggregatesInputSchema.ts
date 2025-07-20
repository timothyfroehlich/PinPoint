import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringWithAggregatesFilterSchema } from './StringWithAggregatesFilterSchema';
import { StringNullableWithAggregatesFilterSchema } from './StringNullableWithAggregatesFilterSchema';
import { BoolWithAggregatesFilterSchema } from './BoolWithAggregatesFilterSchema';
import { IntWithAggregatesFilterSchema } from './IntWithAggregatesFilterSchema';
import { JsonNullableWithAggregatesFilterSchema } from './JsonNullableWithAggregatesFilterSchema';

export const CollectionScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.CollectionScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema),z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema),z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  typeId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  locationId: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
  isSmart: z.union([ z.lazy(() => BoolWithAggregatesFilterSchema),z.boolean() ]).optional(),
  isManual: z.union([ z.lazy(() => BoolWithAggregatesFilterSchema),z.boolean() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
  sortOrder: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  filterCriteria: z.lazy(() => JsonNullableWithAggregatesFilterSchema).optional()
}).strict();

export default CollectionScalarWhereWithAggregatesInputSchema;
