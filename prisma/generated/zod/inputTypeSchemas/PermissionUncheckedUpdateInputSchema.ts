import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { RoleUncheckedUpdateManyWithoutPermissionsNestedInputSchema } from './RoleUncheckedUpdateManyWithoutPermissionsNestedInputSchema';

export const PermissionUncheckedUpdateInputSchema: z.ZodType<Prisma.PermissionUncheckedUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  roles: z.lazy(() => RoleUncheckedUpdateManyWithoutPermissionsNestedInputSchema).optional()
}).strict();

export default PermissionUncheckedUpdateInputSchema;
