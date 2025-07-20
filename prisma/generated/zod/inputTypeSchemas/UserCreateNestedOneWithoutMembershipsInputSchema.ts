import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutMembershipsInputSchema } from './UserCreateWithoutMembershipsInputSchema';
import { UserUncheckedCreateWithoutMembershipsInputSchema } from './UserUncheckedCreateWithoutMembershipsInputSchema';
import { UserCreateOrConnectWithoutMembershipsInputSchema } from './UserCreateOrConnectWithoutMembershipsInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutMembershipsInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutMembershipsInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutMembershipsInputSchema),z.lazy(() => UserUncheckedCreateWithoutMembershipsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutMembershipsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutMembershipsInputSchema;
