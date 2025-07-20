import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { IssueOrderByWithRelationInputSchema } from './IssueOrderByWithRelationInputSchema';
import { UserOrderByWithRelationInputSchema } from './UserOrderByWithRelationInputSchema';

export const CommentOrderByWithRelationInputSchema: z.ZodType<Prisma.CommentOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  content: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  deletedBy: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  issueId: z.lazy(() => SortOrderSchema).optional(),
  authorId: z.lazy(() => SortOrderSchema).optional(),
  issue: z.lazy(() => IssueOrderByWithRelationInputSchema).optional(),
  author: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
  deleter: z.lazy(() => UserOrderByWithRelationInputSchema).optional()
}).strict();

export default CommentOrderByWithRelationInputSchema;
