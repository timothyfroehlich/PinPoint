import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";
import { DateTimeWithAggregatesFilterSchema } from "./DateTimeWithAggregatesFilterSchema";

export const UpvoteScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.UpvoteScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => UpvoteScalarWhereWithAggregatesInputSchema),
          z.lazy(() => UpvoteScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => UpvoteScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => UpvoteScalarWhereWithAggregatesInputSchema),
          z.lazy(() => UpvoteScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      createdAt: z
        .union([
          z.lazy(() => DateTimeWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional(),
      issueId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      userId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteScalarWhereWithAggregatesInput>;

export default UpvoteScalarWhereWithAggregatesInputSchema;
