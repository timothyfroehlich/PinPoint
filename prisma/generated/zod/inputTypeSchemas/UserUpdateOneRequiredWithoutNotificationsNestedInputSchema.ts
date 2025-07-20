import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutNotificationsInputSchema } from './UserCreateWithoutNotificationsInputSchema';
import { UserUncheckedCreateWithoutNotificationsInputSchema } from './UserUncheckedCreateWithoutNotificationsInputSchema';
import { UserCreateOrConnectWithoutNotificationsInputSchema } from './UserCreateOrConnectWithoutNotificationsInputSchema';
import { UserUpsertWithoutNotificationsInputSchema } from './UserUpsertWithoutNotificationsInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserUpdateToOneWithWhereWithoutNotificationsInputSchema } from './UserUpdateToOneWithWhereWithoutNotificationsInputSchema';
import { UserUpdateWithoutNotificationsInputSchema } from './UserUpdateWithoutNotificationsInputSchema';
import { UserUncheckedUpdateWithoutNotificationsInputSchema } from './UserUncheckedUpdateWithoutNotificationsInputSchema';

export const UserUpdateOneRequiredWithoutNotificationsNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutNotificationsNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutNotificationsInputSchema),z.lazy(() => UserUncheckedCreateWithoutNotificationsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutNotificationsInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutNotificationsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutNotificationsInputSchema),z.lazy(() => UserUpdateWithoutNotificationsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutNotificationsInputSchema) ]).optional(),
}).strict();

export default UserUpdateOneRequiredWithoutNotificationsNestedInputSchema;
