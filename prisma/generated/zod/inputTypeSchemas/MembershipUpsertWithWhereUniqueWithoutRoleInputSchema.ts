import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipWhereUniqueInputSchema } from './MembershipWhereUniqueInputSchema';
import { MembershipUpdateWithoutRoleInputSchema } from './MembershipUpdateWithoutRoleInputSchema';
import { MembershipUncheckedUpdateWithoutRoleInputSchema } from './MembershipUncheckedUpdateWithoutRoleInputSchema';
import { MembershipCreateWithoutRoleInputSchema } from './MembershipCreateWithoutRoleInputSchema';
import { MembershipUncheckedCreateWithoutRoleInputSchema } from './MembershipUncheckedCreateWithoutRoleInputSchema';

export const MembershipUpsertWithWhereUniqueWithoutRoleInputSchema: z.ZodType<Prisma.MembershipUpsertWithWhereUniqueWithoutRoleInput> = z.object({
  where: z.lazy(() => MembershipWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => MembershipUpdateWithoutRoleInputSchema),z.lazy(() => MembershipUncheckedUpdateWithoutRoleInputSchema) ]),
  create: z.union([ z.lazy(() => MembershipCreateWithoutRoleInputSchema),z.lazy(() => MembershipUncheckedCreateWithoutRoleInputSchema) ]),
}).strict();

export default MembershipUpsertWithWhereUniqueWithoutRoleInputSchema;
