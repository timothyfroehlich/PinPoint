import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const PermissionMaxOrderByAggregateInputSchema: z.ZodType<Prisma.PermissionMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default PermissionMaxOrderByAggregateInputSchema;
