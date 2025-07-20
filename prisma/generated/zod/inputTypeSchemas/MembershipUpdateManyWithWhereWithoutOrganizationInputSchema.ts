import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipScalarWhereInputSchema } from './MembershipScalarWhereInputSchema';
import { MembershipUpdateManyMutationInputSchema } from './MembershipUpdateManyMutationInputSchema';
import { MembershipUncheckedUpdateManyWithoutOrganizationInputSchema } from './MembershipUncheckedUpdateManyWithoutOrganizationInputSchema';

export const MembershipUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => MembershipScalarWhereInputSchema),
  data: z.union([ z.lazy(() => MembershipUpdateManyMutationInputSchema),z.lazy(() => MembershipUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default MembershipUpdateManyWithWhereWithoutOrganizationInputSchema;
