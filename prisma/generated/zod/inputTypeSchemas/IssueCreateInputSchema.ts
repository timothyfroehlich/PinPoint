import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';
import { OrganizationCreateNestedOneWithoutIssuesInputSchema } from './OrganizationCreateNestedOneWithoutIssuesInputSchema';
import { MachineCreateNestedOneWithoutIssuesInputSchema } from './MachineCreateNestedOneWithoutIssuesInputSchema';
import { PriorityCreateNestedOneWithoutIssuesInputSchema } from './PriorityCreateNestedOneWithoutIssuesInputSchema';
import { IssueStatusCreateNestedOneWithoutIssuesInputSchema } from './IssueStatusCreateNestedOneWithoutIssuesInputSchema';
import { UserCreateNestedOneWithoutIssuesCreatedInputSchema } from './UserCreateNestedOneWithoutIssuesCreatedInputSchema';
import { UserCreateNestedOneWithoutIssuesAssignedInputSchema } from './UserCreateNestedOneWithoutIssuesAssignedInputSchema';
import { CommentCreateNestedManyWithoutIssueInputSchema } from './CommentCreateNestedManyWithoutIssueInputSchema';
import { AttachmentCreateNestedManyWithoutIssueInputSchema } from './AttachmentCreateNestedManyWithoutIssueInputSchema';
import { IssueHistoryCreateNestedManyWithoutIssueInputSchema } from './IssueHistoryCreateNestedManyWithoutIssueInputSchema';
import { UpvoteCreateNestedManyWithoutIssueInputSchema } from './UpvoteCreateNestedManyWithoutIssueInputSchema';

export const IssueCreateInputSchema: z.ZodType<Prisma.IssueCreateInput> = z.object({
  id: z.string().cuid().optional(),
  title: z.string(),
  description: z.string().optional().nullable(),
  consistency: z.string().optional().nullable(),
  checklist: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  resolvedAt: z.coerce.date().optional().nullable(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutIssuesInputSchema),
  machine: z.lazy(() => MachineCreateNestedOneWithoutIssuesInputSchema),
  priority: z.lazy(() => PriorityCreateNestedOneWithoutIssuesInputSchema),
  status: z.lazy(() => IssueStatusCreateNestedOneWithoutIssuesInputSchema),
  createdBy: z.lazy(() => UserCreateNestedOneWithoutIssuesCreatedInputSchema),
  assignedTo: z.lazy(() => UserCreateNestedOneWithoutIssuesAssignedInputSchema).optional(),
  comments: z.lazy(() => CommentCreateNestedManyWithoutIssueInputSchema).optional(),
  attachments: z.lazy(() => AttachmentCreateNestedManyWithoutIssueInputSchema).optional(),
  history: z.lazy(() => IssueHistoryCreateNestedManyWithoutIssueInputSchema).optional(),
  upvotes: z.lazy(() => UpvoteCreateNestedManyWithoutIssueInputSchema).optional()
}).strict();

export default IssueCreateInputSchema;
