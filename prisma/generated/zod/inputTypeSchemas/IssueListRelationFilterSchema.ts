import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';

export const IssueListRelationFilterSchema: z.ZodType<Prisma.IssueListRelationFilter> = z.object({
  every: z.lazy(() => IssueWhereInputSchema).optional(),
  some: z.lazy(() => IssueWhereInputSchema).optional(),
  none: z.lazy(() => IssueWhereInputSchema).optional()
}).strict();

export default IssueListRelationFilterSchema;
