import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';
import { CommentUncheckedCreateNestedManyWithoutIssueInputSchema } from './CommentUncheckedCreateNestedManyWithoutIssueInputSchema';
import { IssueHistoryUncheckedCreateNestedManyWithoutIssueInputSchema } from './IssueHistoryUncheckedCreateNestedManyWithoutIssueInputSchema';
import { UpvoteUncheckedCreateNestedManyWithoutIssueInputSchema } from './UpvoteUncheckedCreateNestedManyWithoutIssueInputSchema';

export const IssueUncheckedCreateWithoutAttachmentsInputSchema: z.ZodType<Prisma.IssueUncheckedCreateWithoutAttachmentsInput> = z.object({
  id: z.string().cuid().optional(),
  title: z.string(),
  description: z.string().optional().nullable(),
  consistency: z.string().optional().nullable(),
  checklist: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  resolvedAt: z.coerce.date().optional().nullable(),
  organizationId: z.string(),
  machineId: z.string(),
  statusId: z.string(),
  priorityId: z.string(),
  createdById: z.string(),
  assignedToId: z.string().optional().nullable(),
  comments: z.lazy(() => CommentUncheckedCreateNestedManyWithoutIssueInputSchema).optional(),
  history: z.lazy(() => IssueHistoryUncheckedCreateNestedManyWithoutIssueInputSchema).optional(),
  upvotes: z.lazy(() => UpvoteUncheckedCreateNestedManyWithoutIssueInputSchema).optional()
}).strict();

export default IssueUncheckedCreateWithoutAttachmentsInputSchema;
