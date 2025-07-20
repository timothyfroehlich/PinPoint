import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserUpdateWithoutIssuesCreatedInputSchema } from './UserUpdateWithoutIssuesCreatedInputSchema';
import { UserUncheckedUpdateWithoutIssuesCreatedInputSchema } from './UserUncheckedUpdateWithoutIssuesCreatedInputSchema';
import { UserCreateWithoutIssuesCreatedInputSchema } from './UserCreateWithoutIssuesCreatedInputSchema';
import { UserUncheckedCreateWithoutIssuesCreatedInputSchema } from './UserUncheckedCreateWithoutIssuesCreatedInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UserUpsertWithoutIssuesCreatedInputSchema: z.ZodType<Prisma.UserUpsertWithoutIssuesCreatedInput> = z.object({
  update: z.union([ z.lazy(() => UserUpdateWithoutIssuesCreatedInputSchema),z.lazy(() => UserUncheckedUpdateWithoutIssuesCreatedInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutIssuesCreatedInputSchema),z.lazy(() => UserUncheckedCreateWithoutIssuesCreatedInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export default UserUpsertWithoutIssuesCreatedInputSchema;
