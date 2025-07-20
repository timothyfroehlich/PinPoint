import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateNestedOneWithoutCommentsInputSchema } from './IssueCreateNestedOneWithoutCommentsInputSchema';
import { UserCreateNestedOneWithoutDeletedCommentsInputSchema } from './UserCreateNestedOneWithoutDeletedCommentsInputSchema';

export const CommentCreateWithoutAuthorInputSchema: z.ZodType<Prisma.CommentCreateWithoutAuthorInput> = z.object({
  id: z.string().cuid().optional(),
  content: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  issue: z.lazy(() => IssueCreateNestedOneWithoutCommentsInputSchema),
  deleter: z.lazy(() => UserCreateNestedOneWithoutDeletedCommentsInputSchema).optional()
}).strict();

export default CommentCreateWithoutAuthorInputSchema;
