import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const PriorityAvgOrderByAggregateInputSchema: z.ZodType<Prisma.PriorityAvgOrderByAggregateInput> =
  z
    .object({
      order: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityAvgOrderByAggregateInput>;

export default PriorityAvgOrderByAggregateInputSchema;
