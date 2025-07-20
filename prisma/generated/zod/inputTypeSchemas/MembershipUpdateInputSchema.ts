import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { UserUpdateOneRequiredWithoutMembershipsNestedInputSchema } from './UserUpdateOneRequiredWithoutMembershipsNestedInputSchema';
import { OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema } from './OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema';
import { RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema } from './RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema';

export const MembershipUpdateInputSchema: z.ZodType<Prisma.MembershipUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutMembershipsNestedInputSchema).optional(),
  organization: z.lazy(() => OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema).optional(),
  role: z.lazy(() => RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema).optional()
}).strict();

export default MembershipUpdateInputSchema;
