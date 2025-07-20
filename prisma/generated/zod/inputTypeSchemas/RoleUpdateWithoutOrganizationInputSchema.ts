import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { MembershipUpdateManyWithoutRoleNestedInputSchema } from './MembershipUpdateManyWithoutRoleNestedInputSchema';
import { PermissionUpdateManyWithoutRolesNestedInputSchema } from './PermissionUpdateManyWithoutRolesNestedInputSchema';

export const RoleUpdateWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleUpdateWithoutOrganizationInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  isDefault: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  memberships: z.lazy(() => MembershipUpdateManyWithoutRoleNestedInputSchema).optional(),
  permissions: z.lazy(() => PermissionUpdateManyWithoutRolesNestedInputSchema).optional()
}).strict();

export default RoleUpdateWithoutOrganizationInputSchema;
