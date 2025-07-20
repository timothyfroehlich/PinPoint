import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutCommentsInputSchema } from './UserCreateWithoutCommentsInputSchema';
import { UserUncheckedCreateWithoutCommentsInputSchema } from './UserUncheckedCreateWithoutCommentsInputSchema';
import { UserCreateOrConnectWithoutCommentsInputSchema } from './UserCreateOrConnectWithoutCommentsInputSchema';
import { UserUpsertWithoutCommentsInputSchema } from './UserUpsertWithoutCommentsInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserUpdateToOneWithWhereWithoutCommentsInputSchema } from './UserUpdateToOneWithWhereWithoutCommentsInputSchema';
import { UserUpdateWithoutCommentsInputSchema } from './UserUpdateWithoutCommentsInputSchema';
import { UserUncheckedUpdateWithoutCommentsInputSchema } from './UserUncheckedUpdateWithoutCommentsInputSchema';

export const UserUpdateOneRequiredWithoutCommentsNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutCommentsNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutCommentsInputSchema),z.lazy(() => UserUncheckedCreateWithoutCommentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCommentsInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutCommentsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutCommentsInputSchema),z.lazy(() => UserUpdateWithoutCommentsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutCommentsInputSchema) ]).optional(),
}).strict();

export default UserUpdateOneRequiredWithoutCommentsNestedInputSchema;
