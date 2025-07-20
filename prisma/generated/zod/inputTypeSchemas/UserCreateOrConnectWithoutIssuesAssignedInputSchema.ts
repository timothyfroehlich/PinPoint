import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserCreateWithoutIssuesAssignedInputSchema } from './UserCreateWithoutIssuesAssignedInputSchema';
import { UserUncheckedCreateWithoutIssuesAssignedInputSchema } from './UserUncheckedCreateWithoutIssuesAssignedInputSchema';

export const UserCreateOrConnectWithoutIssuesAssignedInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutIssuesAssignedInput> = z.object({
  where: z.lazy(() => UserWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UserCreateWithoutIssuesAssignedInputSchema),z.lazy(() => UserUncheckedCreateWithoutIssuesAssignedInputSchema) ]),
}).strict();

export default UserCreateOrConnectWithoutIssuesAssignedInputSchema;
