import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutOwnedMachinesInputSchema } from './UserCreateWithoutOwnedMachinesInputSchema';
import { UserUncheckedCreateWithoutOwnedMachinesInputSchema } from './UserUncheckedCreateWithoutOwnedMachinesInputSchema';
import { UserCreateOrConnectWithoutOwnedMachinesInputSchema } from './UserCreateOrConnectWithoutOwnedMachinesInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutOwnedMachinesInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutOwnedMachinesInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutOwnedMachinesInputSchema),z.lazy(() => UserUncheckedCreateWithoutOwnedMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutOwnedMachinesInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutOwnedMachinesInputSchema;
