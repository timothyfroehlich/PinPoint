import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleWhereUniqueInputSchema } from './RoleWhereUniqueInputSchema';
import { RoleUpdateWithoutPermissionsInputSchema } from './RoleUpdateWithoutPermissionsInputSchema';
import { RoleUncheckedUpdateWithoutPermissionsInputSchema } from './RoleUncheckedUpdateWithoutPermissionsInputSchema';
import { RoleCreateWithoutPermissionsInputSchema } from './RoleCreateWithoutPermissionsInputSchema';
import { RoleUncheckedCreateWithoutPermissionsInputSchema } from './RoleUncheckedCreateWithoutPermissionsInputSchema';

export const RoleUpsertWithWhereUniqueWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleUpsertWithWhereUniqueWithoutPermissionsInput> = z.object({
  where: z.lazy(() => RoleWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => RoleUpdateWithoutPermissionsInputSchema),z.lazy(() => RoleUncheckedUpdateWithoutPermissionsInputSchema) ]),
  create: z.union([ z.lazy(() => RoleCreateWithoutPermissionsInputSchema),z.lazy(() => RoleUncheckedCreateWithoutPermissionsInputSchema) ]),
}).strict();

export default RoleUpsertWithWhereUniqueWithoutPermissionsInputSchema;
