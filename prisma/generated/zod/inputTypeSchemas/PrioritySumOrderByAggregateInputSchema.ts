import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const PrioritySumOrderByAggregateInputSchema: z.ZodType<Prisma.PrioritySumOrderByAggregateInput> =
  z
    .object({
      order: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PrioritySumOrderByAggregateInput>;

export default PrioritySumOrderByAggregateInputSchema;
