import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutMembershipsInputSchema } from './UserCreateWithoutMembershipsInputSchema';
import { UserUncheckedCreateWithoutMembershipsInputSchema } from './UserUncheckedCreateWithoutMembershipsInputSchema';
import { UserCreateOrConnectWithoutMembershipsInputSchema } from './UserCreateOrConnectWithoutMembershipsInputSchema';
import { UserUpsertWithoutMembershipsInputSchema } from './UserUpsertWithoutMembershipsInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserUpdateToOneWithWhereWithoutMembershipsInputSchema } from './UserUpdateToOneWithWhereWithoutMembershipsInputSchema';
import { UserUpdateWithoutMembershipsInputSchema } from './UserUpdateWithoutMembershipsInputSchema';
import { UserUncheckedUpdateWithoutMembershipsInputSchema } from './UserUncheckedUpdateWithoutMembershipsInputSchema';

export const UserUpdateOneRequiredWithoutMembershipsNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutMembershipsNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutMembershipsInputSchema),z.lazy(() => UserUncheckedCreateWithoutMembershipsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutMembershipsInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutMembershipsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutMembershipsInputSchema),z.lazy(() => UserUpdateWithoutMembershipsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutMembershipsInputSchema) ]).optional(),
}).strict();

export default UserUpdateOneRequiredWithoutMembershipsNestedInputSchema;
