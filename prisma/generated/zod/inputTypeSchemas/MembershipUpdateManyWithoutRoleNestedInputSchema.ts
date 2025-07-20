import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipCreateWithoutRoleInputSchema } from './MembershipCreateWithoutRoleInputSchema';
import { MembershipUncheckedCreateWithoutRoleInputSchema } from './MembershipUncheckedCreateWithoutRoleInputSchema';
import { MembershipCreateOrConnectWithoutRoleInputSchema } from './MembershipCreateOrConnectWithoutRoleInputSchema';
import { MembershipUpsertWithWhereUniqueWithoutRoleInputSchema } from './MembershipUpsertWithWhereUniqueWithoutRoleInputSchema';
import { MembershipCreateManyRoleInputEnvelopeSchema } from './MembershipCreateManyRoleInputEnvelopeSchema';
import { MembershipWhereUniqueInputSchema } from './MembershipWhereUniqueInputSchema';
import { MembershipUpdateWithWhereUniqueWithoutRoleInputSchema } from './MembershipUpdateWithWhereUniqueWithoutRoleInputSchema';
import { MembershipUpdateManyWithWhereWithoutRoleInputSchema } from './MembershipUpdateManyWithWhereWithoutRoleInputSchema';
import { MembershipScalarWhereInputSchema } from './MembershipScalarWhereInputSchema';

export const MembershipUpdateManyWithoutRoleNestedInputSchema: z.ZodType<Prisma.MembershipUpdateManyWithoutRoleNestedInput> = z.object({
  create: z.union([ z.lazy(() => MembershipCreateWithoutRoleInputSchema),z.lazy(() => MembershipCreateWithoutRoleInputSchema).array(),z.lazy(() => MembershipUncheckedCreateWithoutRoleInputSchema),z.lazy(() => MembershipUncheckedCreateWithoutRoleInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MembershipCreateOrConnectWithoutRoleInputSchema),z.lazy(() => MembershipCreateOrConnectWithoutRoleInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => MembershipUpsertWithWhereUniqueWithoutRoleInputSchema),z.lazy(() => MembershipUpsertWithWhereUniqueWithoutRoleInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MembershipCreateManyRoleInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => MembershipWhereUniqueInputSchema),z.lazy(() => MembershipWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => MembershipUpdateWithWhereUniqueWithoutRoleInputSchema),z.lazy(() => MembershipUpdateWithWhereUniqueWithoutRoleInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => MembershipUpdateManyWithWhereWithoutRoleInputSchema),z.lazy(() => MembershipUpdateManyWithWhereWithoutRoleInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => MembershipScalarWhereInputSchema),z.lazy(() => MembershipScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default MembershipUpdateManyWithoutRoleNestedInputSchema;
