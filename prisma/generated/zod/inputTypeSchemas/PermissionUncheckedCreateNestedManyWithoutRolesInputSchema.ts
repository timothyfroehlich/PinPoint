import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PermissionCreateWithoutRolesInputSchema } from './PermissionCreateWithoutRolesInputSchema';
import { PermissionUncheckedCreateWithoutRolesInputSchema } from './PermissionUncheckedCreateWithoutRolesInputSchema';
import { PermissionCreateOrConnectWithoutRolesInputSchema } from './PermissionCreateOrConnectWithoutRolesInputSchema';
import { PermissionWhereUniqueInputSchema } from './PermissionWhereUniqueInputSchema';

export const PermissionUncheckedCreateNestedManyWithoutRolesInputSchema: z.ZodType<Prisma.PermissionUncheckedCreateNestedManyWithoutRolesInput> = z.object({
  create: z.union([ z.lazy(() => PermissionCreateWithoutRolesInputSchema),z.lazy(() => PermissionCreateWithoutRolesInputSchema).array(),z.lazy(() => PermissionUncheckedCreateWithoutRolesInputSchema),z.lazy(() => PermissionUncheckedCreateWithoutRolesInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => PermissionCreateOrConnectWithoutRolesInputSchema),z.lazy(() => PermissionCreateOrConnectWithoutRolesInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => PermissionWhereUniqueInputSchema),z.lazy(() => PermissionWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default PermissionUncheckedCreateNestedManyWithoutRolesInputSchema;
