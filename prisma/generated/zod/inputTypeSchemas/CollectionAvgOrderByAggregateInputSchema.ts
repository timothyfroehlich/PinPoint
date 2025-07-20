import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const CollectionAvgOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionAvgOrderByAggregateInput> =
  z
    .object({
      sortOrder: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionAvgOrderByAggregateInput>;

export default CollectionAvgOrderByAggregateInputSchema;
