import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const PriorityUncheckedCreateWithoutIssuesInputSchema: z.ZodType<Prisma.PriorityUncheckedCreateWithoutIssuesInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  order: z.number().int(),
  organizationId: z.string(),
  isDefault: z.boolean().optional()
}).strict();

export default PriorityUncheckedCreateWithoutIssuesInputSchema;
