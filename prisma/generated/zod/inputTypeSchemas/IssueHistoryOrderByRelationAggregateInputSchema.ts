import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const IssueHistoryOrderByRelationAggregateInputSchema: z.ZodType<Prisma.IssueHistoryOrderByRelationAggregateInput> = z.object({
  _count: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default IssueHistoryOrderByRelationAggregateInputSchema;
