import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleUncheckedCreateNestedManyWithoutPermissionsInputSchema } from './RoleUncheckedCreateNestedManyWithoutPermissionsInputSchema';

export const PermissionUncheckedCreateInputSchema: z.ZodType<Prisma.PermissionUncheckedCreateInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  roles: z.lazy(() => RoleUncheckedCreateNestedManyWithoutPermissionsInputSchema).optional()
}).strict();

export default PermissionUncheckedCreateInputSchema;
