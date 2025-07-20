import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StatusCategorySchema } from './StatusCategorySchema';
import { IssueUncheckedCreateNestedManyWithoutStatusInputSchema } from './IssueUncheckedCreateNestedManyWithoutStatusInputSchema';

export const IssueStatusUncheckedCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusUncheckedCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  category: z.lazy(() => StatusCategorySchema),
  isDefault: z.boolean().optional(),
  issues: z.lazy(() => IssueUncheckedCreateNestedManyWithoutStatusInputSchema).optional()
}).strict();

export default IssueStatusUncheckedCreateWithoutOrganizationInputSchema;
