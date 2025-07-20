import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipCreateWithoutUserInputSchema } from './MembershipCreateWithoutUserInputSchema';
import { MembershipUncheckedCreateWithoutUserInputSchema } from './MembershipUncheckedCreateWithoutUserInputSchema';
import { MembershipCreateOrConnectWithoutUserInputSchema } from './MembershipCreateOrConnectWithoutUserInputSchema';
import { MembershipUpsertWithWhereUniqueWithoutUserInputSchema } from './MembershipUpsertWithWhereUniqueWithoutUserInputSchema';
import { MembershipCreateManyUserInputEnvelopeSchema } from './MembershipCreateManyUserInputEnvelopeSchema';
import { MembershipWhereUniqueInputSchema } from './MembershipWhereUniqueInputSchema';
import { MembershipUpdateWithWhereUniqueWithoutUserInputSchema } from './MembershipUpdateWithWhereUniqueWithoutUserInputSchema';
import { MembershipUpdateManyWithWhereWithoutUserInputSchema } from './MembershipUpdateManyWithWhereWithoutUserInputSchema';
import { MembershipScalarWhereInputSchema } from './MembershipScalarWhereInputSchema';

export const MembershipUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.MembershipUpdateManyWithoutUserNestedInput> = z.object({
  create: z.union([ z.lazy(() => MembershipCreateWithoutUserInputSchema),z.lazy(() => MembershipCreateWithoutUserInputSchema).array(),z.lazy(() => MembershipUncheckedCreateWithoutUserInputSchema),z.lazy(() => MembershipUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MembershipCreateOrConnectWithoutUserInputSchema),z.lazy(() => MembershipCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => MembershipUpsertWithWhereUniqueWithoutUserInputSchema),z.lazy(() => MembershipUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MembershipCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => MembershipUpdateWithWhereUniqueWithoutUserInputSchema),z.lazy(() => MembershipUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => MembershipUpdateManyWithWhereWithoutUserInputSchema),z.lazy(() => MembershipUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => MembershipScalarWhereInputSchema),z.lazy(() => MembershipScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default MembershipUpdateManyWithoutUserNestedInputSchema;
