import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateNestedOneWithoutAttachmentsInputSchema } from "./IssueCreateNestedOneWithoutAttachmentsInputSchema";
import { OrganizationCreateNestedOneWithoutAttachmentsInputSchema } from "./OrganizationCreateNestedOneWithoutAttachmentsInputSchema";

export const AttachmentCreateInputSchema: z.ZodType<Prisma.AttachmentCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      url: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      createdAt: z.coerce.date().optional(),
      issue: z.lazy(() => IssueCreateNestedOneWithoutAttachmentsInputSchema),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutAttachmentsInputSchema,
      ),
    })
    .strict() as z.ZodType<Prisma.AttachmentCreateInput>;

export default AttachmentCreateInputSchema;
