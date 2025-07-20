import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const IssueMinOrderByAggregateInputSchema: z.ZodType<Prisma.IssueMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  title: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  consistency: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  resolvedAt: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  machineId: z.lazy(() => SortOrderSchema).optional(),
  statusId: z.lazy(() => SortOrderSchema).optional(),
  priorityId: z.lazy(() => SortOrderSchema).optional(),
  createdById: z.lazy(() => SortOrderSchema).optional(),
  assignedToId: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default IssueMinOrderByAggregateInputSchema;
