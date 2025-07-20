import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const MembershipOrderByRelationAggregateInputSchema: z.ZodType<Prisma.MembershipOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipOrderByRelationAggregateInput>;

export default MembershipOrderByRelationAggregateInputSchema;
