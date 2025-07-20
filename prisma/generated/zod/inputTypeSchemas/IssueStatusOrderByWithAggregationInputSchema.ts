import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { IssueStatusCountOrderByAggregateInputSchema } from './IssueStatusCountOrderByAggregateInputSchema';
import { IssueStatusMaxOrderByAggregateInputSchema } from './IssueStatusMaxOrderByAggregateInputSchema';
import { IssueStatusMinOrderByAggregateInputSchema } from './IssueStatusMinOrderByAggregateInputSchema';

export const IssueStatusOrderByWithAggregationInputSchema: z.ZodType<Prisma.IssueStatusOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  category: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  isDefault: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => IssueStatusCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => IssueStatusMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => IssueStatusMinOrderByAggregateInputSchema).optional()
}).strict();

export default IssueStatusOrderByWithAggregationInputSchema;
