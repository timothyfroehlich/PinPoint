import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const LocationMaxOrderByAggregateInputSchema: z.ZodType<Prisma.LocationMaxOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      street: z.lazy(() => SortOrderSchema).optional(),
      city: z.lazy(() => SortOrderSchema).optional(),
      state: z.lazy(() => SortOrderSchema).optional(),
      zip: z.lazy(() => SortOrderSchema).optional(),
      phone: z.lazy(() => SortOrderSchema).optional(),
      website: z.lazy(() => SortOrderSchema).optional(),
      latitude: z.lazy(() => SortOrderSchema).optional(),
      longitude: z.lazy(() => SortOrderSchema).optional(),
      description: z.lazy(() => SortOrderSchema).optional(),
      pinballMapId: z.lazy(() => SortOrderSchema).optional(),
      regionId: z.lazy(() => SortOrderSchema).optional(),
      lastSyncAt: z.lazy(() => SortOrderSchema).optional(),
      syncEnabled: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.LocationMaxOrderByAggregateInput>;

export default LocationMaxOrderByAggregateInputSchema;
