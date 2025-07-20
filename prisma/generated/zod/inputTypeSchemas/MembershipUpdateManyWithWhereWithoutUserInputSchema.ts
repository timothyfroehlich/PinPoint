import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipScalarWhereInputSchema } from './MembershipScalarWhereInputSchema';
import { MembershipUpdateManyMutationInputSchema } from './MembershipUpdateManyMutationInputSchema';
import { MembershipUncheckedUpdateManyWithoutUserInputSchema } from './MembershipUncheckedUpdateManyWithoutUserInputSchema';

export const MembershipUpdateManyWithWhereWithoutUserInputSchema: z.ZodType<Prisma.MembershipUpdateManyWithWhereWithoutUserInput> = z.object({
  where: z.lazy(() => MembershipScalarWhereInputSchema),
  data: z.union([ z.lazy(() => MembershipUpdateManyMutationInputSchema),z.lazy(() => MembershipUncheckedUpdateManyWithoutUserInputSchema) ]),
}).strict();

export default MembershipUpdateManyWithWhereWithoutUserInputSchema;
