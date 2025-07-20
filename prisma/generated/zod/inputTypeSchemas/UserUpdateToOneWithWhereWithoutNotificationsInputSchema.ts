import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { UserUpdateWithoutNotificationsInputSchema } from './UserUpdateWithoutNotificationsInputSchema';
import { UserUncheckedUpdateWithoutNotificationsInputSchema } from './UserUncheckedUpdateWithoutNotificationsInputSchema';

export const UserUpdateToOneWithWhereWithoutNotificationsInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutNotificationsInput> = z.object({
  where: z.lazy(() => UserWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => UserUpdateWithoutNotificationsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutNotificationsInputSchema) ]),
}).strict();

export default UserUpdateToOneWithWhereWithoutNotificationsInputSchema;
