import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleWhereUniqueInputSchema } from './RoleWhereUniqueInputSchema';
import { RoleCreateWithoutPermissionsInputSchema } from './RoleCreateWithoutPermissionsInputSchema';
import { RoleUncheckedCreateWithoutPermissionsInputSchema } from './RoleUncheckedCreateWithoutPermissionsInputSchema';

export const RoleCreateOrConnectWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleCreateOrConnectWithoutPermissionsInput> = z.object({
  where: z.lazy(() => RoleWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => RoleCreateWithoutPermissionsInputSchema),z.lazy(() => RoleUncheckedCreateWithoutPermissionsInputSchema) ]),
}).strict();

export default RoleCreateOrConnectWithoutPermissionsInputSchema;
