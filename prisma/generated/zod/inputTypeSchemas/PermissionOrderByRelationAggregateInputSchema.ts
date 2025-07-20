import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const PermissionOrderByRelationAggregateInputSchema: z.ZodType<Prisma.PermissionOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionOrderByRelationAggregateInput>;

export default PermissionOrderByRelationAggregateInputSchema;
