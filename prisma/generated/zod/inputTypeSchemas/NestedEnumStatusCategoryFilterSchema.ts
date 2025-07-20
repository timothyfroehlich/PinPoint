import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";

export const NestedEnumStatusCategoryFilterSchema: z.ZodType<Prisma.NestedEnumStatusCategoryFilter> =
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
    .strict() as z.ZodType<Prisma.NestedEnumStatusCategoryFilter>;

export default NestedEnumStatusCategoryFilterSchema;
