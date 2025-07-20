import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PermissionWhereInputSchema } from './PermissionWhereInputSchema';

export const PermissionListRelationFilterSchema: z.ZodType<Prisma.PermissionListRelationFilter> = z.object({
  every: z.lazy(() => PermissionWhereInputSchema).optional(),
  some: z.lazy(() => PermissionWhereInputSchema).optional(),
  none: z.lazy(() => PermissionWhereInputSchema).optional()
}).strict();

export default PermissionListRelationFilterSchema;
