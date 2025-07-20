import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutActivityHistoryInputSchema } from './UserCreateWithoutActivityHistoryInputSchema';
import { UserUncheckedCreateWithoutActivityHistoryInputSchema } from './UserUncheckedCreateWithoutActivityHistoryInputSchema';
import { UserCreateOrConnectWithoutActivityHistoryInputSchema } from './UserCreateOrConnectWithoutActivityHistoryInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutActivityHistoryInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutActivityHistoryInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutActivityHistoryInputSchema),z.lazy(() => UserUncheckedCreateWithoutActivityHistoryInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutActivityHistoryInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutActivityHistoryInputSchema;
