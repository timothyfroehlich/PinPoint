import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipWhereUniqueInputSchema } from './MembershipWhereUniqueInputSchema';
import { MembershipUpdateWithoutRoleInputSchema } from './MembershipUpdateWithoutRoleInputSchema';
import { MembershipUncheckedUpdateWithoutRoleInputSchema } from './MembershipUncheckedUpdateWithoutRoleInputSchema';

export const MembershipUpdateWithWhereUniqueWithoutRoleInputSchema: z.ZodType<Prisma.MembershipUpdateWithWhereUniqueWithoutRoleInput> = z.object({
  where: z.lazy(() => MembershipWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => MembershipUpdateWithoutRoleInputSchema),z.lazy(() => MembershipUncheckedUpdateWithoutRoleInputSchema) ]),
}).strict();

export default MembershipUpdateWithWhereUniqueWithoutRoleInputSchema;
