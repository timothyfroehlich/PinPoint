import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PermissionCreateWithoutRolesInputSchema } from './PermissionCreateWithoutRolesInputSchema';
import { PermissionUncheckedCreateWithoutRolesInputSchema } from './PermissionUncheckedCreateWithoutRolesInputSchema';
import { PermissionCreateOrConnectWithoutRolesInputSchema } from './PermissionCreateOrConnectWithoutRolesInputSchema';
import { PermissionUpsertWithWhereUniqueWithoutRolesInputSchema } from './PermissionUpsertWithWhereUniqueWithoutRolesInputSchema';
import { PermissionWhereUniqueInputSchema } from './PermissionWhereUniqueInputSchema';
import { PermissionUpdateWithWhereUniqueWithoutRolesInputSchema } from './PermissionUpdateWithWhereUniqueWithoutRolesInputSchema';
import { PermissionUpdateManyWithWhereWithoutRolesInputSchema } from './PermissionUpdateManyWithWhereWithoutRolesInputSchema';
import { PermissionScalarWhereInputSchema } from './PermissionScalarWhereInputSchema';

export const PermissionUncheckedUpdateManyWithoutRolesNestedInputSchema: z.ZodType<Prisma.PermissionUncheckedUpdateManyWithoutRolesNestedInput> = z.object({
  create: z.union([ z.lazy(() => PermissionCreateWithoutRolesInputSchema),z.lazy(() => PermissionCreateWithoutRolesInputSchema).array(),z.lazy(() => PermissionUncheckedCreateWithoutRolesInputSchema),z.lazy(() => PermissionUncheckedCreateWithoutRolesInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => PermissionCreateOrConnectWithoutRolesInputSchema),z.lazy(() => PermissionCreateOrConnectWithoutRolesInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => PermissionUpsertWithWhereUniqueWithoutRolesInputSchema),z.lazy(() => PermissionUpsertWithWhereUniqueWithoutRolesInputSchema).array() ]).optional(),
  set: z.union([ z.lazy(() => PermissionWhereUniqueInputSchema),z.lazy(() => PermissionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => PermissionWhereUniqueInputSchema),z.lazy(() => PermissionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => PermissionWhereUniqueInputSchema),z.lazy(() => PermissionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => PermissionWhereUniqueInputSchema),z.lazy(() => PermissionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => PermissionUpdateWithWhereUniqueWithoutRolesInputSchema),z.lazy(() => PermissionUpdateWithWhereUniqueWithoutRolesInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => PermissionUpdateManyWithWhereWithoutRolesInputSchema),z.lazy(() => PermissionUpdateManyWithWhereWithoutRolesInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => PermissionScalarWhereInputSchema),z.lazy(() => PermissionScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default PermissionUncheckedUpdateManyWithoutRolesNestedInputSchema;
