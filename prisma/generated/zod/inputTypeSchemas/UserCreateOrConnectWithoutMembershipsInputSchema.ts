import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserCreateWithoutMembershipsInputSchema } from './UserCreateWithoutMembershipsInputSchema';
import { UserUncheckedCreateWithoutMembershipsInputSchema } from './UserUncheckedCreateWithoutMembershipsInputSchema';

export const UserCreateOrConnectWithoutMembershipsInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutMembershipsInput> = z.object({
  where: z.lazy(() => UserWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UserCreateWithoutMembershipsInputSchema),z.lazy(() => UserUncheckedCreateWithoutMembershipsInputSchema) ]),
}).strict();

export default UserCreateOrConnectWithoutMembershipsInputSchema;
