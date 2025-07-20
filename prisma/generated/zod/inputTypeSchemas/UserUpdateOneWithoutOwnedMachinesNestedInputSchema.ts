import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutOwnedMachinesInputSchema } from './UserCreateWithoutOwnedMachinesInputSchema';
import { UserUncheckedCreateWithoutOwnedMachinesInputSchema } from './UserUncheckedCreateWithoutOwnedMachinesInputSchema';
import { UserCreateOrConnectWithoutOwnedMachinesInputSchema } from './UserCreateOrConnectWithoutOwnedMachinesInputSchema';
import { UserUpsertWithoutOwnedMachinesInputSchema } from './UserUpsertWithoutOwnedMachinesInputSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';
import { UserUpdateToOneWithWhereWithoutOwnedMachinesInputSchema } from './UserUpdateToOneWithWhereWithoutOwnedMachinesInputSchema';
import { UserUpdateWithoutOwnedMachinesInputSchema } from './UserUpdateWithoutOwnedMachinesInputSchema';
import { UserUncheckedUpdateWithoutOwnedMachinesInputSchema } from './UserUncheckedUpdateWithoutOwnedMachinesInputSchema';

export const UserUpdateOneWithoutOwnedMachinesNestedInputSchema: z.ZodType<Prisma.UserUpdateOneWithoutOwnedMachinesNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutOwnedMachinesInputSchema),z.lazy(() => UserUncheckedCreateWithoutOwnedMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutOwnedMachinesInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutOwnedMachinesInputSchema).optional(),
  disconnect: z.union([ z.boolean(),z.lazy(() => UserWhereInputSchema) ]).optional(),
  delete: z.union([ z.boolean(),z.lazy(() => UserWhereInputSchema) ]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutOwnedMachinesInputSchema),z.lazy(() => UserUpdateWithoutOwnedMachinesInputSchema),z.lazy(() => UserUncheckedUpdateWithoutOwnedMachinesInputSchema) ]).optional(),
}).strict();

export default UserUpdateOneWithoutOwnedMachinesNestedInputSchema;
