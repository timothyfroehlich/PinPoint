import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const CollectionTypeAvgOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionTypeAvgOrderByAggregateInput> =
  z
    .object({
      sortOrder: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeAvgOrderByAggregateInput>;

export default CollectionTypeAvgOrderByAggregateInputSchema;
