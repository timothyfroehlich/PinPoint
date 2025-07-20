import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateNestedOneWithoutRolesInputSchema } from './OrganizationCreateNestedOneWithoutRolesInputSchema';
import { MembershipCreateNestedManyWithoutRoleInputSchema } from './MembershipCreateNestedManyWithoutRoleInputSchema';
import { PermissionCreateNestedManyWithoutRolesInputSchema } from './PermissionCreateNestedManyWithoutRolesInputSchema';

export const RoleCreateInputSchema: z.ZodType<Prisma.RoleCreateInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  isDefault: z.boolean().optional(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutRolesInputSchema),
  memberships: z.lazy(() => MembershipCreateNestedManyWithoutRoleInputSchema).optional(),
  permissions: z.lazy(() => PermissionCreateNestedManyWithoutRolesInputSchema).optional()
}).strict();

export default RoleCreateInputSchema;
