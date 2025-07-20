import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const ModelSumOrderByAggregateInputSchema: z.ZodType<Prisma.ModelSumOrderByAggregateInput> =
  z
    .object({
      year: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.ModelSumOrderByAggregateInput>;

export default ModelSumOrderByAggregateInputSchema;
