import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StatusCategorySchema } from './StatusCategorySchema';

export const IssueStatusCreateManyOrganizationInputSchema: z.ZodType<Prisma.IssueStatusCreateManyOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  category: z.lazy(() => StatusCategorySchema),
  isDefault: z.boolean().optional()
}).strict();

export default IssueStatusCreateManyOrganizationInputSchema;
