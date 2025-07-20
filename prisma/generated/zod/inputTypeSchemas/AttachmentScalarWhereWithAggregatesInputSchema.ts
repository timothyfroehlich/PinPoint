import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";
import { DateTimeWithAggregatesFilterSchema } from "./DateTimeWithAggregatesFilterSchema";

export const AttachmentScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.AttachmentScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => AttachmentScalarWhereWithAggregatesInputSchema),
          z.lazy(() => AttachmentScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => AttachmentScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => AttachmentScalarWhereWithAggregatesInputSchema),
          z.lazy(() => AttachmentScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      url: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      fileName: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      fileType: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      createdAt: z
        .union([
          z.lazy(() => DateTimeWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional(),
      organizationId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      issueId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentScalarWhereWithAggregatesInput>;

export default AttachmentScalarWhereWithAggregatesInputSchema;
