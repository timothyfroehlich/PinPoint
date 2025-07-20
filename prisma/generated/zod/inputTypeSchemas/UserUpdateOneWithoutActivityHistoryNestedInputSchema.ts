import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutActivityHistoryInputSchema } from './UserCreateWithoutActivityHistoryInputSchema';
import { UserUncheckedCreateWithoutActivityHistoryInputSchema } from './UserUncheckedCreateWithoutActivityHistoryInputSchema';
import { UserCreateOrConnectWithoutActivityHistoryInputSchema } from './UserCreateOrConnectWithoutActivityHistoryInputSchema';
import { UserUpsertWithoutActivityHistoryInputSchema } from './UserUpsertWithoutActivityHistoryInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserUpdateToOneWithWhereWithoutActivityHistoryInputSchema } from './UserUpdateToOneWithWhereWithoutActivityHistoryInputSchema';
import { UserUpdateWithoutActivityHistoryInputSchema } from './UserUpdateWithoutActivityHistoryInputSchema';
import { UserUncheckedUpdateWithoutActivityHistoryInputSchema } from './UserUncheckedUpdateWithoutActivityHistoryInputSchema';

export const UserUpdateOneWithoutActivityHistoryNestedInputSchema: z.ZodType<Prisma.UserUpdateOneWithoutActivityHistoryNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutActivityHistoryInputSchema),z.lazy(() => UserUncheckedCreateWithoutActivityHistoryInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutActivityHistoryInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutActivityHistoryInputSchema).optional(),
  disconnect: z.union([ z.boolean(),z.lazy(() => UserWhereInputSchema) ]).optional(),
  delete: z.union([ z.boolean(),z.lazy(() => UserWhereInputSchema) ]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutActivityHistoryInputSchema),z.lazy(() => UserUpdateWithoutActivityHistoryInputSchema),z.lazy(() => UserUncheckedUpdateWithoutActivityHistoryInputSchema) ]).optional(),
}).strict();

export default UserUpdateOneWithoutActivityHistoryNestedInputSchema;
