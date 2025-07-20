import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { IssueOrderByWithRelationInputSchema } from "./IssueOrderByWithRelationInputSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";

export const AttachmentOrderByWithRelationInputSchema: z.ZodType<Prisma.AttachmentOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      url: z.lazy(() => SortOrderSchema).optional(),
      fileName: z.lazy(() => SortOrderSchema).optional(),
      fileType: z.lazy(() => SortOrderSchema).optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      issueId: z.lazy(() => SortOrderSchema).optional(),
      issue: z.lazy(() => IssueOrderByWithRelationInputSchema).optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentOrderByWithRelationInput>;

export default AttachmentOrderByWithRelationInputSchema;
