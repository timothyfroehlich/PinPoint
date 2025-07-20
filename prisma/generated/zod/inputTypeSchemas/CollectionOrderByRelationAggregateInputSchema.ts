import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const CollectionOrderByRelationAggregateInputSchema: z.ZodType<Prisma.CollectionOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionOrderByRelationAggregateInput>;

export default CollectionOrderByRelationAggregateInputSchema;
