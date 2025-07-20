import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { FloatNullableFilterSchema } from "./FloatNullableFilterSchema";
import { IntNullableFilterSchema } from "./IntNullableFilterSchema";
import { DateTimeNullableFilterSchema } from "./DateTimeNullableFilterSchema";
import { BoolFilterSchema } from "./BoolFilterSchema";

export const LocationScalarWhereInputSchema: z.ZodType<Prisma.LocationScalarWhereInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => LocationScalarWhereInputSchema),
          z.lazy(() => LocationScalarWhereInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => LocationScalarWhereInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => LocationScalarWhereInputSchema),
          z.lazy(() => LocationScalarWhereInputSchema).array(),
        ])
        .optional(),
      id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      name: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      organizationId: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      street: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      city: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      state: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      zip: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      phone: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      website: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      latitude: z
        .union([z.lazy(() => FloatNullableFilterSchema), z.number()])
        .optional()
        .nullable(),
      longitude: z
        .union([z.lazy(() => FloatNullableFilterSchema), z.number()])
        .optional()
        .nullable(),
      description: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      pinballMapId: z
        .union([z.lazy(() => IntNullableFilterSchema), z.number()])
        .optional()
        .nullable(),
      regionId: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      lastSyncAt: z
        .union([z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date()])
        .optional()
        .nullable(),
      syncEnabled: z
        .union([z.lazy(() => BoolFilterSchema), z.boolean()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.LocationScalarWhereInput>;

export default LocationScalarWhereInputSchema;
