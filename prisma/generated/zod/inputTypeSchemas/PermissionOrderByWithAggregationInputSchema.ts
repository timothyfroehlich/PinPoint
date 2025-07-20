import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { PermissionCountOrderByAggregateInputSchema } from "./PermissionCountOrderByAggregateInputSchema";
import { PermissionMaxOrderByAggregateInputSchema } from "./PermissionMaxOrderByAggregateInputSchema";
import { PermissionMinOrderByAggregateInputSchema } from "./PermissionMinOrderByAggregateInputSchema";

export const PermissionOrderByWithAggregationInputSchema: z.ZodType<Prisma.PermissionOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      _count: z
        .lazy(() => PermissionCountOrderByAggregateInputSchema)
        .optional(),
      _max: z.lazy(() => PermissionMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => PermissionMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionOrderByWithAggregationInput>;

export default PermissionOrderByWithAggregationInputSchema;
