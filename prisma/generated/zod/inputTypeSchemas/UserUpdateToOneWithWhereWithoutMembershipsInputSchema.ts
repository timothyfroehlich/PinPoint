import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { UserUpdateWithoutMembershipsInputSchema } from './UserUpdateWithoutMembershipsInputSchema';
import { UserUncheckedUpdateWithoutMembershipsInputSchema } from './UserUncheckedUpdateWithoutMembershipsInputSchema';

export const UserUpdateToOneWithWhereWithoutMembershipsInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutMembershipsInput> = z.object({
  where: z.lazy(() => UserWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => UserUpdateWithoutMembershipsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutMembershipsInputSchema) ]),
}).strict();

export default UserUpdateToOneWithWhereWithoutMembershipsInputSchema;
