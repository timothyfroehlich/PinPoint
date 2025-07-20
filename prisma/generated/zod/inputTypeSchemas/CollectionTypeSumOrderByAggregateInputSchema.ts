import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const CollectionTypeSumOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionTypeSumOrderByAggregateInput> =
  z
    .object({
      sortOrder: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeSumOrderByAggregateInput>;

export default CollectionTypeSumOrderByAggregateInputSchema;
