import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleWhereInputSchema } from './RoleWhereInputSchema';

export const RoleListRelationFilterSchema: z.ZodType<Prisma.RoleListRelationFilter> = z.object({
  every: z.lazy(() => RoleWhereInputSchema).optional(),
  some: z.lazy(() => RoleWhereInputSchema).optional(),
  none: z.lazy(() => RoleWhereInputSchema).optional()
}).strict();

export default RoleListRelationFilterSchema;
