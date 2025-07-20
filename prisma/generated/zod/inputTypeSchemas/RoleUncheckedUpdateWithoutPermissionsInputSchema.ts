import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { MembershipUncheckedUpdateManyWithoutRoleNestedInputSchema } from './MembershipUncheckedUpdateManyWithoutRoleNestedInputSchema';

export const RoleUncheckedUpdateWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleUncheckedUpdateWithoutPermissionsInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  organizationId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  isDefault: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  memberships: z.lazy(() => MembershipUncheckedUpdateManyWithoutRoleNestedInputSchema).optional()
}).strict();

export default RoleUncheckedUpdateWithoutPermissionsInputSchema;
