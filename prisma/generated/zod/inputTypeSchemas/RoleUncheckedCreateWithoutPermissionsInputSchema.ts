import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipUncheckedCreateNestedManyWithoutRoleInputSchema } from './MembershipUncheckedCreateNestedManyWithoutRoleInputSchema';

export const RoleUncheckedCreateWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleUncheckedCreateWithoutPermissionsInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  organizationId: z.string(),
  isDefault: z.boolean().optional(),
  memberships: z.lazy(() => MembershipUncheckedCreateNestedManyWithoutRoleInputSchema).optional()
}).strict();

export default RoleUncheckedCreateWithoutPermissionsInputSchema;
