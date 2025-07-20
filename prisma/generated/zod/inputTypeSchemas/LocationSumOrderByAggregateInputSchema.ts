import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const LocationSumOrderByAggregateInputSchema: z.ZodType<Prisma.LocationSumOrderByAggregateInput> =
  z
    .object({
      latitude: z.lazy(() => SortOrderSchema).optional(),
      longitude: z.lazy(() => SortOrderSchema).optional(),
      pinballMapId: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.LocationSumOrderByAggregateInput>;

export default LocationSumOrderByAggregateInputSchema;
