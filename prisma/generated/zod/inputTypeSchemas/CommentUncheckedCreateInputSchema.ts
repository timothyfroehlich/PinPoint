import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const CommentUncheckedCreateInputSchema: z.ZodType<Prisma.CommentUncheckedCreateInput> = z.object({
  id: z.string().cuid().optional(),
  content: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  deletedBy: z.string().optional().nullable(),
  issueId: z.string(),
  authorId: z.string()
}).strict();

export default CommentUncheckedCreateInputSchema;
