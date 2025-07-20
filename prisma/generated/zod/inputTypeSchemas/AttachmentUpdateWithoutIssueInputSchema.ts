import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { OrganizationUpdateOneRequiredWithoutAttachmentsNestedInputSchema } from "./OrganizationUpdateOneRequiredWithoutAttachmentsNestedInputSchema";

export const AttachmentUpdateWithoutIssueInputSchema: z.ZodType<Prisma.AttachmentUpdateWithoutIssueInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      url: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      fileName: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      fileType: z
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
      organization: z
        .lazy(
          () =>
            OrganizationUpdateOneRequiredWithoutAttachmentsNestedInputSchema,
        )
        .optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentUpdateWithoutIssueInput>;

export default AttachmentUpdateWithoutIssueInputSchema;
