import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const MembershipMaxOrderByAggregateInputSchema: z.ZodType<Prisma.MembershipMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  roleId: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default MembershipMaxOrderByAggregateInputSchema;
