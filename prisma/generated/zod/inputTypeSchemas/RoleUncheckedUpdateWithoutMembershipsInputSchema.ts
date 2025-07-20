import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { PermissionUncheckedUpdateManyWithoutRolesNestedInputSchema } from './PermissionUncheckedUpdateManyWithoutRolesNestedInputSchema';

export const RoleUncheckedUpdateWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleUncheckedUpdateWithoutMembershipsInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  organizationId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  isDefault: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  permissions: z.lazy(() => PermissionUncheckedUpdateManyWithoutRolesNestedInputSchema).optional()
}).strict();

export default RoleUncheckedUpdateWithoutMembershipsInputSchema;
