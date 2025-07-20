import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipUncheckedCreateNestedManyWithoutRoleInputSchema } from './MembershipUncheckedCreateNestedManyWithoutRoleInputSchema';
import { PermissionUncheckedCreateNestedManyWithoutRolesInputSchema } from './PermissionUncheckedCreateNestedManyWithoutRolesInputSchema';

export const RoleUncheckedCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleUncheckedCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  isDefault: z.boolean().optional(),
  memberships: z.lazy(() => MembershipUncheckedCreateNestedManyWithoutRoleInputSchema).optional(),
  permissions: z.lazy(() => PermissionUncheckedCreateNestedManyWithoutRolesInputSchema).optional()
}).strict();

export default RoleUncheckedCreateWithoutOrganizationInputSchema;
