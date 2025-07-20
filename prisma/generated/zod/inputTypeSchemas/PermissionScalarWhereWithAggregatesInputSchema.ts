import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";

export const PermissionScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.PermissionScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => PermissionScalarWhereWithAggregatesInputSchema),
          z.lazy(() => PermissionScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => PermissionScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => PermissionScalarWhereWithAggregatesInputSchema),
          z.lazy(() => PermissionScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      name: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionScalarWhereWithAggregatesInput>;

export default PermissionScalarWhereWithAggregatesInputSchema;
