import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const PermissionUncheckedCreateWithoutRolesInputSchema: z.ZodType<Prisma.PermissionUncheckedCreateWithoutRolesInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string()
}).strict();

export default PermissionUncheckedCreateWithoutRolesInputSchema;
