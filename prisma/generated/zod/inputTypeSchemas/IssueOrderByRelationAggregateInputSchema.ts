import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const IssueOrderByRelationAggregateInputSchema: z.ZodType<Prisma.IssueOrderByRelationAggregateInput> = z.object({
  _count: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default IssueOrderByRelationAggregateInputSchema;
