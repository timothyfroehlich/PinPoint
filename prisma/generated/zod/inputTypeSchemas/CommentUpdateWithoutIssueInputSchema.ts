import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { NullableDateTimeFieldUpdateOperationsInputSchema } from "./NullableDateTimeFieldUpdateOperationsInputSchema";
import { UserUpdateOneRequiredWithoutCommentsNestedInputSchema } from "./UserUpdateOneRequiredWithoutCommentsNestedInputSchema";
import { UserUpdateOneWithoutDeletedCommentsNestedInputSchema } from "./UserUpdateOneWithoutDeletedCommentsNestedInputSchema";

export const CommentUpdateWithoutIssueInputSchema: z.ZodType<Prisma.CommentUpdateWithoutIssueInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      content: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
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
      deletedAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      author: z
        .lazy(() => UserUpdateOneRequiredWithoutCommentsNestedInputSchema)
        .optional(),
      deleter: z
        .lazy(() => UserUpdateOneWithoutDeletedCommentsNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CommentUpdateWithoutIssueInput>;

export default CommentUpdateWithoutIssueInputSchema;
