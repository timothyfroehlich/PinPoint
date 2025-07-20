import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";
import { StringNullableWithAggregatesFilterSchema } from "./StringNullableWithAggregatesFilterSchema";
import { IntNullableWithAggregatesFilterSchema } from "./IntNullableWithAggregatesFilterSchema";
import { BoolWithAggregatesFilterSchema } from "./BoolWithAggregatesFilterSchema";

export const ModelScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.ModelScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => ModelScalarWhereWithAggregatesInputSchema),
          z.lazy(() => ModelScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => ModelScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => ModelScalarWhereWithAggregatesInputSchema),
          z.lazy(() => ModelScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      name: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      manufacturer: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      year: z
        .union([
          z.lazy(() => IntNullableWithAggregatesFilterSchema),
          z.number(),
        ])
        .optional()
        .nullable(),
      ipdbId: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      opdbId: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      machineType: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      machineDisplay: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      isActive: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
      ipdbLink: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      opdbImgUrl: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      kineticistUrl: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      isCustom: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.ModelScalarWhereWithAggregatesInput>;

export default ModelScalarWhereWithAggregatesInputSchema;
