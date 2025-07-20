import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { IssueOrderByWithRelationInputSchema } from './IssueOrderByWithRelationInputSchema';
import { UserOrderByWithRelationInputSchema } from './UserOrderByWithRelationInputSchema';

export const UpvoteOrderByWithRelationInputSchema: z.ZodType<Prisma.UpvoteOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  issueId: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  issue: z.lazy(() => IssueOrderByWithRelationInputSchema).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputSchema).optional()
}).strict();

export default UpvoteOrderByWithRelationInputSchema;
