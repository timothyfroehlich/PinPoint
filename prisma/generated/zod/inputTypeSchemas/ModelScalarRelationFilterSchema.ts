import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { ModelWhereInputSchema } from "./ModelWhereInputSchema";

export const ModelScalarRelationFilterSchema: z.ZodType<Prisma.ModelScalarRelationFilter> =
  z
    .object({
      is: z.lazy(() => ModelWhereInputSchema).optional(),
      isNot: z.lazy(() => ModelWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.ModelScalarRelationFilter>;

export default ModelScalarRelationFilterSchema;
