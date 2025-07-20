import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { RoleCountOrderByAggregateInputSchema } from "./RoleCountOrderByAggregateInputSchema";
import { RoleMaxOrderByAggregateInputSchema } from "./RoleMaxOrderByAggregateInputSchema";
import { RoleMinOrderByAggregateInputSchema } from "./RoleMinOrderByAggregateInputSchema";

export const RoleOrderByWithAggregationInputSchema: z.ZodType<Prisma.RoleOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      isDefault: z.lazy(() => SortOrderSchema).optional(),
      _count: z.lazy(() => RoleCountOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => RoleMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => RoleMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.RoleOrderByWithAggregationInput>;

export default RoleOrderByWithAggregationInputSchema;
