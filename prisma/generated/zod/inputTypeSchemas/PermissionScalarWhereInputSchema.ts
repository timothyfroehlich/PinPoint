import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';

export const PermissionScalarWhereInputSchema: z.ZodType<Prisma.PermissionScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => PermissionScalarWhereInputSchema),z.lazy(() => PermissionScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => PermissionScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => PermissionScalarWhereInputSchema),z.lazy(() => PermissionScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
}).strict();

export default PermissionScalarWhereInputSchema;
