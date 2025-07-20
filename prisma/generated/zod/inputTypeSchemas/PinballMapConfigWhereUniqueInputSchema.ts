import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PinballMapConfigWhereInputSchema } from "./PinballMapConfigWhereInputSchema";
import { BoolFilterSchema } from "./BoolFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { IntFilterSchema } from "./IntFilterSchema";
import { DateTimeNullableFilterSchema } from "./DateTimeNullableFilterSchema";
import { OrganizationScalarRelationFilterSchema } from "./OrganizationScalarRelationFilterSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const PinballMapConfigWhereUniqueInputSchema: z.ZodType<Prisma.PinballMapConfigWhereUniqueInput> =
  z
    .union([
      z.object({
        id: z.string().cuid(),
        organizationId: z.string(),
      }),
      z.object({
        id: z.string().cuid(),
      }),
      z.object({
        organizationId: z.string(),
      }),
    ])
    .and(
      z
        .object({
          id: z.string().cuid().optional(),
          organizationId: z.string().optional(),
          AND: z
            .union([
              z.lazy(() => PinballMapConfigWhereInputSchema),
              z.lazy(() => PinballMapConfigWhereInputSchema).array(),
            ])
            .optional(),
          OR: z
            .lazy(() => PinballMapConfigWhereInputSchema)
            .array()
            .optional(),
          NOT: z
            .union([
              z.lazy(() => PinballMapConfigWhereInputSchema),
              z.lazy(() => PinballMapConfigWhereInputSchema).array(),
            ])
            .optional(),
          apiEnabled: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          apiKey: z
            .union([z.lazy(() => StringNullableFilterSchema), z.string()])
            .optional()
            .nullable(),
          autoSyncEnabled: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          syncIntervalHours: z
            .union([z.lazy(() => IntFilterSchema), z.number().int()])
            .optional(),
          lastGlobalSync: z
            .union([
              z.lazy(() => DateTimeNullableFilterSchema),
              z.coerce.date(),
            ])
            .optional()
            .nullable(),
          createMissingModels: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          updateExistingData: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          organization: z
            .union([
              z.lazy(() => OrganizationScalarRelationFilterSchema),
              z.lazy(() => OrganizationWhereInputSchema),
            ])
            .optional(),
        })
        .strict(),
    ) as z.ZodType<Prisma.PinballMapConfigWhereUniqueInput>;

export default PinballMapConfigWhereUniqueInputSchema;
