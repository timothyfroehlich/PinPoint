import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutIssuesCreatedInputSchema } from './UserCreateWithoutIssuesCreatedInputSchema';
import { UserUncheckedCreateWithoutIssuesCreatedInputSchema } from './UserUncheckedCreateWithoutIssuesCreatedInputSchema';
import { UserCreateOrConnectWithoutIssuesCreatedInputSchema } from './UserCreateOrConnectWithoutIssuesCreatedInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutIssuesCreatedInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutIssuesCreatedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutIssuesCreatedInputSchema),z.lazy(() => UserUncheckedCreateWithoutIssuesCreatedInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutIssuesCreatedInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutIssuesCreatedInputSchema;
