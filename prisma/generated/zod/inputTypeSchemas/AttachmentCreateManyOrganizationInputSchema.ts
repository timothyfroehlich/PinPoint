import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const AttachmentCreateManyOrganizationInputSchema: z.ZodType<Prisma.AttachmentCreateManyOrganizationInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      url: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      createdAt: z.coerce.date().optional(),
      issueId: z.string(),
    })
    .strict() as z.ZodType<Prisma.AttachmentCreateManyOrganizationInput>;

export default AttachmentCreateManyOrganizationInputSchema;
