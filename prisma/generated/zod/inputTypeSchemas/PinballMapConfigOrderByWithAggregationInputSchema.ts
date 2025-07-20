import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { PinballMapConfigCountOrderByAggregateInputSchema } from "./PinballMapConfigCountOrderByAggregateInputSchema";
import { PinballMapConfigAvgOrderByAggregateInputSchema } from "./PinballMapConfigAvgOrderByAggregateInputSchema";
import { PinballMapConfigMaxOrderByAggregateInputSchema } from "./PinballMapConfigMaxOrderByAggregateInputSchema";
import { PinballMapConfigMinOrderByAggregateInputSchema } from "./PinballMapConfigMinOrderByAggregateInputSchema";
import { PinballMapConfigSumOrderByAggregateInputSchema } from "./PinballMapConfigSumOrderByAggregateInputSchema";

export const PinballMapConfigOrderByWithAggregationInputSchema: z.ZodType<Prisma.PinballMapConfigOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      apiEnabled: z.lazy(() => SortOrderSchema).optional(),
      apiKey: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      autoSyncEnabled: z.lazy(() => SortOrderSchema).optional(),
      syncIntervalHours: z.lazy(() => SortOrderSchema).optional(),
      lastGlobalSync: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      createMissingModels: z.lazy(() => SortOrderSchema).optional(),
      updateExistingData: z.lazy(() => SortOrderSchema).optional(),
      _count: z
        .lazy(() => PinballMapConfigCountOrderByAggregateInputSchema)
        .optional(),
      _avg: z
        .lazy(() => PinballMapConfigAvgOrderByAggregateInputSchema)
        .optional(),
      _max: z
        .lazy(() => PinballMapConfigMaxOrderByAggregateInputSchema)
        .optional(),
      _min: z
        .lazy(() => PinballMapConfigMinOrderByAggregateInputSchema)
        .optional(),
      _sum: z
        .lazy(() => PinballMapConfigSumOrderByAggregateInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigOrderByWithAggregationInput>;

export default PinballMapConfigOrderByWithAggregationInputSchema;
