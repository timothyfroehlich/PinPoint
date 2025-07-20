import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateNestedOneWithoutCommentsInputSchema } from './IssueCreateNestedOneWithoutCommentsInputSchema';
import { UserCreateNestedOneWithoutCommentsInputSchema } from './UserCreateNestedOneWithoutCommentsInputSchema';
import { UserCreateNestedOneWithoutDeletedCommentsInputSchema } from './UserCreateNestedOneWithoutDeletedCommentsInputSchema';

export const CommentCreateInputSchema: z.ZodType<Prisma.CommentCreateInput> = z.object({
  id: z.string().cuid().optional(),
  content: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  issue: z.lazy(() => IssueCreateNestedOneWithoutCommentsInputSchema),
  author: z.lazy(() => UserCreateNestedOneWithoutCommentsInputSchema),
  deleter: z.lazy(() => UserCreateNestedOneWithoutDeletedCommentsInputSchema).optional()
}).strict();

export default CommentCreateInputSchema;
