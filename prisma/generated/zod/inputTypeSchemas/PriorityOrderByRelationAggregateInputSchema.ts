import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const PriorityOrderByRelationAggregateInputSchema: z.ZodType<Prisma.PriorityOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityOrderByRelationAggregateInput>;

export default PriorityOrderByRelationAggregateInputSchema;
