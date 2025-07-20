import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const RoleOrderByRelationAggregateInputSchema: z.ZodType<Prisma.RoleOrderByRelationAggregateInput> = z.object({
  _count: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default RoleOrderByRelationAggregateInputSchema;
