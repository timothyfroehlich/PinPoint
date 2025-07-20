import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipCreateWithoutOrganizationInputSchema } from './MembershipCreateWithoutOrganizationInputSchema';
import { MembershipUncheckedCreateWithoutOrganizationInputSchema } from './MembershipUncheckedCreateWithoutOrganizationInputSchema';
import { MembershipCreateOrConnectWithoutOrganizationInputSchema } from './MembershipCreateOrConnectWithoutOrganizationInputSchema';
import { MembershipCreateManyOrganizationInputEnvelopeSchema } from './MembershipCreateManyOrganizationInputEnvelopeSchema';
import { MembershipWhereUniqueInputSchema } from './MembershipWhereUniqueInputSchema';

export const MembershipUncheckedCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipUncheckedCreateNestedManyWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => MembershipCreateWithoutOrganizationInputSchema),z.lazy(() => MembershipCreateWithoutOrganizationInputSchema).array(),z.lazy(() => MembershipUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => MembershipUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MembershipCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => MembershipCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MembershipCreateManyOrganizationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default MembershipUncheckedCreateNestedManyWithoutOrganizationInputSchema;
