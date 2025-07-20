import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserUpdateWithoutMembershipsInputSchema } from './UserUpdateWithoutMembershipsInputSchema';
import { UserUncheckedUpdateWithoutMembershipsInputSchema } from './UserUncheckedUpdateWithoutMembershipsInputSchema';
import { UserCreateWithoutMembershipsInputSchema } from './UserCreateWithoutMembershipsInputSchema';
import { UserUncheckedCreateWithoutMembershipsInputSchema } from './UserUncheckedCreateWithoutMembershipsInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UserUpsertWithoutMembershipsInputSchema: z.ZodType<Prisma.UserUpsertWithoutMembershipsInput> = z.object({
  update: z.union([ z.lazy(() => UserUpdateWithoutMembershipsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutMembershipsInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutMembershipsInputSchema),z.lazy(() => UserUncheckedCreateWithoutMembershipsInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export default UserUpsertWithoutMembershipsInputSchema;
