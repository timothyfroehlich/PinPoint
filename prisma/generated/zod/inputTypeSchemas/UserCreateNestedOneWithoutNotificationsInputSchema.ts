import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutNotificationsInputSchema } from './UserCreateWithoutNotificationsInputSchema';
import { UserUncheckedCreateWithoutNotificationsInputSchema } from './UserUncheckedCreateWithoutNotificationsInputSchema';
import { UserCreateOrConnectWithoutNotificationsInputSchema } from './UserCreateOrConnectWithoutNotificationsInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutNotificationsInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutNotificationsInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutNotificationsInputSchema),z.lazy(() => UserUncheckedCreateWithoutNotificationsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutNotificationsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutNotificationsInputSchema;
