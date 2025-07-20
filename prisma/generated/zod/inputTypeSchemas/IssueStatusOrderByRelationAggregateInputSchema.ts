import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const IssueStatusOrderByRelationAggregateInputSchema: z.ZodType<Prisma.IssueStatusOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusOrderByRelationAggregateInput>;

export default IssueStatusOrderByRelationAggregateInputSchema;
