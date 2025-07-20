import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";
import { NullableJsonNullValueInputSchema } from "./NullableJsonNullValueInputSchema";
import { InputJsonValueSchema } from "./InputJsonValueSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { NullableDateTimeFieldUpdateOperationsInputSchema } from "./NullableDateTimeFieldUpdateOperationsInputSchema";
import { CommentUncheckedUpdateManyWithoutIssueNestedInputSchema } from "./CommentUncheckedUpdateManyWithoutIssueNestedInputSchema";
import { AttachmentUncheckedUpdateManyWithoutIssueNestedInputSchema } from "./AttachmentUncheckedUpdateManyWithoutIssueNestedInputSchema";
import { IssueHistoryUncheckedUpdateManyWithoutIssueNestedInputSchema } from "./IssueHistoryUncheckedUpdateManyWithoutIssueNestedInputSchema";
import { UpvoteUncheckedUpdateManyWithoutIssueNestedInputSchema } from "./UpvoteUncheckedUpdateManyWithoutIssueNestedInputSchema";

export const IssueUncheckedUpdateWithoutStatusInputSchema: z.ZodType<Prisma.IssueUncheckedUpdateWithoutStatusInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      title: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      description: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      consistency: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      checklist: z
        .union([
          z.lazy(() => NullableJsonNullValueInputSchema),
          InputJsonValueSchema,
        ])
        .optional(),
      createdAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => DateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      updatedAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => DateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      resolvedAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      organizationId: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      machineId: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      priorityId: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      createdById: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      assignedToId: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      comments: z
        .lazy(() => CommentUncheckedUpdateManyWithoutIssueNestedInputSchema)
        .optional(),
      attachments: z
        .lazy(() => AttachmentUncheckedUpdateManyWithoutIssueNestedInputSchema)
        .optional(),
      history: z
        .lazy(
          () => IssueHistoryUncheckedUpdateManyWithoutIssueNestedInputSchema,
        )
        .optional(),
      upvotes: z
        .lazy(() => UpvoteUncheckedUpdateManyWithoutIssueNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUncheckedUpdateWithoutStatusInput>;

export default IssueUncheckedUpdateWithoutStatusInputSchema;
