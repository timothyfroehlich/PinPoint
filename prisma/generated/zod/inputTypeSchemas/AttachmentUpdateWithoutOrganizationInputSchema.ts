import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { IssueUpdateOneRequiredWithoutAttachmentsNestedInputSchema } from "./IssueUpdateOneRequiredWithoutAttachmentsNestedInputSchema";

export const AttachmentUpdateWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentUpdateWithoutOrganizationInput> =
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
      issue: z
        .lazy(() => IssueUpdateOneRequiredWithoutAttachmentsNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentUpdateWithoutOrganizationInput>;

export default AttachmentUpdateWithoutOrganizationInputSchema;
