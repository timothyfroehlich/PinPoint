import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserUpdateWithoutIssuesAssignedInputSchema } from './UserUpdateWithoutIssuesAssignedInputSchema';
import { UserUncheckedUpdateWithoutIssuesAssignedInputSchema } from './UserUncheckedUpdateWithoutIssuesAssignedInputSchema';
import { UserCreateWithoutIssuesAssignedInputSchema } from './UserCreateWithoutIssuesAssignedInputSchema';
import { UserUncheckedCreateWithoutIssuesAssignedInputSchema } from './UserUncheckedCreateWithoutIssuesAssignedInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UserUpsertWithoutIssuesAssignedInputSchema: z.ZodType<Prisma.UserUpsertWithoutIssuesAssignedInput> = z.object({
  update: z.union([ z.lazy(() => UserUpdateWithoutIssuesAssignedInputSchema),z.lazy(() => UserUncheckedUpdateWithoutIssuesAssignedInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutIssuesAssignedInputSchema),z.lazy(() => UserUncheckedCreateWithoutIssuesAssignedInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export default UserUpsertWithoutIssuesAssignedInputSchema;
