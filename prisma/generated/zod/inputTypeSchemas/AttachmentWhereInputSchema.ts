import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { DateTimeFilterSchema } from "./DateTimeFilterSchema";
import { IssueScalarRelationFilterSchema } from "./IssueScalarRelationFilterSchema";
import { IssueWhereInputSchema } from "./IssueWhereInputSchema";
import { OrganizationScalarRelationFilterSchema } from "./OrganizationScalarRelationFilterSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const AttachmentWhereInputSchema: z.ZodType<Prisma.AttachmentWhereInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => AttachmentWhereInputSchema),
          z.lazy(() => AttachmentWhereInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => AttachmentWhereInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => AttachmentWhereInputSchema),
          z.lazy(() => AttachmentWhereInputSchema).array(),
        ])
        .optional(),
      id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      url: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      fileName: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      fileType: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      createdAt: z
        .union([z.lazy(() => DateTimeFilterSchema), z.coerce.date()])
        .optional(),
      organizationId: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      issueId: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      issue: z
        .union([
          z.lazy(() => IssueScalarRelationFilterSchema),
          z.lazy(() => IssueWhereInputSchema),
        ])
        .optional(),
      organization: z
        .union([
          z.lazy(() => OrganizationScalarRelationFilterSchema),
          z.lazy(() => OrganizationWhereInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentWhereInput>;

export default AttachmentWhereInputSchema;
