import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { BoolFilterSchema } from "./BoolFilterSchema";
import { IntFilterSchema } from "./IntFilterSchema";
import { JsonNullableFilterSchema } from "./JsonNullableFilterSchema";
import { CollectionTypeScalarRelationFilterSchema } from "./CollectionTypeScalarRelationFilterSchema";
import { CollectionTypeWhereInputSchema } from "./CollectionTypeWhereInputSchema";
import { LocationNullableScalarRelationFilterSchema } from "./LocationNullableScalarRelationFilterSchema";
import { LocationWhereInputSchema } from "./LocationWhereInputSchema";
import { MachineListRelationFilterSchema } from "./MachineListRelationFilterSchema";

export const CollectionWhereInputSchema: z.ZodType<Prisma.CollectionWhereInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => CollectionWhereInputSchema),
          z.lazy(() => CollectionWhereInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => CollectionWhereInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => CollectionWhereInputSchema),
          z.lazy(() => CollectionWhereInputSchema).array(),
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
      type: z
        .union([
          z.lazy(() => CollectionTypeScalarRelationFilterSchema),
          z.lazy(() => CollectionTypeWhereInputSchema),
        ])
        .optional(),
      location: z
        .union([
          z.lazy(() => LocationNullableScalarRelationFilterSchema),
          z.lazy(() => LocationWhereInputSchema),
        ])
        .optional()
        .nullable(),
      machines: z.lazy(() => MachineListRelationFilterSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionWhereInput>;

export default CollectionWhereInputSchema;
