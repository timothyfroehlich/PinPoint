import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutCommentsInputSchema } from './UserCreateWithoutCommentsInputSchema';
import { UserUncheckedCreateWithoutCommentsInputSchema } from './UserUncheckedCreateWithoutCommentsInputSchema';
import { UserCreateOrConnectWithoutCommentsInputSchema } from './UserCreateOrConnectWithoutCommentsInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutCommentsInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutCommentsInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutCommentsInputSchema),z.lazy(() => UserUncheckedCreateWithoutCommentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCommentsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutCommentsInputSchema;
