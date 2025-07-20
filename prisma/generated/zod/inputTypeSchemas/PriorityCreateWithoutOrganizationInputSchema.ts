import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateNestedManyWithoutPriorityInputSchema } from './IssueCreateNestedManyWithoutPriorityInputSchema';

export const PriorityCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  order: z.number().int(),
  isDefault: z.boolean().optional(),
  issues: z.lazy(() => IssueCreateNestedManyWithoutPriorityInputSchema).optional()
}).strict();

export default PriorityCreateWithoutOrganizationInputSchema;
