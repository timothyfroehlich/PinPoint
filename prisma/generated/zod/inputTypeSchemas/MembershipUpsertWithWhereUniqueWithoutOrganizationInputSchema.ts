import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipWhereUniqueInputSchema } from './MembershipWhereUniqueInputSchema';
import { MembershipUpdateWithoutOrganizationInputSchema } from './MembershipUpdateWithoutOrganizationInputSchema';
import { MembershipUncheckedUpdateWithoutOrganizationInputSchema } from './MembershipUncheckedUpdateWithoutOrganizationInputSchema';
import { MembershipCreateWithoutOrganizationInputSchema } from './MembershipCreateWithoutOrganizationInputSchema';
import { MembershipUncheckedCreateWithoutOrganizationInputSchema } from './MembershipUncheckedCreateWithoutOrganizationInputSchema';

export const MembershipUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipUpsertWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => MembershipWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => MembershipUpdateWithoutOrganizationInputSchema),z.lazy(() => MembershipUncheckedUpdateWithoutOrganizationInputSchema) ]),
  create: z.union([ z.lazy(() => MembershipCreateWithoutOrganizationInputSchema),z.lazy(() => MembershipUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default MembershipUpsertWithWhereUniqueWithoutOrganizationInputSchema;
