import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const PriorityCreateManyOrganizationInputSchema: z.ZodType<Prisma.PriorityCreateManyOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  order: z.number().int(),
  isDefault: z.boolean().optional()
}).strict();

export default PriorityCreateManyOrganizationInputSchema;
