import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";
import { StringNullableWithAggregatesFilterSchema } from "./StringNullableWithAggregatesFilterSchema";
import { DateTimeWithAggregatesFilterSchema } from "./DateTimeWithAggregatesFilterSchema";
import { EnumActivityTypeWithAggregatesFilterSchema } from "./EnumActivityTypeWithAggregatesFilterSchema";
import { ActivityTypeSchema } from "./ActivityTypeSchema";

export const IssueHistoryScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.IssueHistoryScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => IssueHistoryScalarWhereWithAggregatesInputSchema),
          z
            .lazy(() => IssueHistoryScalarWhereWithAggregatesInputSchema)
            .array(),
        ])
        .optional(),
      OR: z
        .lazy(() => IssueHistoryScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => IssueHistoryScalarWhereWithAggregatesInputSchema),
          z
            .lazy(() => IssueHistoryScalarWhereWithAggregatesInputSchema)
            .array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      field: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      oldValue: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      newValue: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      changedAt: z
        .union([
          z.lazy(() => DateTimeWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional(),
      organizationId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      actorId: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      type: z
        .union([
          z.lazy(() => EnumActivityTypeWithAggregatesFilterSchema),
          z.lazy(() => ActivityTypeSchema),
        ])
        .optional(),
      issueId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryScalarWhereWithAggregatesInput>;

export default IssueHistoryScalarWhereWithAggregatesInputSchema;
