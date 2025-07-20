import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserUpdateWithoutNotificationsInputSchema } from './UserUpdateWithoutNotificationsInputSchema';
import { UserUncheckedUpdateWithoutNotificationsInputSchema } from './UserUncheckedUpdateWithoutNotificationsInputSchema';
import { UserCreateWithoutNotificationsInputSchema } from './UserCreateWithoutNotificationsInputSchema';
import { UserUncheckedCreateWithoutNotificationsInputSchema } from './UserUncheckedCreateWithoutNotificationsInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UserUpsertWithoutNotificationsInputSchema: z.ZodType<Prisma.UserUpsertWithoutNotificationsInput> = z.object({
  update: z.union([ z.lazy(() => UserUpdateWithoutNotificationsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutNotificationsInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutNotificationsInputSchema),z.lazy(() => UserUncheckedCreateWithoutNotificationsInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export default UserUpsertWithoutNotificationsInputSchema;
