import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const PermissionCreateManyInputSchema: z.ZodType<Prisma.PermissionCreateManyInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string()
}).strict();

export default PermissionCreateManyInputSchema;
