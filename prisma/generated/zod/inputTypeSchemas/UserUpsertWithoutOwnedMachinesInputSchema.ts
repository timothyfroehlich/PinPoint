import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserUpdateWithoutOwnedMachinesInputSchema } from './UserUpdateWithoutOwnedMachinesInputSchema';
import { UserUncheckedUpdateWithoutOwnedMachinesInputSchema } from './UserUncheckedUpdateWithoutOwnedMachinesInputSchema';
import { UserCreateWithoutOwnedMachinesInputSchema } from './UserCreateWithoutOwnedMachinesInputSchema';
import { UserUncheckedCreateWithoutOwnedMachinesInputSchema } from './UserUncheckedCreateWithoutOwnedMachinesInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UserUpsertWithoutOwnedMachinesInputSchema: z.ZodType<Prisma.UserUpsertWithoutOwnedMachinesInput> = z.object({
  update: z.union([ z.lazy(() => UserUpdateWithoutOwnedMachinesInputSchema),z.lazy(() => UserUncheckedUpdateWithoutOwnedMachinesInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutOwnedMachinesInputSchema),z.lazy(() => UserUncheckedCreateWithoutOwnedMachinesInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export default UserUpsertWithoutOwnedMachinesInputSchema;
