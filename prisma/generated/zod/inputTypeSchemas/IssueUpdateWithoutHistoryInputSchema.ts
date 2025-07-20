import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { NullableStringFieldUpdateOperationsInputSchema } from './NullableStringFieldUpdateOperationsInputSchema';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';
import { DateTimeFieldUpdateOperationsInputSchema } from './DateTimeFieldUpdateOperationsInputSchema';
import { NullableDateTimeFieldUpdateOperationsInputSchema } from './NullableDateTimeFieldUpdateOperationsInputSchema';
import { OrganizationUpdateOneRequiredWithoutIssuesNestedInputSchema } from './OrganizationUpdateOneRequiredWithoutIssuesNestedInputSchema';
import { MachineUpdateOneRequiredWithoutIssuesNestedInputSchema } from './MachineUpdateOneRequiredWithoutIssuesNestedInputSchema';
import { PriorityUpdateOneRequiredWithoutIssuesNestedInputSchema } from './PriorityUpdateOneRequiredWithoutIssuesNestedInputSchema';
import { IssueStatusUpdateOneRequiredWithoutIssuesNestedInputSchema } from './IssueStatusUpdateOneRequiredWithoutIssuesNestedInputSchema';
import { UserUpdateOneRequiredWithoutIssuesCreatedNestedInputSchema } from './UserUpdateOneRequiredWithoutIssuesCreatedNestedInputSchema';
import { UserUpdateOneWithoutIssuesAssignedNestedInputSchema } from './UserUpdateOneWithoutIssuesAssignedNestedInputSchema';
import { CommentUpdateManyWithoutIssueNestedInputSchema } from './CommentUpdateManyWithoutIssueNestedInputSchema';
import { AttachmentUpdateManyWithoutIssueNestedInputSchema } from './AttachmentUpdateManyWithoutIssueNestedInputSchema';
import { UpvoteUpdateManyWithoutIssueNestedInputSchema } from './UpvoteUpdateManyWithoutIssueNestedInputSchema';

export const IssueUpdateWithoutHistoryInputSchema: z.ZodType<Prisma.IssueUpdateWithoutHistoryInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  consistency: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  checklist: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  resolvedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  organization: z.lazy(() => OrganizationUpdateOneRequiredWithoutIssuesNestedInputSchema).optional(),
  machine: z.lazy(() => MachineUpdateOneRequiredWithoutIssuesNestedInputSchema).optional(),
  priority: z.lazy(() => PriorityUpdateOneRequiredWithoutIssuesNestedInputSchema).optional(),
  status: z.lazy(() => IssueStatusUpdateOneRequiredWithoutIssuesNestedInputSchema).optional(),
  createdBy: z.lazy(() => UserUpdateOneRequiredWithoutIssuesCreatedNestedInputSchema).optional(),
  assignedTo: z.lazy(() => UserUpdateOneWithoutIssuesAssignedNestedInputSchema).optional(),
  comments: z.lazy(() => CommentUpdateManyWithoutIssueNestedInputSchema).optional(),
  attachments: z.lazy(() => AttachmentUpdateManyWithoutIssueNestedInputSchema).optional(),
  upvotes: z.lazy(() => UpvoteUpdateManyWithoutIssueNestedInputSchema).optional()
}).strict();

export default IssueUpdateWithoutHistoryInputSchema;
