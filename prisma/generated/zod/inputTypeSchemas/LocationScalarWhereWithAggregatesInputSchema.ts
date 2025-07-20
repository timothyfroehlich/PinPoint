import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";
import { StringNullableWithAggregatesFilterSchema } from "./StringNullableWithAggregatesFilterSchema";
import { FloatNullableWithAggregatesFilterSchema } from "./FloatNullableWithAggregatesFilterSchema";
import { IntNullableWithAggregatesFilterSchema } from "./IntNullableWithAggregatesFilterSchema";
import { DateTimeNullableWithAggregatesFilterSchema } from "./DateTimeNullableWithAggregatesFilterSchema";
import { BoolWithAggregatesFilterSchema } from "./BoolWithAggregatesFilterSchema";

export const LocationScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.LocationScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => LocationScalarWhereWithAggregatesInputSchema),
          z.lazy(() => LocationScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => LocationScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => LocationScalarWhereWithAggregatesInputSchema),
          z.lazy(() => LocationScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      name: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      organizationId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      street: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      city: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      state: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      zip: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      phone: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      website: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      latitude: z
        .union([
          z.lazy(() => FloatNullableWithAggregatesFilterSchema),
          z.number(),
        ])
        .optional()
        .nullable(),
      longitude: z
        .union([
          z.lazy(() => FloatNullableWithAggregatesFilterSchema),
          z.number(),
        ])
        .optional()
        .nullable(),
      description: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      pinballMapId: z
        .union([
          z.lazy(() => IntNullableWithAggregatesFilterSchema),
          z.number(),
        ])
        .optional()
        .nullable(),
      regionId: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      lastSyncAt: z
        .union([
          z.lazy(() => DateTimeNullableWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional()
        .nullable(),
      syncEnabled: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.LocationScalarWhereWithAggregatesInput>;

export default LocationScalarWhereWithAggregatesInputSchema;
