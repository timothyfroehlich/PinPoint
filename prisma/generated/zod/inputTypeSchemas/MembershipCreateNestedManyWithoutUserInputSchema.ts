import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipCreateWithoutUserInputSchema } from './MembershipCreateWithoutUserInputSchema';
import { MembershipUncheckedCreateWithoutUserInputSchema } from './MembershipUncheckedCreateWithoutUserInputSchema';
import { MembershipCreateOrConnectWithoutUserInputSchema } from './MembershipCreateOrConnectWithoutUserInputSchema';
import { MembershipCreateManyUserInputEnvelopeSchema } from './MembershipCreateManyUserInputEnvelopeSchema';
import { MembershipWhereUniqueInputSchema } from './MembershipWhereUniqueInputSchema';

export const MembershipCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.MembershipCreateNestedManyWithoutUserInput> = z.object({
  create: z.union([ z.lazy(() => MembershipCreateWithoutUserInputSchema),z.lazy(() => MembershipCreateWithoutUserInputSchema).array(),z.lazy(() => MembershipUncheckedCreateWithoutUserInputSchema),z.lazy(() => MembershipUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MembershipCreateOrConnectWithoutUserInputSchema),z.lazy(() => MembershipCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MembershipCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default MembershipCreateNestedManyWithoutUserInputSchema;
