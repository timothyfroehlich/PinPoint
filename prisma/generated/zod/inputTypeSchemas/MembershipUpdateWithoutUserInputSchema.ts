import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema } from './OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema';
import { RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema } from './RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema';

export const MembershipUpdateWithoutUserInputSchema: z.ZodType<Prisma.MembershipUpdateWithoutUserInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  organization: z.lazy(() => OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema).optional(),
  role: z.lazy(() => RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema).optional()
}).strict();

export default MembershipUpdateWithoutUserInputSchema;
