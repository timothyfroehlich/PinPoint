import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const RoleCreateManyOrganizationInputSchema: z.ZodType<Prisma.RoleCreateManyOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  isDefault: z.boolean().optional()
}).strict();

export default RoleCreateManyOrganizationInputSchema;
