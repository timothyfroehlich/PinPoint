import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueUncheckedCreateNestedManyWithoutPriorityInputSchema } from './IssueUncheckedCreateNestedManyWithoutPriorityInputSchema';

export const PriorityUncheckedCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityUncheckedCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  order: z.number().int(),
  isDefault: z.boolean().optional(),
  issues: z.lazy(() => IssueUncheckedCreateNestedManyWithoutPriorityInputSchema).optional()
}).strict();

export default PriorityUncheckedCreateWithoutOrganizationInputSchema;
