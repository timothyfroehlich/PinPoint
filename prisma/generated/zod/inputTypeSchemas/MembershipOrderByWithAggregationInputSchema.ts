import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { MembershipCountOrderByAggregateInputSchema } from './MembershipCountOrderByAggregateInputSchema';
import { MembershipMaxOrderByAggregateInputSchema } from './MembershipMaxOrderByAggregateInputSchema';
import { MembershipMinOrderByAggregateInputSchema } from './MembershipMinOrderByAggregateInputSchema';

export const MembershipOrderByWithAggregationInputSchema: z.ZodType<Prisma.MembershipOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  roleId: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => MembershipCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => MembershipMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => MembershipMinOrderByAggregateInputSchema).optional()
}).strict();

export default MembershipOrderByWithAggregationInputSchema;
