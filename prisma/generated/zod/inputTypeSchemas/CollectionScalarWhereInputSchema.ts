import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { BoolFilterSchema } from "./BoolFilterSchema";
import { IntFilterSchema } from "./IntFilterSchema";
import { JsonNullableFilterSchema } from "./JsonNullableFilterSchema";

export const CollectionScalarWhereInputSchema: z.ZodType<Prisma.CollectionScalarWhereInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => CollectionScalarWhereInputSchema),
          z.lazy(() => CollectionScalarWhereInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => CollectionScalarWhereInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => CollectionScalarWhereInputSchema),
          z.lazy(() => CollectionScalarWhereInputSchema).array(),
        ])
        .optional(),
      id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      name: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      typeId: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      locationId: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      isSmart: z
        .union([z.lazy(() => BoolFilterSchema), z.boolean()])
        .optional(),
      isManual: z
        .union([z.lazy(() => BoolFilterSchema), z.boolean()])
        .optional(),
      description: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      sortOrder: z
        .union([z.lazy(() => IntFilterSchema), z.number()])
        .optional(),
      filterCriteria: z.lazy(() => JsonNullableFilterSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionScalarWhereInput>;

export default CollectionScalarWhereInputSchema;
