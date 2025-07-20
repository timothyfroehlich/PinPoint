import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { RoleOrderByRelationAggregateInputSchema } from './RoleOrderByRelationAggregateInputSchema';

export const PermissionOrderByWithRelationInputSchema: z.ZodType<Prisma.PermissionOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  roles: z.lazy(() => RoleOrderByRelationAggregateInputSchema).optional()
}).strict();

export default PermissionOrderByWithRelationInputSchema;
