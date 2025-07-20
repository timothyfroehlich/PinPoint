import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutDeletedCommentsInputSchema } from './UserCreateWithoutDeletedCommentsInputSchema';
import { UserUncheckedCreateWithoutDeletedCommentsInputSchema } from './UserUncheckedCreateWithoutDeletedCommentsInputSchema';
import { UserCreateOrConnectWithoutDeletedCommentsInputSchema } from './UserCreateOrConnectWithoutDeletedCommentsInputSchema';
import { UserUpsertWithoutDeletedCommentsInputSchema } from './UserUpsertWithoutDeletedCommentsInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserUpdateToOneWithWhereWithoutDeletedCommentsInputSchema } from './UserUpdateToOneWithWhereWithoutDeletedCommentsInputSchema';
import { UserUpdateWithoutDeletedCommentsInputSchema } from './UserUpdateWithoutDeletedCommentsInputSchema';
import { UserUncheckedUpdateWithoutDeletedCommentsInputSchema } from './UserUncheckedUpdateWithoutDeletedCommentsInputSchema';

export const UserUpdateOneWithoutDeletedCommentsNestedInputSchema: z.ZodType<Prisma.UserUpdateOneWithoutDeletedCommentsNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutDeletedCommentsInputSchema),z.lazy(() => UserUncheckedCreateWithoutDeletedCommentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutDeletedCommentsInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutDeletedCommentsInputSchema).optional(),
  disconnect: z.union([ z.boolean(),z.lazy(() => UserWhereInputSchema) ]).optional(),
  delete: z.union([ z.boolean(),z.lazy(() => UserWhereInputSchema) ]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutDeletedCommentsInputSchema),z.lazy(() => UserUpdateWithoutDeletedCommentsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutDeletedCommentsInputSchema) ]).optional(),
}).strict();

export default UserUpdateOneWithoutDeletedCommentsNestedInputSchema;
