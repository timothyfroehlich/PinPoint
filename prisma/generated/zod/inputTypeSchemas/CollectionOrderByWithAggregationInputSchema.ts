import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { CollectionCountOrderByAggregateInputSchema } from "./CollectionCountOrderByAggregateInputSchema";
import { CollectionAvgOrderByAggregateInputSchema } from "./CollectionAvgOrderByAggregateInputSchema";
import { CollectionMaxOrderByAggregateInputSchema } from "./CollectionMaxOrderByAggregateInputSchema";
import { CollectionMinOrderByAggregateInputSchema } from "./CollectionMinOrderByAggregateInputSchema";
import { CollectionSumOrderByAggregateInputSchema } from "./CollectionSumOrderByAggregateInputSchema";

export const CollectionOrderByWithAggregationInputSchema: z.ZodType<Prisma.CollectionOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      typeId: z.lazy(() => SortOrderSchema).optional(),
      locationId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      isSmart: z.lazy(() => SortOrderSchema).optional(),
      isManual: z.lazy(() => SortOrderSchema).optional(),
      description: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      sortOrder: z.lazy(() => SortOrderSchema).optional(),
      filterCriteria: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      _count: z
        .lazy(() => CollectionCountOrderByAggregateInputSchema)
        .optional(),
      _avg: z.lazy(() => CollectionAvgOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => CollectionMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => CollectionMinOrderByAggregateInputSchema).optional(),
      _sum: z.lazy(() => CollectionSumOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionOrderByWithAggregationInput>;

export default CollectionOrderByWithAggregationInputSchema;
