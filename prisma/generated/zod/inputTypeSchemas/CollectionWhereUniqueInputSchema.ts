import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionNameTypeIdLocationIdCompoundUniqueInputSchema } from "./CollectionNameTypeIdLocationIdCompoundUniqueInputSchema";
import { CollectionWhereInputSchema } from "./CollectionWhereInputSchema";
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

export const CollectionWhereUniqueInputSchema: z.ZodType<Prisma.CollectionWhereUniqueInput> =
  z
    .union([
      z.object({
        id: z.string().cuid(),
        name_typeId_locationId: z.lazy(
          () => CollectionNameTypeIdLocationIdCompoundUniqueInputSchema,
        ),
      }),
      z.object({
        id: z.string().cuid(),
      }),
      z.object({
        name_typeId_locationId: z.lazy(
          () => CollectionNameTypeIdLocationIdCompoundUniqueInputSchema,
        ),
      }),
    ])
    .and(
      z
        .object({
          id: z.string().cuid().optional(),
          name_typeId_locationId: z
            .lazy(() => CollectionNameTypeIdLocationIdCompoundUniqueInputSchema)
            .optional(),
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
          name: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
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
            .union([z.lazy(() => IntFilterSchema), z.number().int()])
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
        .strict(),
    ) as z.ZodType<Prisma.CollectionWhereUniqueInput>;

export default CollectionWhereUniqueInputSchema;
