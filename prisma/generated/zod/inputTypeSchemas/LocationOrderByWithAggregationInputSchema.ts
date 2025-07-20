import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { LocationCountOrderByAggregateInputSchema } from "./LocationCountOrderByAggregateInputSchema";
import { LocationAvgOrderByAggregateInputSchema } from "./LocationAvgOrderByAggregateInputSchema";
import { LocationMaxOrderByAggregateInputSchema } from "./LocationMaxOrderByAggregateInputSchema";
import { LocationMinOrderByAggregateInputSchema } from "./LocationMinOrderByAggregateInputSchema";
import { LocationSumOrderByAggregateInputSchema } from "./LocationSumOrderByAggregateInputSchema";

export const LocationOrderByWithAggregationInputSchema: z.ZodType<Prisma.LocationOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      street: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      city: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      state: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      zip: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      phone: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      website: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      latitude: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      longitude: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      description: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      pinballMapId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      regionId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      lastSyncAt: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      syncEnabled: z.lazy(() => SortOrderSchema).optional(),
      _count: z.lazy(() => LocationCountOrderByAggregateInputSchema).optional(),
      _avg: z.lazy(() => LocationAvgOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => LocationMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => LocationMinOrderByAggregateInputSchema).optional(),
      _sum: z.lazy(() => LocationSumOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.LocationOrderByWithAggregationInput>;

export default LocationOrderByWithAggregationInputSchema;
