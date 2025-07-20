import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PermissionWhereUniqueInputSchema } from './PermissionWhereUniqueInputSchema';
import { PermissionUpdateWithoutRolesInputSchema } from './PermissionUpdateWithoutRolesInputSchema';
import { PermissionUncheckedUpdateWithoutRolesInputSchema } from './PermissionUncheckedUpdateWithoutRolesInputSchema';

export const PermissionUpdateWithWhereUniqueWithoutRolesInputSchema: z.ZodType<Prisma.PermissionUpdateWithWhereUniqueWithoutRolesInput> = z.object({
  where: z.lazy(() => PermissionWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => PermissionUpdateWithoutRolesInputSchema),z.lazy(() => PermissionUncheckedUpdateWithoutRolesInputSchema) ]),
}).strict();

export default PermissionUpdateWithWhereUniqueWithoutRolesInputSchema;
