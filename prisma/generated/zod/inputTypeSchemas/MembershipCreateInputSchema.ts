import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateNestedOneWithoutMembershipsInputSchema } from './UserCreateNestedOneWithoutMembershipsInputSchema';
import { OrganizationCreateNestedOneWithoutMembershipsInputSchema } from './OrganizationCreateNestedOneWithoutMembershipsInputSchema';
import { RoleCreateNestedOneWithoutMembershipsInputSchema } from './RoleCreateNestedOneWithoutMembershipsInputSchema';

export const MembershipCreateInputSchema: z.ZodType<Prisma.MembershipCreateInput> = z.object({
  id: z.string().cuid().optional(),
  user: z.lazy(() => UserCreateNestedOneWithoutMembershipsInputSchema),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutMembershipsInputSchema),
  role: z.lazy(() => RoleCreateNestedOneWithoutMembershipsInputSchema)
}).strict();

export default MembershipCreateInputSchema;
