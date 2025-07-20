import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const IssueStatusCountOrderByAggregateInputSchema: z.ZodType<Prisma.IssueStatusCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  category: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  isDefault: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default IssueStatusCountOrderByAggregateInputSchema;
