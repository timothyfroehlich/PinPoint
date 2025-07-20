import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleCreateWithoutPermissionsInputSchema } from './RoleCreateWithoutPermissionsInputSchema';
import { RoleUncheckedCreateWithoutPermissionsInputSchema } from './RoleUncheckedCreateWithoutPermissionsInputSchema';
import { RoleCreateOrConnectWithoutPermissionsInputSchema } from './RoleCreateOrConnectWithoutPermissionsInputSchema';
import { RoleUpsertWithWhereUniqueWithoutPermissionsInputSchema } from './RoleUpsertWithWhereUniqueWithoutPermissionsInputSchema';
import { RoleWhereUniqueInputSchema } from './RoleWhereUniqueInputSchema';
import { RoleUpdateWithWhereUniqueWithoutPermissionsInputSchema } from './RoleUpdateWithWhereUniqueWithoutPermissionsInputSchema';
import { RoleUpdateManyWithWhereWithoutPermissionsInputSchema } from './RoleUpdateManyWithWhereWithoutPermissionsInputSchema';
import { RoleScalarWhereInputSchema } from './RoleScalarWhereInputSchema';

export const RoleUpdateManyWithoutPermissionsNestedInputSchema: z.ZodType<Prisma.RoleUpdateManyWithoutPermissionsNestedInput> = z.object({
  create: z.union([ z.lazy(() => RoleCreateWithoutPermissionsInputSchema),z.lazy(() => RoleCreateWithoutPermissionsInputSchema).array(),z.lazy(() => RoleUncheckedCreateWithoutPermissionsInputSchema),z.lazy(() => RoleUncheckedCreateWithoutPermissionsInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => RoleCreateOrConnectWithoutPermissionsInputSchema),z.lazy(() => RoleCreateOrConnectWithoutPermissionsInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => RoleUpsertWithWhereUniqueWithoutPermissionsInputSchema),z.lazy(() => RoleUpsertWithWhereUniqueWithoutPermissionsInputSchema).array() ]).optional(),
  set: z.union([ z.lazy(() => RoleWhereUniqueInputSchema),z.lazy(() => RoleWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => RoleWhereUniqueInputSchema),z.lazy(() => RoleWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => RoleWhereUniqueInputSchema),z.lazy(() => RoleWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => RoleWhereUniqueInputSchema),z.lazy(() => RoleWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => RoleUpdateWithWhereUniqueWithoutPermissionsInputSchema),z.lazy(() => RoleUpdateWithWhereUniqueWithoutPermissionsInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => RoleUpdateManyWithWhereWithoutPermissionsInputSchema),z.lazy(() => RoleUpdateManyWithWhereWithoutPermissionsInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => RoleScalarWhereInputSchema),z.lazy(() => RoleScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default RoleUpdateManyWithoutPermissionsNestedInputSchema;
