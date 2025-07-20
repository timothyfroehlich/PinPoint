import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const MachineOrderByRelationAggregateInputSchema: z.ZodType<Prisma.MachineOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MachineOrderByRelationAggregateInput>;

export default MachineOrderByRelationAggregateInputSchema;
