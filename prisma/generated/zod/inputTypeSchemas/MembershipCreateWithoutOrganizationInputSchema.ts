import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateNestedOneWithoutMembershipsInputSchema } from './UserCreateNestedOneWithoutMembershipsInputSchema';
import { RoleCreateNestedOneWithoutMembershipsInputSchema } from './RoleCreateNestedOneWithoutMembershipsInputSchema';

export const MembershipCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  user: z.lazy(() => UserCreateNestedOneWithoutMembershipsInputSchema),
  role: z.lazy(() => RoleCreateNestedOneWithoutMembershipsInputSchema)
}).strict();

export default MembershipCreateWithoutOrganizationInputSchema;
