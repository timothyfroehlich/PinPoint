import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutIssuesCreatedInputSchema } from './UserCreateWithoutIssuesCreatedInputSchema';
import { UserUncheckedCreateWithoutIssuesCreatedInputSchema } from './UserUncheckedCreateWithoutIssuesCreatedInputSchema';
import { UserCreateOrConnectWithoutIssuesCreatedInputSchema } from './UserCreateOrConnectWithoutIssuesCreatedInputSchema';
import { UserUpsertWithoutIssuesCreatedInputSchema } from './UserUpsertWithoutIssuesCreatedInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserUpdateToOneWithWhereWithoutIssuesCreatedInputSchema } from './UserUpdateToOneWithWhereWithoutIssuesCreatedInputSchema';
import { UserUpdateWithoutIssuesCreatedInputSchema } from './UserUpdateWithoutIssuesCreatedInputSchema';
import { UserUncheckedUpdateWithoutIssuesCreatedInputSchema } from './UserUncheckedUpdateWithoutIssuesCreatedInputSchema';

export const UserUpdateOneRequiredWithoutIssuesCreatedNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutIssuesCreatedNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutIssuesCreatedInputSchema),z.lazy(() => UserUncheckedCreateWithoutIssuesCreatedInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutIssuesCreatedInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutIssuesCreatedInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutIssuesCreatedInputSchema),z.lazy(() => UserUpdateWithoutIssuesCreatedInputSchema),z.lazy(() => UserUncheckedUpdateWithoutIssuesCreatedInputSchema) ]).optional(),
}).strict();

export default UserUpdateOneRequiredWithoutIssuesCreatedNestedInputSchema;
