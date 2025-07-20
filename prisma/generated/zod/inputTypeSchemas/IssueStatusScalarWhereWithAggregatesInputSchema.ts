import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringWithAggregatesFilterSchema } from './StringWithAggregatesFilterSchema';
import { EnumStatusCategoryWithAggregatesFilterSchema } from './EnumStatusCategoryWithAggregatesFilterSchema';
import { StatusCategorySchema } from './StatusCategorySchema';
import { BoolWithAggregatesFilterSchema } from './BoolWithAggregatesFilterSchema';

export const IssueStatusScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.IssueStatusScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => IssueStatusScalarWhereWithAggregatesInputSchema),z.lazy(() => IssueStatusScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => IssueStatusScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IssueStatusScalarWhereWithAggregatesInputSchema),z.lazy(() => IssueStatusScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  category: z.union([ z.lazy(() => EnumStatusCategoryWithAggregatesFilterSchema),z.lazy(() => StatusCategorySchema) ]).optional(),
  organizationId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  isDefault: z.union([ z.lazy(() => BoolWithAggregatesFilterSchema),z.boolean() ]).optional(),
}).strict();

export default IssueStatusScalarWhereWithAggregatesInputSchema;
