import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserUpdateWithoutCommentsInputSchema } from './UserUpdateWithoutCommentsInputSchema';
import { UserUncheckedUpdateWithoutCommentsInputSchema } from './UserUncheckedUpdateWithoutCommentsInputSchema';
import { UserCreateWithoutCommentsInputSchema } from './UserCreateWithoutCommentsInputSchema';
import { UserUncheckedCreateWithoutCommentsInputSchema } from './UserUncheckedCreateWithoutCommentsInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UserUpsertWithoutCommentsInputSchema: z.ZodType<Prisma.UserUpsertWithoutCommentsInput> = z.object({
  update: z.union([ z.lazy(() => UserUpdateWithoutCommentsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutCommentsInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutCommentsInputSchema),z.lazy(() => UserUncheckedCreateWithoutCommentsInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export default UserUpsertWithoutCommentsInputSchema;
