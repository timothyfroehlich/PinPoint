import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateNestedOneWithoutPrioritiesInputSchema } from './OrganizationCreateNestedOneWithoutPrioritiesInputSchema';
import { IssueCreateNestedManyWithoutPriorityInputSchema } from './IssueCreateNestedManyWithoutPriorityInputSchema';

export const PriorityCreateInputSchema: z.ZodType<Prisma.PriorityCreateInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  order: z.number().int(),
  isDefault: z.boolean().optional(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutPrioritiesInputSchema),
  issues: z.lazy(() => IssueCreateNestedManyWithoutPriorityInputSchema).optional()
}).strict();

export default PriorityCreateInputSchema;
