import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const PermissionMinOrderByAggregateInputSchema: z.ZodType<Prisma.PermissionMinOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionMinOrderByAggregateInput>;

export default PermissionMinOrderByAggregateInputSchema;
