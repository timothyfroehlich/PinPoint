import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const UpvoteOrderByRelationAggregateInputSchema: z.ZodType<Prisma.UpvoteOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteOrderByRelationAggregateInput>;

export default UpvoteOrderByRelationAggregateInputSchema;
