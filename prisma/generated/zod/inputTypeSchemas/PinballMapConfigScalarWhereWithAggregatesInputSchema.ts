import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";
import { BoolWithAggregatesFilterSchema } from "./BoolWithAggregatesFilterSchema";
import { StringNullableWithAggregatesFilterSchema } from "./StringNullableWithAggregatesFilterSchema";
import { IntWithAggregatesFilterSchema } from "./IntWithAggregatesFilterSchema";
import { DateTimeNullableWithAggregatesFilterSchema } from "./DateTimeNullableWithAggregatesFilterSchema";

export const PinballMapConfigScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.PinballMapConfigScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => PinballMapConfigScalarWhereWithAggregatesInputSchema),
          z
            .lazy(() => PinballMapConfigScalarWhereWithAggregatesInputSchema)
            .array(),
        ])
        .optional(),
      OR: z
        .lazy(() => PinballMapConfigScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => PinballMapConfigScalarWhereWithAggregatesInputSchema),
          z
            .lazy(() => PinballMapConfigScalarWhereWithAggregatesInputSchema)
            .array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      organizationId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      apiEnabled: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
      apiKey: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      autoSyncEnabled: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
      syncIntervalHours: z
        .union([z.lazy(() => IntWithAggregatesFilterSchema), z.number()])
        .optional(),
      lastGlobalSync: z
        .union([
          z.lazy(() => DateTimeNullableWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional()
        .nullable(),
      createMissingModels: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
      updateExistingData: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigScalarWhereWithAggregatesInput>;

export default PinballMapConfigScalarWhereWithAggregatesInputSchema;
