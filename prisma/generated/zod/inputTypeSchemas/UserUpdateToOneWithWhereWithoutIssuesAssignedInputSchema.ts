import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { UserUpdateWithoutIssuesAssignedInputSchema } from './UserUpdateWithoutIssuesAssignedInputSchema';
import { UserUncheckedUpdateWithoutIssuesAssignedInputSchema } from './UserUncheckedUpdateWithoutIssuesAssignedInputSchema';

export const UserUpdateToOneWithWhereWithoutIssuesAssignedInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutIssuesAssignedInput> = z.object({
  where: z.lazy(() => UserWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => UserUpdateWithoutIssuesAssignedInputSchema),z.lazy(() => UserUncheckedUpdateWithoutIssuesAssignedInputSchema) ]),
}).strict();

export default UserUpdateToOneWithWhereWithoutIssuesAssignedInputSchema;
