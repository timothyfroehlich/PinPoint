import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateNestedOneWithoutCommentsInputSchema } from './UserCreateNestedOneWithoutCommentsInputSchema';
import { UserCreateNestedOneWithoutDeletedCommentsInputSchema } from './UserCreateNestedOneWithoutDeletedCommentsInputSchema';

export const CommentCreateWithoutIssueInputSchema: z.ZodType<Prisma.CommentCreateWithoutIssueInput> = z.object({
  id: z.string().cuid().optional(),
  content: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  author: z.lazy(() => UserCreateNestedOneWithoutCommentsInputSchema),
  deleter: z.lazy(() => UserCreateNestedOneWithoutDeletedCommentsInputSchema).optional()
}).strict();

export default CommentCreateWithoutIssueInputSchema;
