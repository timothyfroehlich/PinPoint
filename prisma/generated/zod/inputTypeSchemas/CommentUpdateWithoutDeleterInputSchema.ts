import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { NullableDateTimeFieldUpdateOperationsInputSchema } from "./NullableDateTimeFieldUpdateOperationsInputSchema";
import { IssueUpdateOneRequiredWithoutCommentsNestedInputSchema } from "./IssueUpdateOneRequiredWithoutCommentsNestedInputSchema";
import { UserUpdateOneRequiredWithoutCommentsNestedInputSchema } from "./UserUpdateOneRequiredWithoutCommentsNestedInputSchema";

export const CommentUpdateWithoutDeleterInputSchema: z.ZodType<Prisma.CommentUpdateWithoutDeleterInput> =
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
      issue: z
        .lazy(() => IssueUpdateOneRequiredWithoutCommentsNestedInputSchema)
        .optional(),
      author: z
        .lazy(() => UserUpdateOneRequiredWithoutCommentsNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CommentUpdateWithoutDeleterInput>;

export default CommentUpdateWithoutDeleterInputSchema;
