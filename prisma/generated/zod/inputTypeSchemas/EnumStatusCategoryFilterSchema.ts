import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";
import { NestedEnumStatusCategoryFilterSchema } from "./NestedEnumStatusCategoryFilterSchema";

export const EnumStatusCategoryFilterSchema: z.ZodType<Prisma.EnumStatusCategoryFilter> =
  z
    .object({
      equals: z.lazy(() => StatusCategorySchema).optional(),
      in: z
        .lazy(() => StatusCategorySchema)
        .array()
        .optional(),
      notIn: z
        .lazy(() => StatusCategorySchema)
        .array()
        .optional(),
      not: z
        .union([
          z.lazy(() => StatusCategorySchema),
          z.lazy(() => NestedEnumStatusCategoryFilterSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.EnumStatusCategoryFilter>;

export default EnumStatusCategoryFilterSchema;
