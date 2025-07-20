import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserCreateWithoutDeletedCommentsInputSchema } from './UserCreateWithoutDeletedCommentsInputSchema';
import { UserUncheckedCreateWithoutDeletedCommentsInputSchema } from './UserUncheckedCreateWithoutDeletedCommentsInputSchema';

export const UserCreateOrConnectWithoutDeletedCommentsInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutDeletedCommentsInput> = z.object({
  where: z.lazy(() => UserWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UserCreateWithoutDeletedCommentsInputSchema),z.lazy(() => UserUncheckedCreateWithoutDeletedCommentsInputSchema) ]),
}).strict();

export default UserCreateOrConnectWithoutDeletedCommentsInputSchema;
