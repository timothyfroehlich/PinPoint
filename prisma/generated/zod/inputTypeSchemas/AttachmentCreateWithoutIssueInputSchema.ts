import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateNestedOneWithoutAttachmentsInputSchema } from "./OrganizationCreateNestedOneWithoutAttachmentsInputSchema";

export const AttachmentCreateWithoutIssueInputSchema: z.ZodType<Prisma.AttachmentCreateWithoutIssueInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      url: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      createdAt: z.coerce.date().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutAttachmentsInputSchema,
      ),
    })
    .strict() as z.ZodType<Prisma.AttachmentCreateWithoutIssueInput>;

export default AttachmentCreateWithoutIssueInputSchema;
