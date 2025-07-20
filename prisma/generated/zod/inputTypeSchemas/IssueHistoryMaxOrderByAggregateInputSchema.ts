import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const IssueHistoryMaxOrderByAggregateInputSchema: z.ZodType<Prisma.IssueHistoryMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  field: z.lazy(() => SortOrderSchema).optional(),
  oldValue: z.lazy(() => SortOrderSchema).optional(),
  newValue: z.lazy(() => SortOrderSchema).optional(),
  changedAt: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  actorId: z.lazy(() => SortOrderSchema).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  issueId: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default IssueHistoryMaxOrderByAggregateInputSchema;
