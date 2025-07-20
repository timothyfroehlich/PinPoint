import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { IssueHistoryCountOrderByAggregateInputSchema } from './IssueHistoryCountOrderByAggregateInputSchema';
import { IssueHistoryMaxOrderByAggregateInputSchema } from './IssueHistoryMaxOrderByAggregateInputSchema';
import { IssueHistoryMinOrderByAggregateInputSchema } from './IssueHistoryMinOrderByAggregateInputSchema';

export const IssueHistoryOrderByWithAggregationInputSchema: z.ZodType<Prisma.IssueHistoryOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  field: z.lazy(() => SortOrderSchema).optional(),
  oldValue: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  newValue: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  changedAt: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  actorId: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  issueId: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => IssueHistoryCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => IssueHistoryMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => IssueHistoryMinOrderByAggregateInputSchema).optional()
}).strict();

export default IssueHistoryOrderByWithAggregationInputSchema;
