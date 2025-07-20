import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutDeletedCommentsInputSchema } from './UserCreateWithoutDeletedCommentsInputSchema';
import { UserUncheckedCreateWithoutDeletedCommentsInputSchema } from './UserUncheckedCreateWithoutDeletedCommentsInputSchema';
import { UserCreateOrConnectWithoutDeletedCommentsInputSchema } from './UserCreateOrConnectWithoutDeletedCommentsInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutDeletedCommentsInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutDeletedCommentsInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutDeletedCommentsInputSchema),z.lazy(() => UserUncheckedCreateWithoutDeletedCommentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutDeletedCommentsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutDeletedCommentsInputSchema;
