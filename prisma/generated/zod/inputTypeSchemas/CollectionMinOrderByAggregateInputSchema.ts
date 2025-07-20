import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const CollectionMinOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionMinOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      typeId: z.lazy(() => SortOrderSchema).optional(),
      locationId: z.lazy(() => SortOrderSchema).optional(),
      isSmart: z.lazy(() => SortOrderSchema).optional(),
      isManual: z.lazy(() => SortOrderSchema).optional(),
      description: z.lazy(() => SortOrderSchema).optional(),
      sortOrder: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionMinOrderByAggregateInput>;

export default CollectionMinOrderByAggregateInputSchema;
