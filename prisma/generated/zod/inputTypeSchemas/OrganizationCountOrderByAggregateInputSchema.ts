import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const OrganizationCountOrderByAggregateInputSchema: z.ZodType<Prisma.OrganizationCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  subdomain: z.lazy(() => SortOrderSchema).optional(),
  logoUrl: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default OrganizationCountOrderByAggregateInputSchema;
